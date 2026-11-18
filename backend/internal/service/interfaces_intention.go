package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// SpendingIntentionRepo is the repository contract SpendingIntentionService
// depends on (specs/ai-chat-spending-intentions). *repository.
// SpendingIntentionRepository satisfies it; tests use an in-memory fake.
type SpendingIntentionRepo interface {
	Create(ctx context.Context, userID uuid.UUID, p repository.SpendingIntentionParams, key *string) (*model.SpendingIntention, error)
	GetByID(ctx context.Context, userID, id uuid.UUID) (*model.SpendingIntention, error)
	GetByKey(ctx context.Context, userID uuid.UUID, key string) (*model.SpendingIntention, error)
	List(ctx context.Context, userID uuid.UUID) ([]*model.SpendingIntention, error)
	Count(ctx context.Context, userID uuid.UUID) (int64, error)
	Update(ctx context.Context, userID, id uuid.UUID, p repository.SpendingIntentionParams) (*model.SpendingIntention, error)
	Delete(ctx context.Context, userID, id uuid.UUID) (bool, error)
}
