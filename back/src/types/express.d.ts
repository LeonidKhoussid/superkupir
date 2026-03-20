import type { AuthProviderName } from "../modules/auth/providers/provider.types";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        provider: AuthProviderName;
      };
    }
  }
}

export {};
