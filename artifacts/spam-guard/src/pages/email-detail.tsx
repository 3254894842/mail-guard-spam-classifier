import { useEffect } from "react";
import { useLocation, Link, useParams } from "wouter";
import { 
  useGetSession,
  useGetEmailDetail,
  getGetEmailDetailQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft, AlertOctagon, ShieldCheck, Tag, Info, AlertCircle, Loader2,
  Banknote, FishSymbol, Link2, Gift, ShieldAlert, BadgeAlert, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// 垃圾类型配置
const SPAM_TYPE_CONFIG: Record<string, {
  bg: string; text: string; border: string;
  cardBg: string; cardBorder: string;
  icon: React.ReactNode; bigIcon: React.ReactNode;
  description: string;
}> = {
  "金融诈骗": {
    bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30",
    cardBg: "bg-red-500/10", cardBorder: "border-red-500/40",
    icon: <Banknote className="w-3.5 h-3.5" />,
    bigIcon: <Banknote className="w-5 h-5" />,
    description: "该邮件涉及金融类诈骗，可能含有虚假投资、贷款、套现等内容，请勿提供个人金融信息。",
  },
  "促销广告": {
    bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30",
    cardBg: "bg-orange-500/10", cardBorder: "border-orange-500/40",
    icon: <BadgeAlert className="w-3.5 h-3.5" />,
    bigIcon: <BadgeAlert className="w-5 h-5" />,
    description: "该邮件为商业推广或营销广告，包含促销、优惠、打折等内容。",
  },
  "账号钓鱼": {
    bg: "bg-yellow-500/15", text: "text-yellow-400", border: "border-yellow-500/30",
    cardBg: "bg-yellow-500/10", cardBorder: "border-yellow-500/40",
    icon: <FishSymbol className="w-3.5 h-3.5" />,
    bigIcon: <FishSymbol className="w-5 h-5" />,
    description: "该邮件疑似钓鱼攻击，可能冒充官方机构诱骗您输入账号密码或身份证信息。",
  },
  "诈骗链接": {
    bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30",
    cardBg: "bg-purple-500/10", cardBorder: "border-purple-500/40",
    icon: <Link2 className="w-3.5 h-3.5" />,
    bigIcon: <Link2 className="w-5 h-5" />,
    description: "该邮件包含可疑链接或二维码，点击后可能导致信息泄露或财产损失，请勿点击。",
  },
  "虚假中奖": {
    bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30",
    cardBg: "bg-pink-500/10", cardBorder: "border-pink-500/40",
    icon: <Gift className="w-3.5 h-3.5" />,
    bigIcon: <Gift className="w-5 h-5" />,
    description: "该邮件以中奖为由实施诈骗，所谓奖励并不存在，请勿相信并操作。",
  },
  "一般垃圾邮件": {
    bg: "bg-destructive/15", text: "text-destructive", border: "border-destructive/30",
    cardBg: "bg-destructive/10", cardBorder: "border-destructive/40",
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    bigIcon: <ShieldAlert className="w-5 h-5" />,
    description: "该邮件被识别为垃圾邮件，包含可疑内容，建议忽略或删除。",
  },
};

function getTypeConfig(spamType?: string) {
  if (!spamType) return SPAM_TYPE_CONFIG["一般垃圾邮件"];
  return SPAM_TYPE_CONFIG[spamType] ?? SPAM_TYPE_CONFIG["一般垃圾邮件"];
}

export default function EmailDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const uid = params.uid as string;

  const { data: session, isLoading: sessionLoading } = useGetSession();
  
  useEffect(() => {
    if (!sessionLoading && !session?.connected) {
      setLocation("/");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: email, isLoading: emailLoading } = useGetEmailDetail(
    uid,
    { query: { enabled: !!uid && !!session?.connected, queryKey: getGetEmailDetailQueryKey(uid) } }
  );

  if (sessionLoading || emailLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-4 max-w-5xl space-y-6">
          <Skeleton className="h-10 w-32 bg-card" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-40 w-full bg-card" />
              <Skeleton className="h-96 w-full bg-card" />
            </div>
            <Skeleton className="h-80 w-full bg-card" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!email) {
    return (
      <Layout>
        <div className="container mx-auto p-4 max-w-5xl">
          <div className="text-center p-12 bg-card rounded-lg border border-border">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">未找到邮件</h2>
            <p className="text-muted-foreground mb-6">无法加载该邮件，可能已被删除或 ID 无效。</p>
            <Link href="/inbox">
              <Button data-testid="button-back-to-inbox">返回收件箱</Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const typeCfg = getTypeConfig(email.spamType);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-red-400";
    if (score >= 50) return "text-orange-400";
    return "text-green-400";
  };

  const getGaugeRotation = (score: number) => -90 + (score / 100) * 180;

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6">
          <Link href="/inbox">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-3">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回收件箱
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* 邮件主体 */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border bg-card shadow-md">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-2xl font-bold leading-tight">{email.subject}</CardTitle>
                  {email.isSpam ? (
                    <Badge
                      variant="outline"
                      className={`shrink-0 flex items-center gap-1.5 py-1 px-2.5 ${typeCfg.bg} ${typeCfg.text} ${typeCfg.border}`}
                    >
                      {typeCfg.icon}
                      {email.spamType ?? "垃圾邮件"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 flex items-center gap-1.5 py-1 px-2.5 bg-green-500/10 text-green-400 border-green-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      安全邮件
                    </Badge>
                  )}
                </div>
                <CardDescription className="flex flex-col gap-2 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">发件人</span>
                    <span className="font-medium text-foreground">
                      {email.fromName ? `${email.fromName} <${email.from}>` : email.from}
                    </span>
                  </div>
                  {email.to && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-12">收件人</span>
                      <span className="text-foreground">{email.to}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-12">时间</span>
                    <span className="text-foreground">
                      {format(new Date(email.date), "yyyy年MM月dd日 HH:mm:ss", { locale: zhCN })}
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <Separator className="bg-border" />
              <CardContent className="pt-6">
                {email.bodyHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none prose-a:text-primary prose-img:rounded-md break-words"
                    dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {email.bodyText || "此邮件没有正文内容。"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 分析侧边栏 */}
          <div className="space-y-4">

            {/* 威胁评分表盘 */}
            <Card className="border-border bg-card/60 backdrop-blur shadow-lg sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  安全分析报告
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-3">

                {/* 半圆评分表盘 */}
                <div className="flex flex-col items-center p-4 bg-muted/30 rounded-xl">
                  <p className="text-xs font-medium text-muted-foreground mb-3">威胁指数</p>
                  <div className="relative w-36 h-[72px] overflow-hidden">
                    <div className="absolute top-0 left-0 w-36 h-36 rounded-full border-[14px] border-muted" />
                    <div
                      className={`absolute top-0 left-0 w-36 h-36 rounded-full border-[14px] border-b-transparent border-r-transparent transition-transform duration-1000 ease-out origin-center ${email.isSpam ? (email.spamScore >= 80 ? "border-red-500" : "border-orange-500") : "border-green-500"}`}
                      style={{ transform: `rotate(${getGaugeRotation(email.spamScore)}deg)` }}
                    />
                    <div className="absolute top-3.5 left-3.5 w-[116px] h-[116px] rounded-full bg-card" />
                    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                      <span className={`text-3xl font-black font-mono ${getScoreColor(email.spamScore)}`}>
                        {Math.round(email.spamScore)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full flex justify-between px-3 text-xs font-mono text-muted-foreground mt-1">
                    <span>0 安全</span>
                    <span>100 高危</span>
                  </div>
                </div>

                {/* 邮件类型卡片 */}
                {email.isSpam ? (
                  <div className={`rounded-lg border p-3 ${typeCfg.cardBg} ${typeCfg.cardBorder}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={typeCfg.text}>{typeCfg.bigIcon}</span>
                      <span className={`text-sm font-bold ${typeCfg.text}`}>{email.spamType ?? "垃圾邮件"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{typeCfg.description}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border p-3 bg-green-500/10 border-green-500/40">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-bold text-green-400">正常邮件</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      该邮件未检测到垃圾邮件特征，可以安全阅读。
                    </p>
                  </div>
                )}

                {/* 判定原因 */}
                {email.spamReasons && email.spamReasons.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground">判定原因</p>
                    </div>
                    <ul className="space-y-1.5">
                      {email.spamReasons.map((reason, idx) => (
                        <li
                          key={idx}
                          className="text-xs bg-muted/50 px-2.5 py-2 rounded-md border border-border/50 flex items-start gap-2 leading-relaxed"
                        >
                          <span className="text-primary font-bold mt-0.5 shrink-0">·</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
