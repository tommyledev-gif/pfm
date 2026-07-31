export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  error_code?: string;
}

export interface ActivateRequest {
  token: string;
  full_name?: string;
  password: string;
  password_confirm: string;
}

export interface ActivateResult {
  success: boolean;
  message: string;
  email?: string;
  error_code?: string;
}
