package service

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// PasswordResetRepo is what the forgot-password flow stores.
// *repository.PasswordResetRepository satisfies it.
type PasswordResetRepo interface {
	CreateCode(ctx context.Context, c repository.NewCode) (bool, error)
	LiveCode(ctx context.Context, userID uuid.UUID) (*model.PasswordResetCode, error)
	SpendTry(ctx context.Context, codeID uuid.UUID, maxTries int32) error
	ResetPassword(ctx context.Context, codeID, userID uuid.UUID, maxTries int32, passwordHash string, signOutAt time.Time) (bool, error)
}

var _ PasswordResetRepo = (*repository.PasswordResetRepository)(nil)

// PasswordResetService is forgot password by email code
// (specs/forgot-password): ask for a code, then set a new password with it.
// Both routes are public; whether an identifier has an account is never
// revealed (BR-02): asking always "succeeds", and every failure to confirm
// is the same RESET_CODE_INVALID.
type PasswordResetService struct {
	users    UserRepo
	codes    PasswordResetRepo
	hasher   resetCodeHasher
	email    EmailSender
	sessions *SessionService
	logger   *zap.Logger
	now      func() time.Time
	// inflight counts background issueCode runs; tests wait on it.
	inflight sync.WaitGroup
}

// NewPasswordResetService derives the code-hash key from the token signing
// secret (plan Finding #3).
func NewPasswordResetService(users UserRepo, codes PasswordResetRepo, signingSecret string, email EmailSender, sessions *SessionService, logger *zap.Logger) *PasswordResetService {
	return &PasswordResetService{
		users: users, codes: codes, hasher: newResetCodeHasher(signingSecret),
		email: email, sessions: sessions, logger: logger, now: time.Now,
	}
}

// RequestReset emails a new code to an active account (US-01). An unknown
// identifier, an account that is not active, and a request inside the
// cooldown or over the hourly cap all return nil, like a sent code (BR-02,
// BR-05). Only the account lookup runs on the request path: storing and
// sending the code happen in the background, so neither the response time
// nor a failure there tells a real account from an unknown one.
func (s *PasswordResetService) RequestReset(ctx context.Context, identifier string) error {
	user, err := userByIdentifier(ctx, s.users, identifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("service.RequestReset: %w", err)
	}
	if user.Status != model.UserStatusActive {
		return nil
	}
	s.inflight.Add(1)
	go s.issueCode(user.ID, user.Email, s.now().UTC())
	return nil
}

// issueCode stores a new code when the caps allow and emails it. Failures are
// logged with the user id only, never the email or the code (BR-06).
func (s *PasswordResetService) issueCode(userID uuid.UUID, toEmail string, now time.Time) {
	defer s.inflight.Done()
	ctx, cancel := context.WithTimeout(context.Background(), common.EmailDispatchTimeout)
	defer cancel()

	code, err := generateResetCode()
	if err != nil {
		s.logger.Error("password reset: could not generate a code", zap.String("user_id", userID.String()), zap.Error(err))
		return
	}
	created, err := s.codes.CreateCode(ctx, repository.NewCode{
		UserID:        userID,
		CodeHash:      s.hasher.hash(userID.String(), code),
		ExpiresAt:     now.Add(common.ResetCodeTTL),
		CooldownSince: now.Add(-common.ResetCodeCooldown),
		HourSince:     now.Add(-time.Hour),
		HourlyMax:     common.ResetCodeHourlyMax,
	})
	if err != nil {
		s.logger.Error("password reset: could not store the code", zap.String("user_id", userID.String()), zap.Error(err))
		return
	}
	if !created {
		return
	}
	if err := s.email.SendPasswordResetCode(ctx, toEmail, code); err != nil {
		s.logger.Error("password reset: email not sent", zap.String("user_id", userID.String()), zap.Error(err))
	}
}

// ConfirmReset sets a new password with a live code (US-02) and signs the
// calling device in. The password rules come first, so a mistyped password
// never spends one of the code's tries (BR-07).
func (s *PasswordResetService) ConfirmReset(ctx context.Context, identifier, code, newPassword string, device *model.SessionDevice) (*model.User, string, string, error) {
	if len(newPassword) < common.MinPasswordLength {
		return nil, "", "", common.NewWeakPasswordError(fmt.Sprintf("Mật khẩu cần ít nhất %d ký tự.", common.MinPasswordLength))
	}
	if common.PasswordTooLong(newPassword) {
		return nil, "", "", common.ErrPasswordTooLong
	}

	user, live, err := s.liveCodeFor(ctx, identifier)
	if err != nil {
		return nil, "", "", err
	}
	if !s.hasher.matches(user.ID.String(), code, live.CodeHash) {
		if err := s.codes.SpendTry(ctx, live.ID, common.ResetCodeMaxTries); err != nil {
			return nil, "", "", fmt.Errorf("service.ConfirmReset: %w", err)
		}
		return nil, "", "", common.ErrResetCodeInvalid
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), common.BcryptCost)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.ConfirmReset: hash password: %w", err)
	}
	// ⚠️ The code is used and the password stored in one transaction (BR-08).
	reset, err := s.codes.ResetPassword(ctx, live.ID, user.ID, common.ResetCodeMaxTries, string(hash), revocationPointNow())
	if err != nil {
		return nil, "", "", fmt.Errorf("service.ConfirmReset: %w", err)
	}
	if !reset {
		return nil, "", "", common.ErrResetCodeInvalid
	}

	// The new sign-out point already refuses every earlier credential; ending
	// the sessions only makes them show as ended (same as ChangePassword).
	if err := s.sessions.EndAll(ctx, user.ID, model.SessionRevokedPasswordReset); err != nil {
		s.logger.Error("password reset: could not end the old sessions", zap.String("user_id", user.ID.String()), zap.Error(err))
	}
	access, refresh, err := s.sessions.Start(ctx, user, device)
	if err != nil {
		return nil, "", "", fmt.Errorf("service.ConfirmReset: %w", err)
	}
	s.logger.Info("audit", zap.String("action", "password_reset"), zap.String("user_id", user.ID.String()))
	return user, access, refresh, nil
}

// liveCodeFor resolves the identifier to an active account and its newest
// live code. Every miss is the same RESET_CODE_INVALID (BR-02).
func (s *PasswordResetService) liveCodeFor(ctx context.Context, identifier string) (*model.User, *model.PasswordResetCode, error) {
	user, err := userByIdentifier(ctx, s.users, identifier)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, common.ErrResetCodeInvalid
		}
		return nil, nil, fmt.Errorf("service.ConfirmReset: %w", err)
	}
	if user.Status != model.UserStatusActive {
		return nil, nil, common.ErrResetCodeInvalid
	}
	live, err := s.codes.LiveCode(ctx, user.ID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, common.ErrResetCodeInvalid
		}
		return nil, nil, fmt.Errorf("service.ConfirmReset: %w", err)
	}
	return user, live, nil
}
