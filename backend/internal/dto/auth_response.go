package dto

// TokenPairResponse is returned by both Login (F-02 US-04) and Activate
// (F-01 US-02) — they share the same TokenService.GenerateTokenPair output.
type TokenPairResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// ActivateResponse is the 200 body for POST /auth/activate.
type ActivateResponse struct {
	User         UserResponse `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
}
