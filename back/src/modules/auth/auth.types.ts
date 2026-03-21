import type { AuthProviderName } from "./providers/provider.types";

export interface CredentialsAuthInput {
  email: string;
  password: string;
}

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  isGuide: boolean;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: PublicAuthUser;
  token: string;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  provider: AuthProviderName;
}

export const toPublicAuthUser = (user: AuthUserRecord): PublicAuthUser => ({
  id: user.id,
  email: user.email,
});
