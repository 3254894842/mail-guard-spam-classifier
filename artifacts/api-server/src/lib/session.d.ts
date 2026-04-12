import "express-session";

declare module "express-session" {
  interface SessionData {
    emailUser?: {
      email: string;
      password: string;
      provider: string;
      providerName: string;
    };
    adminUserId?: number;
  }
}
