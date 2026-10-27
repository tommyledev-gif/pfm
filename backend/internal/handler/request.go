package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/common"
)

// callerUUID reads the user ID JWTAuth already resolved and stored in
// locals — never re-parses the token here.
func callerUUID(c *fiber.Ctx) (uuid.UUID, error) {
	idStr, _ := c.Locals(common.LocalsUserID).(string)
	return uuid.Parse(idStr)
}

// pathUUID reads a path segment that must be a UUID (":id", ":user_id"). A
// malformed one is a 400 INVALID_INPUT ("<label> must be a valid UUID")
// before any service or database call.
func pathUUID(c *fiber.Ctx, param, label string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params(param))
	if err != nil {
		return uuid.UUID{}, common.NewInvalidInputError(label + " must be a valid UUID")
	}
	return id, nil
}
