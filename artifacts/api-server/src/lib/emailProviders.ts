export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  name: string;
}

export const EMAIL_PROVIDERS: Record<string, ImapConfig> = {
  qq: {
    host: "imap.qq.com",
    port: 993,
    secure: true,
    name: "QQ邮箱",
  },
  "163": {
    host: "imap.163.com",
    port: 993,
    secure: true,
    name: "163邮箱",
  },
  "126": {
    host: "imap.126.com",
    port: 993,
    secure: true,
    name: "126邮箱",
  },
  gmail: {
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    name: "Gmail",
  },
  outlook: {
    host: "imap-mail.outlook.com",
    port: 993,
    secure: true,
    name: "Outlook",
  },
  sina: {
    host: "imap.sina.com",
    port: 993,
    secure: true,
    name: "新浪邮箱",
  },
};

export function detectProvider(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain.includes("qq.com")) return "qq";
  if (domain.includes("163.com")) return "163";
  if (domain.includes("126.com")) return "126";
  if (domain.includes("gmail.com")) return "gmail";
  if (domain.includes("outlook.com") || domain.includes("hotmail.com") || domain.includes("live.com")) return "outlook";
  if (domain.includes("sina.com")) return "sina";
  return "gmail";
}
