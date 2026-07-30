package service

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

const pgUniqueViolation = "23505"

// isUniqueViolation detects a Postgres unique-constraint violation bubbling
// up through the repository layer — used to translate a lost race (e.g. two
// concurrent invites for the same email) into the correct business error
// instead of a generic 500.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation
}
