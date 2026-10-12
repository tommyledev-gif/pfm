package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/imageupload"
	"github.com/example/pfm/backend/internal/model"
)

// ProfileService is the signed-in user's own profile: display name and
// avatar. Every method acts on the caller's own row — the id always comes from
// the verified token, never from the request.
type ProfileService struct {
	users    UserRepo
	uploader IconUploader
	logger   *zap.Logger
}

func NewProfileService(users UserRepo, uploader IconUploader, logger *zap.Logger) *ProfileService {
	return &ProfileService{users: users, uploader: uploader, logger: logger}
}

func (s *ProfileService) Get(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	user, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		return nil, profileLookupError("Get", err)
	}
	return user, nil
}

// UpdateFullName changes the display name (see normalizeFullName for the rules).
func (s *ProfileService) UpdateFullName(ctx context.Context, userID uuid.UUID, raw string) (*model.User, error) {
	name, err := normalizeFullName(raw)
	if err != nil {
		return nil, err
	}
	user, err := s.users.UpdateFullName(ctx, userID, name)
	if err != nil {
		return nil, profileLookupError("UpdateFullName", err)
	}
	return user, nil
}

// ClaimUsername gives an account activated before tên đăng nhập existed (mig
// 030) its username. Same rule as the activation page: chosen once, never
// changed, so an account that has one gets USERNAME_ALREADY_SET.
func (s *ProfileService) ClaimUsername(ctx context.Context, userID uuid.UUID, raw string) (*model.User, error) {
	username := common.NormalizeUsername(raw)
	if problem := common.UsernameProblem(username); problem != "" {
		return nil, common.NewInvalidUsernameError(problem)
	}
	user, err := s.users.SetUsernameOnce(ctx, userID, username)
	if err == nil {
		return user, nil
	}
	if isUniqueViolation(err) {
		return nil, common.ErrUsernameTaken
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("service.Profile.ClaimUsername: %w", err)
	}
	// No row: the account is gone, or it already has a username. Say which.
	current, getErr := s.users.GetUserByID(ctx, userID)
	if getErr != nil {
		return nil, profileLookupError("ClaimUsername", getErr)
	}
	if current.Username != nil {
		return nil, common.ErrUsernameAlreadySet
	}
	return nil, profileLookupError("ClaimUsername", err)
}

// SetAvatar stores img as the user's avatar, then deletes the previous
// object so replacing a picture never leaves an orphan on R2. The old object
// goes last and best-effort: a failure there costs a few KB of storage,
// never the user's new avatar.
func (s *ProfileService) SetAvatar(ctx context.Context, userID uuid.UUID, img *imageupload.Image) (*model.User, error) {
	current, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		return nil, profileLookupError("SetAvatar", err)
	}

	url, err := s.uploader.UploadIcon(ctx, common.AvatarKeyPrefix, img.ContentType, img.Data)
	if err != nil {
		s.logger.Error("avatar upload failed", zap.Error(err))
		if _, unconfigured := s.uploader.(UnconfiguredIconUploader); unconfigured {
			return nil, common.ErrIconUploadUnavailable
		}
		return nil, common.ErrIconUploadFailed
	}

	updated, err := s.users.SetAvatarURL(ctx, userID, &url)
	if err != nil {
		// The row did not change, so the object just written is unreferenced.
		s.deleteQuietly(ctx, url)
		return nil, profileLookupError("SetAvatar", err)
	}

	if current.AvatarURL != nil {
		s.deleteQuietly(ctx, *current.AvatarURL)
	}
	return updated, nil
}

// RemoveAvatar clears the avatar and deletes its object. Idempotent.
func (s *ProfileService) RemoveAvatar(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	current, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		return nil, profileLookupError("RemoveAvatar", err)
	}
	updated, err := s.users.SetAvatarURL(ctx, userID, nil)
	if err != nil {
		return nil, profileLookupError("RemoveAvatar", err)
	}
	if current.AvatarURL != nil {
		s.deleteQuietly(ctx, *current.AvatarURL)
	}
	return updated, nil
}

func (s *ProfileService) deleteQuietly(ctx context.Context, url string) {
	if err := s.uploader.DeleteIcon(ctx, url); err != nil {
		s.logger.Warn("could not delete an avatar object from storage", zap.Error(err))
	}
}

// profileLookupError maps "no such user" (deleted since the token was issued —
// JWTAuth normally catches that first) to 401 and wraps anything else.
func profileLookupError(op string, err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return common.ErrUnauthenticated
	}
	return fmt.Errorf("service.Profile.%s: %w", op, err)
}
