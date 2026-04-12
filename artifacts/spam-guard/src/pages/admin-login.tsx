import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAdminLogin } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Shield, Lock, User, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  username: z.string().min(1, { message: "请输入管理员账号" }),
  password: z.string().min(1, { message: "请输入密码" }),
});

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = useAdminLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setErrorMsg("");
    loginMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({
          title: "登录成功",
          description: "欢迎回来，系统管理员",
        });
        setLocation("/admin");
      },
      onError: (error) => {
        setErrorMsg(error?.error || "账号或密码错误");
      }
    });
  };

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-accent text-primary mb-4 transform rotate-12">
              <Lock className="w-8 h-8 -rotate-12" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">安全管理中心</h1>
            <p className="text-muted-foreground">请输入管理员凭证以访问系统后台</p>
          </div>

          <Card className="border-border shadow-2xl bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">管理员登录</CardTitle>
              <CardDescription>
                此入口仅供系统管理员使用，非邮箱 IMAP 登录。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorMsg && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>认证失败</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>管理账号</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="admin" className="pl-9 bg-muted/50" data-testid="input-admin-username" {...field} />
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
                        <FormLabel>密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="password" placeholder="••••••••" className="pl-9 bg-muted/50" data-testid="input-admin-password" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full mt-6" 
                    disabled={loginMutation.isPending}
                    data-testid="button-admin-submit"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        验证中...
                      </>
                    ) : (
                      "登 录"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
          
          <div className="mt-8 text-center">
            <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => setLocation("/")}>
              返回首页连接邮箱
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
