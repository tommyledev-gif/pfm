package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
)

// GetUserByUsername looks a live account up by its tên đăng nhập (mig 030).
// Returns pgx.ErrNoRows (wrapped) when none has it.
func (r *UserRepository) GetUserByUsername(ctx context.Context, username string) (*model.User, error) {
	row, err := r.q.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("repository.GetUserByUsername: %w", err)
	}
	return toModel(row), nil
}

// CreateAccessRequest inserts a 'requested' user addressed to adminID (mig
// 031). A unique violation (wrapped) means the email already has an account.
func (r *UserRepository) CreateAccessRequest(ctx context.Context, email string, adminID uuid.UUID, approvalToken string) (*model.User, error) {
	row, err := r.q.CreateAccessRequest(ctx, email, adminID, approvalToken)
	if err != nil {
		return nil, fmt.Errorf("repository.CreateAccessRequest: %w", err)
	}
	return toModel(row), nil
}

// GetUserByApprovalToken returns the still-waiting request behind an email
// approval link, or pgx.ErrNoRows (wrapped).
func (r *UserRepository) GetUserByApprovalToken(ctx context.Context, approvalToken string) (*model.User, error) {
	row, err := r.q.GetUserByApprovalToken(ctx, approvalToken)
	if err != nil {
		return nil, fmt.Errorf("repository.GetUserByApprovalToken: %w", err)
	}
	return toModel(row), nil
}

// ApproveAccessRequest moves a request to pending with a fresh invite token.
// pgx.ErrNoRows (wrapped) means it was no longer waiting.
func (r *UserRepository) ApproveAccessRequest(ctx context.Context, id uuid.UUID, inviteToken string) (*model.User, error) {
	row, err := r.q.ApproveAccessRequest(ctx, id, inviteToken)
	if err != nil {
		return nil, fmt.Errorf("repository.ApproveAccessRequest: %w", err)
	}
	return toModel(row), nil
}

// RejectAccessRequest soft-deletes a still-waiting request and clears its
// approval token. pgx.ErrNoRows (wrapped) means it was no longer waiting.
func (r *UserRepository) RejectAccessRequest(ctx context.Context, id uuid.UUID) (*model.User, error) {
	row, err := r.q.RejectAccessRequest(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("repository.RejectAccessRequest: %w", err)
	}
	return toModel(row), nil
}
