/**
 * 垃圾邮件分类器
 * 优先调用 Python ML 服务 (localhost:5001)
 * 如果 Python 服务未启动，自动降级到规则匹配
 */

interface ClassifyResult {
  isSpam: boolean;
  spamScore: number;
  spamType: string;
  reasons: string[];
  confidence: number;
}

const PYTHON_SERVICE_URL = process.env.CLASSIFIER_SERVICE_URL ?? "http://localhost:5001";
let pythonServiceAvailable: boolean | null = null;
let lastChecked = 0;
const CHECK_INTERVAL = 30_000;

async function checkPythonService(): Promise<boolean> {
  const now = Date.now();
  if (pythonServiceAvailable !== null && now - lastChecked < CHECK_INTERVAL) {
    return pythonServiceAvailable;
  }
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}/healthz`, {
      signal: AbortSignal.timeout(3000),
    });
    pythonServiceAvailable = res.ok;
    lastChecked = now;
    if (pythonServiceAvailable) {
      const data = await res.json() as { method: string };
      console.info(`[分类器] Python 服务可用，分类方法: ${data.method}`);
    }
  } catch {
    pythonServiceAvailable = false;
    lastChecked = now;
  }
  return pythonServiceAvailable;
}

async function callPythonClassifier(text: string, subject?: string, from_addr?: string): Promise<ClassifyResult | null> {
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, subject: subject ?? "", from: from_addr ?? "" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as ClassifyResult;
    return data;
  } catch {
    pythonServiceAvailable = false;
    return null;
  }
}

// ── 规则匹配（备用方案）────────────────────────────────────────────────────

const SPAM_KEYWORDS: Record<string, string[]> = {
  "促销广告": [
    "免费领取", "限时优惠", "大促", "打折", "折扣", "优惠券", "抢购", "秒杀",
    "返利", "返现", "红包", "中奖", "恭喜您", "抽奖", "积分兑换", "特价",
    "超低价", "爆款", "热卖", "清仓", "买一送一", "全场五折", "限量",
    "品牌特卖", "商城", "购物节", "双十一", "618",
  ],
  "金融诈骗": [
    "贷款", "低息", "无抵押", "秒到账", "放款", "借钱", "急用钱",
    "套现", "刷单", "兼职赚钱", "日赚", "月入过万", "投资理财",
    "高收益", "稳定回报", "内幕消息", "股票推荐", "虚拟货币", "比特币",
  ],
  "诈骗链接": [
    "点击链接", "扫码", "二维码", "立即点击", "马上领取", "加我",
    "私聊", "加好友", "telegram", "whatsapp",
  ],
  "账号钓鱼": [
    "账号被盗", "密码过期", "账号异常", "立即验证", "身份验证",
    "冻结", "封号", "实名认证", "补全信息", "银行卡", "转账",
  ],
};

const SPAM_PATTERNS = [
  { pattern: /1[3-9]\d{9}/, reason: "包含手机号码", score: 10 },
  { pattern: /https?:\/\/[^\s]{20,}/, reason: "包含长链接", score: 15 },
  { pattern: /(.)\1{4,}/, reason: "包含重复字符", score: 8 },
  { pattern: /[！!]{3,}/, reason: "过多感叹号", score: 12 },
  { pattern: /[¥$￥]\d+/, reason: "包含金额数字", score: 10 },
];

function ruleBasedClassify(text: string, subject?: string, from_addr?: string): ClassifyResult {
  const fullText = [subject ?? "", from_addr ?? "", text].join(" ");
  const reasons: string[] = [];
  let score = 0;
  let detectedType = "";

  for (const [spamType, keywords] of Object.entries(SPAM_KEYWORDS)) {
    const hits = keywords.filter((kw) => fullText.includes(kw));
    if (hits.length > 0) {
      const typeScore = hits.length === 1 ? 18 : hits.length === 2 ? 30 : Math.min(hits.length * 13, 50);
      score += typeScore;
      if (!detectedType || typeScore > 20) detectedType = spamType;
      reasons.push(`包含${spamType}关键词: ${hits.slice(0, 3).join("、")}`);
    }
  }

  for (const { pattern, reason, score: s } of SPAM_PATTERNS) {
    if (pattern.test(fullText)) {
      score += s;
      reasons.push(reason);
    }
  }

  if (from_addr) {
    if (/no.?reply|noreply|donotreply/i.test(from_addr)) {
      score += 5;
      reasons.push("来自无回复地址");
    }
  }

  const clampedScore = Math.min(score, 100);
  const isSpam = clampedScore >= 30;
  const confidence = isSpam
    ? Math.min(60 + clampedScore * 0.4, 99)
    : Math.min(60 + (100 - clampedScore) * 0.4, 99);

  return {
    isSpam,
    spamScore: clampedScore,
    spamType: detectedType || (isSpam ? "一般垃圾邮件" : "正常邮件"),
    reasons: reasons.slice(0, 5),
    confidence: Math.round(confidence * 10) / 10,
  };
}

// ── 主入口 ──────────────────────────────────────────────────────────────────

export async function classifyEmail(
  text: string,
  subject?: string,
  from_addr?: string
): Promise<ClassifyResult> {
  const available = await checkPythonService();
  if (available) {
    const result = await callPythonClassifier(text, subject, from_addr);
    if (result) return result;
  }
  return ruleBasedClassify(text, subject, from_addr);
}

/** 同步版本（仅用于快速扫描，不调用 Python 服务）*/
export function classifyEmailSync(
  text: string,
  subject?: string,
  from_addr?: string
): ClassifyResult {
  return ruleBasedClassify(text, subject, from_addr);
}
