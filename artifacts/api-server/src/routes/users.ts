import { Router, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { CreateUserBody, UpdateUserBody, UpdateUserParams, DeleteUserParams, UnlockUserParams, AdminLoginBody } from "@workspace/api-zod";

const router = Router();
const MAX_LOGIN_ATTEMPTS = 5;
const SALT_ROUNDS = 10;

function toUserResponse(u: typeof usersTable.$inferSelect) {
  return {
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

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session.adminUserId) {
    res.status(401).json({ error: "请先登录管理员账号" });
    return false;
  }
  return true;
}

router.post("/admin/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "请求参数无效" });
    return;
  }

  const { username, password } = parsed.data;
  const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const user = users[0];

  if (!user) {
    res.status(401).json({ error: "账号或密码错误", code: "INVALID_CREDENTIALS" });
    return;
  }

  if (user.isLocked) {
    res.status(401).json({ error: "账号已被锁定，请联系管理员解锁", code: "ACCOUNT_LOCKED" });
    return;
  }

  if (user.role !== "admin") {
    res.status(401).json({ error: "该账号无管理员权限", code: "UNAUTHORIZED" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.loginAttempts + 1;
    const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

    await db
      .update(usersTable)
      .set({ loginAttempts: newAttempts, isLocked: shouldLock })
      .where(eq(usersTable.id, user.id));

    if (shouldLock) {
      res.status(401).json({
        error: `密码错误次数过多，账号已被锁定，请联系管理员解锁`,
        code: "ACCOUNT_LOCKED",
      });
    } else {
      res.status(401).json({
        error: `密码错误，还剩 ${MAX_LOGIN_ATTEMPTS - newAttempts} 次尝试机会`,
        code: "INVALID_CREDENTIALS",
        attemptsLeft: MAX_LOGIN_ATTEMPTS - newAttempts,
      });
    }
    return;
  }

  await db
    .update(usersTable)
    .set({ loginAttempts: 0, lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session.adminUserId = user.id;
  res.json(toUserResponse({ ...user, loginAttempts: 0, lastLoginAt: new Date() }));
});

router.post("/admin/logout", (req: Request, res: Response): void => {
  req.session.adminUserId = undefined;
  res.json({ success: true, message: "已退出登录" });
});

router.get("/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json({ users: users.map(toUserResponse), total: users.length });
});

router.post("/users", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "请求参数无效: " + parsed.error.message });
    return;
  }

  const { username, email, password, role } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing[0]) {
    res.status(400).json({ error: "用户名已存在" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await db
    .insert(usersTable)
    .values({ username, email: email ?? null, passwordHash, role })
    .returning();

  res.status(201).json(toUserResponse(user));
});

router.patch("/users/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const paramParsed = UpdateUserParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "无效的用户ID" });
    return;
  }

  const bodyParsed = UpdateUserBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "请求参数无效" });
    return;
  }

  const { id } = paramParsed.data;
  const { username, email, role, password } = bodyParsed.data;

  const updateData: Partial<typeof usersTable.$inferInsert> = {};
  if (username !== undefined) updateData.username = username;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  if (password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const [updated] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  res.json(toUserResponse(updated));
});

router.delete("/users/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const paramParsed = DeleteUserParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "无效的用户ID" });
    return;
  }

  const { id } = paramParsed.data;

  if (req.session.adminUserId === id) {
    res.status(400).json({ error: "不能删除自己的账号" });
    return;
  }

  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  res.json({ success: true, message: "用户已删除" });
});

router.post("/users/:id/unlock", async (req: Request, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const paramParsed = UnlockUserParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "无效的用户ID" });
    return;
  }

  const { id } = paramParsed.data;
  const [updated] = await db
    .update(usersTable)
    .set({ isLocked: false, loginAttempts: 0 })
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "用户不存在" });
    return;
  }

  res.json(toUserResponse(updated));
});

export default router;
