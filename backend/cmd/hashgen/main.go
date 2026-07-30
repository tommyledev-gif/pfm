// Throwaway dev utility: prints a bcrypt hash for a given password so a
// local admin user can be seeded without a real email/SMTP flow. Not part
// of the application — safe to delete after local setup.
package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Println("usage: hashgen <password>")
		os.Exit(1)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(os.Args[1]), 12)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(hash))
}
