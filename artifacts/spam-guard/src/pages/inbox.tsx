import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { 
  useGetSession,
  useGetInbox,
  getGetInboxQueryKey,
  useGetEmailStats,
  GetInboxFilter
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Shield, AlertTriangle, CheckCircle, Mail, Loader2,
  ChevronLeft, ChevronRight, BarChart3,
  BadgeAlert, Banknote, FishSymbol, Link2, Gift, ShieldAlert
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

// 垃圾邮件类型 → 颜色 + 图标
const SPAM_TYPE_CONFIG: Record<string, {
  bg: string;
  text: string;
  border: string;
  icon: React.ReactNode;
  label: string;
}> = {
  "金融诈骗": {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
    icon: <Banknote className="w-3 h-3" />,
    label: "金融诈骗",
  },
  "促销广告": {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
    icon: <BadgeAlert className="w-3 h-3" />,
    label: "促销广告",
  },
  "账号钓鱼": {
    bg: "bg-yellow-500/15",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    icon: <FishSymbol className="w-3 h-3" />,
    label: "账号钓鱼",
  },
  "诈骗链接": {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/30",
    icon: <Link2 className="w-3 h-3" />,
    label: "诈骗链接",
  },
  "虚假中奖": {
    bg: "bg-pink-500/15",
    text: "text-pink-400",
    border: "border-pink-500/30",
    icon: <Gift className="w-3 h-3" />,
    label: "虚假中奖",
  },
  "一般垃圾邮件": {
    bg: "bg-destructive/15",
    text: "text-destructive",
    border: "border-destructive/30",
    icon: <ShieldAlert className="w-3 h-3" />,
    label: "垃圾邮件",
  },
};

function SpamTypeBadge({ spamType, isSpam }: { spamType?: string; isSpam: boolean }) {
  if (!isSpam) {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        安全
      </Badge>
    );
  }
  const cfg = (spamType && SPAM_TYPE_CONFIG[spamType])
    ? SPAM_TYPE_CONFIG[spamType]
    : SPAM_TYPE_CONFIG["一般垃圾邮件"];
  return (
    <Badge variant="outline" className={`${cfg.bg} ${cfg.text} ${cfg.border} flex items-center gap-1`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<GetInboxFilter>(GetInboxFilter.all);
  const limit = 20;

  const { data: session, isLoading: sessionLoading } = useGetSession();
  
  useEffect(() => {
    if (!sessionLoading && !session?.connected) {
      setLocation("/");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: inboxData, isLoading: inboxLoading } = useGetInbox(
    { page, limit, filter },
    { query: { enabled: !!session?.connected, queryKey: getGetInboxQueryKey({ page, limit, filter }) } }
  );

  const { data: statsData, isLoading: statsLoading } = useGetEmailStats({
    query: { enabled: !!session?.connected }
  });

  const handleFilterChange = (value: string) => {
    setFilter(value as GetInboxFilter);
    setPage(1);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-red-400";
    if (score >= 50) return "text-orange-400";
    return "text-green-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-red-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-green-500";
  };

  const getLeftBarColor = (isSpam: boolean, spamType?: string) => {
    if (!isSpam) return "bg-green-500";
    const cfg = (spamType && SPAM_TYPE_CONFIG[spamType]) ? SPAM_TYPE_CONFIG[spamType] : SPAM_TYPE_CONFIG["一般垃圾邮件"];
    const map: Record<string, string> = {
      "金融诈骗": "bg-red-500",
      "促销广告": "bg-orange-500",
      "账号钓鱼": "bg-yellow-500",
      "诈骗链接": "bg-purple-500",
      "虚假中奖": "bg-pink-500",
      "一般垃圾邮件": "bg-destructive",
    };
    return map[spamType ?? ""] ?? "bg-destructive";
  };

  if (sessionLoading || (inboxLoading && !inboxData)) {
    return (
      <Layout>
        <div className="container mx-auto p-4 space-y-6">
          <Skeleton className="h-24 w-full bg-card" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-20 w-full bg-card" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const totalPages = inboxData ? Math.ceil(inboxData.total / limit) : 1;

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">总邮件</p>
                <div className="text-2xl font-bold mt-1">{statsData?.total ?? 0}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">垃圾邮件</p>
                <div className="text-2xl font-bold mt-1 text-destructive">{statsData?.spam ?? 0}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">正常邮件</p>
                <div className="text-2xl font-bold mt-1 text-green-500">{statsData?.ham ?? 0}</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 backdrop-blur border-border/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">垃圾率</p>
                <div className="text-2xl font-bold mt-1">
                  {statsData?.spamRate ? (statsData.spamRate * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 类型图例 */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1">分类说明:</span>
          {Object.entries(SPAM_TYPE_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-green-500/10 text-green-400 border-green-500/30">
            <CheckCircle className="w-3 h-3" />
            安全
          </span>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold">收件箱</h2>
          <Tabs value={filter} onValueChange={handleFilterChange} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value={GetInboxFilter.all} data-testid="tab-filter-all">全部</TabsTrigger>
              <TabsTrigger value={GetInboxFilter.spam} data-testid="tab-filter-spam">垃圾邮件</TabsTrigger>
              <TabsTrigger value={GetInboxFilter.ham} data-testid="tab-filter-ham">正常邮件</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {inboxLoading && (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!inboxLoading && inboxData?.emails.length === 0 && (
          <Card className="border-dashed border-2 bg-transparent">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">暂无邮件</h3>
              <p className="text-muted-foreground max-w-sm">没有找到符合条件的邮件。</p>
            </CardContent>
          </Card>
        )}

        {!inboxLoading && inboxData && inboxData.emails.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-2.5">
              {inboxData.emails.map((email) => (
                <Link key={email.uid} href={`/email/${email.uid}`}>
                  <Card
                    className="cursor-pointer hover:bg-accent/50 hover:border-primary/40 transition-all border-border bg-card group relative overflow-hidden"
                    data-testid={`email-item-${email.uid}`}
                  >
                    {/* 左侧颜色条 — 按垃圾类型着色 */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${getLeftBarColor(email.isSpam, email.spamType)}`} />

                    <CardContent className="p-4 sm:p-5 pl-5 flex flex-col sm:flex-row sm:items-center gap-3">

                      {/* 邮件信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{email.fromName || email.from}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(email.date), "MM月dd日 HH:mm", { locale: zhCN })}
                          </span>
                        </div>
                        <h4 className="text-sm font-medium mb-1 truncate text-foreground/90">{email.subject}</h4>
                        <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                      </div>

                      {/* 威胁评分 + 类型标签 */}
                      <div className="flex items-center gap-4 shrink-0 mt-2 sm:mt-0">
                        <div className="w-20 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">威胁</span>
                            <span className={`font-mono font-bold ${getScoreColor(email.spamScore)}`}>
                              {Math.round(email.spamScore)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getScoreBgColor(email.spamScore)} transition-all`}
                              style={{ width: `${email.spamScore}%` }}
                            />
                          </div>
                        </div>

                        <div className="w-[90px] flex justify-end">
                          <SpamTypeBadge spamType={email.spamType} isSpam={email.isSpam} />
                        </div>
                      </div>

                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 bg-card p-4 rounded-lg border border-border">
                <div className="text-sm text-muted-foreground">
                  第 {(page - 1) * limit + 1}–{Math.min(page * limit, inboxData.total)} 封，共 {inboxData.total} 封
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    上一页
                  </Button>
                  <span className="text-sm font-medium px-4">{page} / {totalPages}</span>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    下一页
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
