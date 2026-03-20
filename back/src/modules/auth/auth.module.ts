import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { createAuthRouter } from "./auth.routes";
import { AuthService } from "./auth.service";
import { CredentialsAuthProvider } from "./providers/credentials.provider";

const authRepository = new AuthRepository();
const credentialsProvider = new CredentialsAuthProvider(authRepository);
const authService = new AuthService(authRepository, credentialsProvider);
const authController = new AuthController(authService);

export const authRouter = createAuthRouter(authController);
