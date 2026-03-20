import { AppError } from "../../../lib/errors";
import { hashPassword, verifyPassword } from "../passwords";
import type { AuthRepository } from "../auth.repository";
import type { AuthUserRecord, CredentialsAuthInput } from "../auth.types";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505";

export class CredentialsAuthProvider {
  readonly name = "credentials" as const;

  constructor(private readonly authRepository: AuthRepository) {}

  async register(input: CredentialsAuthInput): Promise<AuthUserRecord> {
    const existingUser = await this.authRepository.findByEmail(input.email);

    if (existingUser) {
      throw new AppError(409, "An account with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);

    try {
      return await this.authRepository.createCredentialsUser(input.email, passwordHash);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "An account with this email already exists");
      }

      throw error;
    }
  }

  async login(input: CredentialsAuthInput): Promise<AuthUserRecord> {
    const existingUser = await this.authRepository.findByEmail(input.email);

    if (!existingUser) {
      throw new AppError(401, "Invalid email or password");
    }

    const passwordMatches = await verifyPassword(input.password, existingUser.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid email or password");
    }

    return existingUser;
  }
}
