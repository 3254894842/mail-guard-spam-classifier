import { Router, type Request, type Response } from "express";
import { ImapFlow } from "imapflow";
import { EMAIL_PROVIDERS, detectProvider } from "../lib/emailProviders";
import { ConnectEmailBody } from "@workspace/api-zod";

const router = Router();

router.post("/auth/connect", async (req: Request, res: Response): Promise<void> => {
  const parsed = ConnectEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "请求参数无效" });
    return;
  }

  const { email, password, provider: rawProvider } = parsed.data;
  const provider = rawProvider === "auto" ? detectProvider(email) : rawProvider;
  const imapConfig = EMAIL_PROVIDERS[provider];

  if (!imapConfig) {
    res.status(400).json({ error: "不支持的邮件服务商" });
    return;
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX");
    const totalEmails = mailbox.exists ?? 0;
    await client.logout();

    req.session.emailUser = {
      email,
      password,
      provider,
      providerName: imapConfig.name,
    };

    res.json({
      success: true,
      userEmail: email,
      providerName: imapConfig.name,
      totalEmails,
    });
  } catch (err: unknown) {
    req.log.warn({ err }, "IMAP connect failed");
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("auth") || message.includes("Authentication") || message.includes("LOGIN")) {
      res.status(401).json({ error: "邮箱账号或密码错误，请检查后重试" });
    } else if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
      res.status(401).json({ error: "无法连接到邮件服务器，请检查网络" });
    } else {
      res.status(401).json({ error: `连接失败: ${message}` });
    }
  }
});

router.post("/auth/disconnect", (req: Request, res: Response): void => {
  req.session.emailUser = undefined;
  res.json({ success: true, message: "已断开连接" });
});

router.get("/auth/session", async (req: Request, res: Response): Promise<void> => {
  const emailUser = req.session.emailUser;
  const adminUserId = req.session.adminUserId;

  let adminUser = null;
  if (adminUserId) {
    try {
      const { db, usersTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const users = await db.select().from(usersTable).where(eq(usersTable.id, adminUserId)).limit(1);
      if (users[0]) {
        const u = users[0];
        adminUser = {
          id: u.id,
          username: u.username,
          email: u.email ?? undefined,
          role: u.role,
          isLocked: u.isLocked,
          loginAttempts: u.loginAttempts,
          createdAt: u.createdAt.toISOString(),
          lastLoginAt: u.lastLoginAt?.toISOString() ?? undefined,
        };
      }
    } catch (_) {
      req.session.adminUserId = undefined;
    }
  }

  res.json({
    connected: !!emailUser,
    userEmail: emailUser?.email,
    providerName: emailUser?.providerName,
    adminUser,
  });
});

export default router;
