// Mirrors backend/internal/dto/auth_request.go / auth_response.go's shape.
// Populated ahead of the actual login screen/mutation (not yet implemented —
// this pass is setup only) so the type contract is settled before any
// feature code lands.
export interface LoginRequest {
  /** An email or a tên đăng nhập; the field keeps its old name on the wire. */
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

/** POST /auth/login also says whose account it signed in to. */
export interface LoginResult extends LoginResponse {
  email?: string;
}
