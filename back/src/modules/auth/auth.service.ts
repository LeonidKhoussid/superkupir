import { AppError } from "../../lib/errors";
import { signAccessToken } from "./token";
import type { AuthRepository } from "./auth.repository";
import type { AuthResult, CredentialsAuthInput, PublicAuthUser } from "./auth.types";
import { toPublicAuthUser } from "./auth.types";
import type { CredentialsAuthProvider } from "./providers/credentials.provider";

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly credentialsProvider: CredentialsAuthProvider,
  ) {}

  async registerWithCredentials(input: CredentialsAuthInput): Promise<AuthResult> {
    const user = await this.credentialsProvider.register(input);

    return {
      user: toPublicAuthUser(user),
      token: signAccessToken(user),
    };
  }

  async loginWithCredentials(input: CredentialsAuthInput): Promise<AuthResult> {
    const user = await this.credentialsProvider.login(input);

    return {
      user: toPublicAuthUser(user),
      token: signAccessToken(user),
    };
  }

  async getCurrentUser(userId: string): Promise<PublicAuthUser> {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      throw new AppError(401, "Authenticated user not found");
    }

    return toPublicAuthUser(user);
  }
}
