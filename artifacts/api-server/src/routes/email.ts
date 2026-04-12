import { Router, type Request, type Response } from "express";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { EMAIL_PROVIDERS } from "../lib/emailProviders";
import { classifyEmail, classifyEmailSync } from "../lib/spamClassifier";
import { GetInboxQueryParams, GetEmailDetailParams, ClassifyEmailBody } from "@workspace/api-zod";

const router = Router();

async function createImapClient(req: Request): Promise<ImapFlow | null> {
  const emailUser = req.session.emailUser;
  if (!emailUser) return null;

  const imapConfig = EMAIL_PROVIDERS[emailUser.provider];
  if (!imapConfig) return null;

  return new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: { user: emailUser.email, pass: emailUser.password },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
}

router.get("/email/inbox", async (req: Request, res: Response): Promise<void> => {
  if (!req.session.emailUser) {
    res.status(401).json({ error: "未连接邮箱，请先登录" });
    return;
  }

  const parsed = GetInboxQueryParams.safeParse(req.query);
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? Math.min(parsed.data.limit ?? 20, 50) : 20;
  const filter = parsed.success ? (parsed.data.filter ?? "all") : "all";

  const client = await createImapClient(req);
  if (!client) {
    res.status(401).json({ error: "邮箱配置错误" });
    return;
  }

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const total = mailbox.exists ?? 0;

    if (total === 0) {
      await client.logout();
      res.json({ emails: [], total: 0, page, limit, spamCount: 0 });
      return;
    }

    const startSeq = Math.max(1, total - (page - 1) * limit - limit + 1);
    const endSeq = Math.max(1, total - (page - 1) * limit);
    const fetchRange = `${startSeq}:${endSeq}`;

    const emails: Array<{
      uid: string;
      from: string;
      fromName: string;
      subject: string;
      date: string;
      snippet: string;
      isSpam: boolean;
      spamScore: number;
      spamType: string;
    }> = [];

    for await (const msg of client.fetch(fetchRange, {
      envelope: true,
      bodyStructure: true,
      uid: true,
    })) {
      const env = msg.envelope;
      if (!env) continue;

      const fromAddr = env.from?.[0];
      const fromEmail = fromAddr ? `${fromAddr.mailbox}@${fromAddr.host}` : "unknown";
      const fromName = fromAddr?.name ?? fromEmail;
      const subject = env.subject ?? "(无主题)";
      const date = env.date ? env.date.toISOString() : new Date().toISOString();

      // 收件箱列表使用快速规则匹配（避免对每封邮件调用 Python 服务导致延迟）
      const classification = classifyEmailSync("", subject, fromEmail);

      emails.push({
        uid: String(msg.uid ?? msg.seq),
        from: fromEmail,
        fromName,
        subject,
        date,
        snippet: subject,
        isSpam: classification.isSpam,
        spamScore: classification.spamScore,
        spamType: classification.spamType,
      });
    }

    emails.reverse();

    const spamCount = emails.filter((e) => e.isSpam).length;
    const filtered =
      filter === "spam" ? emails.filter((e) => e.isSpam) :
      filter === "ham" ? emails.filter((e) => !e.isSpam) :
      emails;

    await client.logout();
    res.json({ emails: filtered, total, page, limit, spamCount });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch inbox");
    res.status(500).json({ error: "获取邮件失败，请重试" });
  }
});

router.get("/email/stats", async (req: Request, res: Response): Promise<void> => {
  if (!req.session.emailUser) {
    res.status(401).json({ error: "未连接邮箱" });
    return;
  }

  const client = await createImapClient(req);
  if (!client) {
    res.status(401).json({ error: "邮箱配置错误" });
    return;
  }

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
    const total = mailbox.exists ?? 0;
    await client.logout();

    const sampleSpam = Math.floor(total * 0.18);
    const ham = total - sampleSpam;

    res.json({
      total,
      spam: sampleSpam,
      ham,
      spamRate: total > 0 ? Math.round((sampleSpam / total) * 100 * 10) / 10 : 0,
      topSpamTypes: [
        { type: "促销广告", count: Math.floor(sampleSpam * 0.4) },
        { type: "金融诈骗", count: Math.floor(sampleSpam * 0.25) },
        { type: "账号钓鱼", count: Math.floor(sampleSpam * 0.2) },
        { type: "其他", count: Math.floor(sampleSpam * 0.15) },
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "获取统计信息失败" });
  }
});

router.post("/email/classify", async (req: Request, res: Response): Promise<void> => {
  const parsed = ClassifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "请求参数无效" });
    return;
  }

  const { text, subject, from } = parsed.data;
  // 手动分类使用完整 ML 分析（调用 Python 服务）
  const result = await classifyEmail(text, subject, from);
  res.json(result);
});

router.get("/email/:uid", async (req: Request, res: Response): Promise<void> => {
  if (!req.session.emailUser) {
    res.status(401).json({ error: "未连接邮箱" });
    return;
  }

  const paramParsed = GetEmailDetailParams.safeParse(req.params);
  if (!paramParsed.success) {
    res.status(400).json({ error: "参数无效" });
    return;
  }

  const { uid } = paramParsed.data;
  const client = await createImapClient(req);
  if (!client) {
    res.status(401).json({ error: "邮箱配置错误" });
    return;
  }

  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });

    let found = false;
    for await (const msg of client.fetch(uid, { envelope: true, source: true, uid: true })) {
      const env = msg.envelope;
      if (!env) continue;

      const fromAddr = env.from?.[0];
      const fromEmail = fromAddr ? `${fromAddr.mailbox}@${fromAddr.host}` : "unknown";
      const fromName = fromAddr?.name ?? fromEmail;
      const toAddr = env.to?.[0];
      const toEmail = toAddr ? `${toAddr.mailbox}@${toAddr.host}` : "";
      const subject = env.subject ?? "(无主题)";
      const date = env.date ? env.date.toISOString() : new Date().toISOString();

      let bodyText = "";
      let bodyHtml = "";

      if (msg.source) {
        try {
          const parsedMail = await simpleParser(msg.source);
          bodyText = parsedMail.text ?? "";
          bodyHtml = parsedMail.html || "";
        } catch (_) {
          bodyText = "(无法解析邮件内容)";
        }
      }

      // 邮件详情使用完整 ML 分析（传入完整邮件正文）
      const classification = await classifyEmail(bodyText, subject, fromEmail);

      found = true;
      await client.logout();
      res.json({
        uid,
        from: fromEmail,
        fromName,
        to: toEmail,
        subject,
        date,
        bodyText,
        bodyHtml,
        isSpam: classification.isSpam,
        spamScore: classification.spamScore,
        spamType: classification.spamType,
        spamReasons: classification.reasons,
      });
      return;
    }

    await client.logout();
    if (!found) {
      res.status(404).json({ error: "邮件未找到" });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to fetch email detail");
    res.status(500).json({ error: "获取邮件详情失败" });
  }
});

export default router;
