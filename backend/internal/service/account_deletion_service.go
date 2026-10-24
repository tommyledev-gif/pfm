package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// AccountDeletionRepo is the slice of the user repository the deletion tool
// needs. Kept apart from UserRepo so the fakes that implement UserRepo do
// not have to grow methods they never use.
type AccountDeletionRepo interface {
	GetUserByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	SearchUsers(ctx context.Context, pattern string, limit int32) ([]*model.User, error)
	SoftDeleteUser(ctx context.Context, id uuid.UUID) (*model.User, error)
}

var _ AccountDeletionRepo = (*repository.UserRepository)(nil)

// sessionEnder is SessionService.EndAll — an interface only so tests can
// stand in for it.
type sessionEnder interface {
	EndAll(ctx context.Context, userID uuid.UUID, reason string) error
}

// AccountDeletionService backs the account deletion tool on the mobile
// Thành viên screen: a super admin or the operator (AccountDeletionPolicy) searches for
// any other account and soft-deletes it.
type AccountDeletionService struct {
	repo     AccountDeletionRepo
	sessions sessionEnder
	policy   AccountDeletionPolicy
	logger   *zap.Logger
}

func NewAccountDeletionService(repo AccountDeletionRepo, sessions sessionEnder, policy AccountDeletionPolicy, logger *zap.Logger) *AccountDeletionService {
	return &AccountDeletionService{repo: repo, sessions: sessions, policy: policy, logger: logger}
}

// SearchUsers returns live accounts, any status, whose email or tên đăng
// nhập contains q (case-insensitive). The caller is left out: deleting
// yourself is refused anyway.
func (s *AccountDeletionService) SearchUsers(ctx context.Context, callerID uuid.UUID, q string) ([]*model.User, error) {
	if err := s.requireOperator(ctx, callerID); err != nil {
		return nil, err
	}
	q = strings.ToLower(strings.TrimSpace(q))
	if q == "" {
		return []*model.User{}, nil
	}
	// likeEscaper (transaction_service_query.go): a "_" typed into the box is
	// matched as text. One extra row, so leaving the caller out still fills a page.
	users, err := s.repo.SearchUsers(ctx, likeEscaper.Replace(q), common.AccountSearchLimit+1)
	if err != nil {
		return nil, fmt.Errorf("service.SearchUsers: %w", err)
	}
	found := make([]*model.User, 0, len(users))
	for _, u := range users {
		if u.ID != callerID && len(found) < common.AccountSearchLimit {
			found = append(found, u)
		}
	}
	return found, nil
}

// DeleteUser soft-deletes the target account and ends its sessions.
//
// The delete is what locks the account out: sign-in lookups skip deleted
// rows and JWTAuth refuses a deleted user's tokens on the next request.
// Ending the sessions afterwards is cleanup, so a failure there is logged,
// not returned — the account is already deleted, and reporting the request
// as failed would only make a retry hit 404.
func (s *AccountDeletionService) DeleteUser(ctx context.Context, callerID, targetID uuid.UUID) error {
	if err := s.requireOperator(ctx, callerID); err != nil {
		return err
	}
	if callerID == targetID {
		return common.NewInvalidInputError("Không xóa được tài khoản đang đăng nhập.")
	}
	if _, err := s.repo.SoftDeleteUser(ctx, targetID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrNotFound
		}
		return fmt.Errorf("service.DeleteUser: %w", err)
	}
	if err := s.sessions.EndAll(ctx, targetID, model.SessionRevokedAdmin); err != nil {
		s.logger.Warn("deleted account's sessions not ended", zap.String("user_id", targetID.String()), zap.Error(err))
	}
	return nil
}

// requireOperator lets through only a super admin or the configured operator.
func (s *AccountDeletionService) requireOperator(ctx context.Context, callerID uuid.UUID) error {
	caller, err := s.repo.GetUserByID(ctx, callerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrForbidden
		}
		return fmt.Errorf("service.requireOperator: %w", err)
	}
	if !s.policy.Grants(caller) {
		return common.ErrForbidden
	}
	return nil
}
