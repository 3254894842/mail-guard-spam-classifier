import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useConnectEmail, 
  useGetSession,
  ConnectEmailRequestProvider 
} from "@workspace/api-client-react";
import { Shield, Mail, Key, Loader2, AlertCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";

const formSchema = z.object({
  email: z.string().email({ message: "请输入有效的邮箱地址" }),
  password: z.string().min(1, { message: "请输入授权码或密码" }),
  provider: z.nativeEnum(ConnectEmailRequestProvider)
});

const PROVIDER_TIPS: Record<string, { title: string; steps: string[]; url?: string; urlText?: string }> = {
  [ConnectEmailRequestProvider.qq]: {
    title: "QQ 邮箱授权码获取方式",
    steps: [
      "登录 QQ 邮箱网页版 → 点击右上角「设置」",
      "选择「账户」标签页 → 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」",
      "开启「IMAP/SMTP服务」→ 按提示发送短信验证",
      "验证成功后页面会显示16位授权码，复制粘贴到此处",
    ],
    url: "https://wx.mail.qq.com/list/readtemplate?name=app_intro.html&utm_medium=infobar",
    urlText: "QQ邮箱帮助中心",
  },
  [ConnectEmailRequestProvider.NUMBER_163]: {
    title: "163 邮箱授权码获取方式",
    steps: [
      "登录 163 邮箱 → 点击顶部「设置」→「POP3/SMTP/IMAP」",
      "开启「IMAP/SMTP服务」",
      "按提示完成手机验证",
      "系统会显示授权码（非登录密码），请复制后填入此处",
    ],
  },
  [ConnectEmailRequestProvider.NUMBER_126]: {
    title: "126 邮箱授权码获取方式",
    steps: [
      "登录 126 邮箱 → 点击「设置」→「POP3/SMTP/IMAP」",
      "开启「IMAP/SMTP服务」",
      "按照提示进行手机短信验证",
      "获得授权码后填入此处（不是登录密码）",
    ],
  },
  [ConnectEmailRequestProvider.gmail]: {
    title: "Gmail 应用专用密码获取方式",
    steps: [
      "登录 Google 账号 → 进入「安全性」设置",
      "确保已开启「两步验证」",
      "搜索「应用专用密码」→ 选择「邮件」和您的设备",
      "Google 会生成16位密码，将其填入此处（而非 Gmail 登录密码）",
    ],
    url: "https://myaccount.google.com/apppasswords",
    urlText: "前往生成应用专用密码",
  },
  [ConnectEmailRequestProvider.outlook]: {
    title: "Outlook 连接说明",
    steps: [
      "Outlook 个人账号可直接使用登录密码",
      "如开启了两步验证，需在账号安全中心生成「应用密码」",
      "企业版 Office 365 账号请联系管理员开启 IMAP 权限",
    ],
  },
  [ConnectEmailRequestProvider.sina]: {
    title: "新浪邮箱授权码获取方式",
    steps: [
      "登录新浪邮箱 → 点击「设置」→「客户端/POP/IMAP」",
      "开启 IMAP 服务并设置客户端授权码",
      "将生成的授权码填入此处",
    ],
  },
};

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>(ConnectEmailRequestProvider.auto);
  
  const { data: session, isLoading: sessionLoading } = useGetSession();
  const connectMutation = useConnectEmail();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      provider: ConnectEmailRequestProvider.auto,
    },
  });

  useEffect(() => {
    if (session?.connected) {
      setLocation("/inbox");
    }
  }, [session, setLocation]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setErrorMsg("");
    connectMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        toast({
          title: "连接成功",
          description: `成功连接至 ${data.providerName}，共发现 ${data.totalEmails} 封邮件`,
        });
        setLocation("/inbox");
      },
      onError: (error) => {
        setErrorMsg(error?.error || "连接失败，请检查邮箱和授权码是否正确");
        toast({
          variant: "destructive",
          title: "连接失败",
          description: error?.error || "请检查邮箱和授权码是否正确",
        });
      }
    });
  };

  if (sessionLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const providerTip = PROVIDER_TIPS[selectedProvider];

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md space-y-5">
          {/* 标题 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4 ring-1 ring-primary/30">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">邮件卫士</h1>
            <p className="text-muted-foreground">智能分析，精准拦截，为您守护纯净的收件箱</p>
          </div>

          {/* 连接表单 */}
          <Card className="border-border shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>连接您的邮箱</CardTitle>
              <CardDescription>
                请使用您的邮箱地址和 IMAP 授权码进行连接
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <Alert variant="destructive" className="mb-6 bg-destructive/10 text-destructive border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>出错了</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱服务商</FormLabel>
                        <Select 
                          onValueChange={(v) => { field.onChange(v); setSelectedProvider(v); }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-provider">
                              <SelectValue placeholder="选择服务商" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={ConnectEmailRequestProvider.auto}>自动检测 (推荐)</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.qq}>QQ 邮箱</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.NUMBER_163}>163 邮箱</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.NUMBER_126}>126 邮箱</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.gmail}>Gmail</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.outlook}>Outlook</SelectItem>
                            <SelectItem value={ConnectEmailRequestProvider.sina}>新浪邮箱</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱地址</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="your.email@example.com" className="pl-9" data-testid="input-email" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>授权码 / 密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="IMAP 授权码" className="pl-9" data-testid="input-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full mt-6" 
                    disabled={connectMutation.isPending}
                    data-testid="button-submit-connect"
                  >
                    {connectMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在连接...
                      </>
                    ) : (
                      "连接并扫描"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* 动态授权码提示卡片 */}
          {providerTip && (
            <Card className="border-border/60 bg-primary/5 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardContent className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <h3 className="text-sm font-semibold text-primary">{providerTip.title}</h3>
                </div>
                <ol className="space-y-1.5 mb-3">
                  {providerTip.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="shrink-0 font-bold text-primary/80 font-mono">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
                {providerTip.url && (
                  <a
                    href={providerTip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {providerTip.urlText}
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* 隐私提示 */}
          <p className="text-center text-xs text-muted-foreground px-4">
            您的授权码仅用于本次 IMAP 会话，不会被持久化存储。
          </p>
        </div>
      </div>
    </Layout>
  );
}
