package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// AccessRequestNotifier is the one notification write AccessRequestService
// needs. *repository.NotificationRepository satisfies it.
type AccessRequestNotifier interface {
	CreateAccessRequestNotification(ctx context.Context, adminID uuid.UUID, title, body string, requesterID uuid.UUID) error
}

// AccessRequestService lets someone without an account ask an admin for one
// (mig 031). A request is a users row in status 'requested'; approving it
// turns it into an ordinary pending invite, so activation, resend and expiry
// are the invite flow's own from there on. Rejecting it soft-deletes the row.
type AccessRequestService struct {
	users    UserRepo
	notifier AccessRequestNotifier
	email    EmailSender
	logger   *zap.Logger
}

func NewAccessRequestService(users UserRepo, notifier AccessRequestNotifier, email EmailSender, logger *zap.Logger) *AccessRequestService {
	return &AccessRequestService{users: users, notifier: notifier, email: email, logger: logger}
}

// RequestAccess files a request from email to the admin who uses adminEmail:
// an in-app notification for that admin plus an email with an approval link.
//
// What the caller learns is deliberately uneven. A wrong admin email is said
// plainly (ADMIN_NOT_FOUND), because the requester can fix a typo and an
// admin's address is not a secret inside a household. Whether email already
// has an account is never said: that case returns nil exactly like a filed
// request, so the endpoint cannot be used to test who is registered.
func (s *AccessRequestService) RequestAccess(ctx context.Context, email, adminEmail string) error {
	email = common.NormalizeEmail(email)
	adminEmail = common.NormalizeEmail(adminEmail)
	if email == adminEmail {
		return common.NewInvalidInputError("Email của bạn và email admin phải khác nhau.")
	}

	admin, err := s.users.GetUserByEmail(ctx, adminEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrAdminNotFound
		}
		return fmt.Errorf("service.RequestAccess: %w", err)
	}
	if admin.Role != model.UserRoleAdmin || admin.Status != model.UserStatusActive {
		return common.ErrAdminNotFound
	}

	approvalToken, err := generateInviteToken()
	if err != nil {
		return fmt.Errorf("service.RequestAccess: %w", err)
	}

	requester, err := s.users.CreateAccessRequest(ctx, email, admin.ID, approvalToken)
	if err != nil {
		// The email already belongs to an account (any status, a waiting
		// request included): the same answer as success, nothing sent.
		if isUniqueViolation(err) {
			return nil
		}
		return fmt.Errorf("service.RequestAccess: %w", err)
	}

	// The request row is the record; the notification is how the admin sees
	// it in the app. Failing to write it must not fail the request, since the
	// row already exists and the email still goes out.
	if err := s.notifier.CreateAccessRequestNotification(ctx, admin.ID, "Yêu cầu tạo tài khoản", requester.Email+" muốn có tài khoản Budgest.", requester.ID); err != nil {
		s.logger.Error("access request: failed to notify admin", zap.Error(err))
	}

	go s.dispatch("access request", func(ctx context.Context) error {
		return s.email.SendAccessRequestEmail(ctx, admin.Email, requester.Email, approvalToken)
	})
	return nil
}

// ApproveByToken approves the request behind an admin's email link; the
// token is the credential, so no session is needed.
func (s *AccessRequestService) ApproveByToken(ctx context.Context, approvalToken string) (*model.User, error) {
	requester, err := s.users.GetUserByApprovalToken(ctx, approvalToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Unknown, or already used: the link clears its token on approval.
			return nil, common.ErrAccessRequestHandled
		}
		return nil, fmt.Errorf("service.ApproveByToken: %w", err)
	}
	return s.approve(ctx, requester.ID)
}

// Approve approves a request from the app (an admin's Thành viên or
// Thông báo screen). Any admin may approve, not only the one asked.
func (s *AccessRequestService) Approve(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	requester, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrNotFound
		}
		return nil, fmt.Errorf("service.Approve: %w", err)
	}
	if requester.Status != model.UserStatusRequested {
		return nil, common.ErrAccessRequestHandled
	}
	return s.approve(ctx, requester.ID)
}

// Reject turns a request down from the app. The row is soft-deleted, which
// frees the email (its unique index covers live rows only) so the person can
// ask again, and clears the approval token so the admin's email link stops
// working. Nothing is emailed to the requester. Any admin may reject.
func (s *AccessRequestService) Reject(ctx context.Context, userID uuid.UUID) error {
	requester, err := s.users.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrNotFound
		}
		return fmt.Errorf("service.Reject: %w", err)
	}
	if requester.Status != model.UserStatusRequested {
		return common.ErrAccessRequestHandled
	}
	// Same race arbiter as approve: the conditional UPDATE matches no row
	// when an approval (email link or app) or another rejection got there first.
	if _, err := s.users.RejectAccessRequest(ctx, requester.ID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return common.ErrAccessRequestHandled
		}
		return fmt.Errorf("service.Reject: %w", err)
	}
	return nil
}

// approve turns the request into a pending invite and emails the requester
// the activation link. The conditional UPDATE decides races: of two
// approvals at once, one gets the row and the other ACCESS_REQUEST_HANDLED.
func (s *AccessRequestService) approve(ctx context.Context, userID uuid.UUID) (*model.User, error) {
	inviteToken, err := generateInviteToken()
	if err != nil {
		return nil, fmt.Errorf("service.approve: %w", err)
	}
	approved, err := s.users.ApproveAccessRequest(ctx, userID, inviteToken)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, common.ErrAccessRequestHandled
		}
		return nil, fmt.Errorf("service.approve: %w", err)
	}

	go s.dispatch("access approved", func(ctx context.Context) error {
		return s.email.SendAccessApprovedEmail(ctx, approved.Email, inviteToken)
	})
	return approved, nil
}

// dispatch sends one email on a detached context, same reasoning as
// UserService.dispatchActivationEmail: the request has already answered.
func (s *AccessRequestService) dispatch(kind string, send func(ctx context.Context) error) {
	ctx, cancel := context.WithTimeout(context.Background(), common.EmailDispatchTimeout)
	defer cancel()
	if err := send(ctx); err != nil {
		s.logger.Error("failed to dispatch email", zap.String("kind", kind), zap.Error(err))
	}
}
