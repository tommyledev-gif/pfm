// Mirrors backend/internal/dto/auth_request.go / auth_response.go's shape.
// Populated ahead of the actual login screen/mutation (not yet implemented —
// this pass is setup only) so the type contract is settled before any
// feature code lands.
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}
