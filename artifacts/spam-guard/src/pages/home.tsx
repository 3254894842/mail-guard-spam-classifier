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
import { Shield, Mail, Key, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState("");
  
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

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-4 ring-1 ring-primary/30">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">邮件卫士</h1>
            <p className="text-muted-foreground">智能分析，精准拦截，为您守护纯净的收件箱</p>
          </div>

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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <p className="text-[10px] text-muted-foreground mt-1">
                          对于国内邮箱（如QQ、163），请使用开启 IMAP 服务时生成的授权码，而非登录密码。
                        </p>
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
        </div>
      </div>
    </Layout>
  );
}
