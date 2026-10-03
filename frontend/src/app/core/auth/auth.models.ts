export interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'USER' | 'ADMIN';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  fullName: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: User;
}

export interface StoredSession {
  token: string;
  expiresAt: number;
  user: User;
}
