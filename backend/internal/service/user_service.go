package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// UserService owns Invite/List (F-01 US-01, US-03) — business rules only;
// shape validation stays in the handler/dto layer.
type UserService struct {
	repo   UserRepo
	email  EmailSender
	logger *zap.Logger
}

func NewUserService(repo UserRepo, email EmailSender, logger *zap.Logger) *UserService {
	return &UserService{repo: repo, email: email, logger: logger}
}

// InviteUser implements F-01 US-01. Email dispatch is fire-and-forget on a
// detached context so a slow/failing send never blocks or fails the 201
// response — the send failure is only logged (spec.md S-USR-08).
func (s *UserService) InviteUser(ctx context.Context, adminID uuid.UUID, email, roleStr string) (*model.User, error) {
	role := model.UserRoleMember
	if roleStr != "" {
		role = model.UserRole(roleStr)
	}

	count, err := s.repo.CountUserByEmailAnyStatus(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("service.InviteUser: %w", err)
	}
	if count > 0 {
		return nil, common.ErrEmailAlreadyExists
	}

	token, err := generateInviteToken()
	if err != nil {
		return nil, fmt.Errorf("service.InviteUser: %w", err)
	}

	user, err := s.repo.CreatePendingUser(ctx, email, role, adminID, token)
	if err != nil {
		// Two admins can race between the CountUserByEmailAnyStatus check
		// above and this insert (test_cases.md TC-USR-15) — the DB's unique
		// index on email is the real, final arbiter, so its violation must
		// still surface as 409, not a generic 500.
		if isUniqueViolation(err) {
			return nil, common.ErrEmailAlreadyExists
		}
		return nil, fmt.Errorf("service.InviteUser: %w", err)
	}

	go s.dispatchActivationEmail(user.Email, token)

	return user, nil
}

func (s *UserService) dispatchActivationEmail(email, token string) {
	// Detached context: the request's ctx is cancelled once the handler
	// returns, but this send must still be attempted after that point.
	ctx, cancel := context.WithTimeout(context.Background(), common.EmailDispatchTimeout)
	defer cancel()
	if err := s.email.SendActivationEmail(ctx, email, token); err != nil {
		s.logger.Error("failed to dispatch activation email", zap.String("email", common.MaskEmail(email)), zap.Error(err))
	}
}

// ListUsers implements F-01 US-03. Returns plain values rather than a DTO —
// assembling the response shape (UserResponse whitelist, pagination) is a
// handler concern, matching CLAUDE.md's service-returns-domain-model pattern.
func (s *UserService) ListUsers(ctx context.Context, status, role, cursor string, limit int) ([]*model.User, *string, int64, error) {
	var cursorID *uuid.UUID
	var cursorCreatedAt *time.Time
	if cursor != "" {
		id, createdAt, err := decodeCursor(cursor)
		if err != nil {
			return nil, nil, 0, common.NewInvalidInputError("cursor is invalid")
		}
		cursorID = &id
		cursorCreatedAt = &createdAt
	}

	var statusPtr, rolePtr *string
	if status != "" {
		statusPtr = &status
	}
	if role != "" {
		rolePtr = &role
	}

	// Fetch one extra row to know whether a next page exists, without a
	// separate COUNT-based lookahead query.
	users, err := s.repo.ListUsers(ctx, repository.ListUsersParams{
		Status:          statusPtr,
		Role:            rolePtr,
		CursorCreatedAt: cursorCreatedAt,
		CursorID:        cursorID,
		Limit:           int32(limit + 1),
	})
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListUsers: %w", err)
	}

	hasMore := len(users) > limit
	if hasMore {
		users = users[:limit]
	}

	var nextCursor *string
	if hasMore && len(users) > 0 {
		last := users[len(users)-1]
		c, err := encodeCursor(last.ID, last.CreatedAt)
		if err != nil {
			return nil, nil, 0, fmt.Errorf("service.ListUsers: %w", err)
		}
		nextCursor = &c
	}

	total, err := s.repo.CountUsers(ctx, statusPtr, rolePtr)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("service.ListUsers: %w", err)
	}

	return users, nextCursor, total, nil
}
