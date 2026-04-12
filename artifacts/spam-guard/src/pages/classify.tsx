import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetSession,
  useClassifyEmail,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { 
  Shield, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  AlertOctagon, 
  Loader2, 
  RefreshCw,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  subject: z.string().optional(),
  from: z.string().optional(),
  text: z.string().min(10, { message: "请输入至少10个字符的邮件内容以进行准确分析" }),
});

export default function Classify() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useGetSession();
  
  useEffect(() => {
    if (!sessionLoading && !session?.connected) {
      setLocation("/");
    }
  }, [session, sessionLoading, setLocation]);

  const classifyMutation = useClassifyEmail();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      from: "",
      text: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    classifyMutation.mutate({ data: values });
  };

  const handleReset = () => {
    form.reset();
    classifyMutation.reset();
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

  const result = classifyMutation.data;

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-5xl animate-in fade-in duration-500 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            手动智能检测
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            将可疑邮件的内容粘贴至下方，邮件卫士将通过算法引擎实时分析其风险程度，并给出详细判断依据。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Input Form */}
          <Card className="border-border bg-card shadow-lg">
            <CardHeader>
              <CardTitle>输入邮件信息</CardTitle>
              <CardDescription>提供的信息越完整，分析结果越准确</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="from"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>发件人 (可选)</FormLabel>
                          <FormControl>
                            <Input placeholder="example@domain.com" {...field} data-testid="input-classify-from" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>主题 (可选)</FormLabel>
                          <FormControl>
                            <Input placeholder="邮件标题" {...field} data-testid="input-classify-subject" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮件正文内容 <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="请粘贴邮件的纯文本内容..." 
                            className="min-h-[250px] font-mono text-sm resize-none"
                            data-testid="input-classify-text"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4 pt-2">
                    <Button 
                      type="submit" 
                      className="flex-1 font-semibold" 
                      disabled={classifyMutation.isPending}
                      data-testid="button-classify-submit"
                    >
                      {classifyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          正在分析...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          开始检测
                        </>
                      )}
                    </Button>
                    {result && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleReset}
                        data-testid="button-classify-reset"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        清空
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Results Area */}
          <div>
            {!result && !classifyMutation.isPending && !classifyMutation.isError && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-xl bg-card/30">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <Shield className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-foreground/80">等待检测</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  在左侧输入需要检测的邮件信息并点击提交，分析结果将在这里显示。
                </p>
              </div>
            )}

            {classifyMutation.isPending && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-primary/20 animate-pulse"></div>
                  <Shield className="h-16 w-16 text-primary animate-pulse relative z-10" />
                </div>
                <h3 className="text-xl font-semibold mt-8 mb-2">安全引擎分析中</h3>
                <p className="text-muted-foreground text-sm">正在应用启发式规则和模式匹配...</p>
                <div className="w-48 h-1 bg-muted mt-6 rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse rounded-full w-full"></div>
                </div>
              </div>
            )}

            {classifyMutation.isError && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center border border-destructive/30 rounded-xl bg-destructive/5">
                <AlertOctagon className="h-16 w-16 text-destructive mb-6" />
                <h3 className="text-xl font-semibold mb-2">检测失败</h3>
                <p className="text-muted-foreground text-sm">
                  分析引擎在处理您的请求时遇到错误，请稍后再试。
                </p>
              </div>
            )}

            {result && !classifyMutation.isPending && (
              <Card className={`border-2 shadow-xl animate-in fade-in zoom-in-95 duration-300 ${result.isSpam ? 'border-destructive/50 bg-destructive/5' : 'border-green-500/50 bg-green-500/5'}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>分析报告</CardTitle>
                    {result.isSpam ? (
                      <Badge variant="destructive" className="bg-destructive hover:bg-destructive text-white border-none py-1.5 px-3 text-sm flex items-center gap-1.5 shadow-lg shadow-destructive/20">
                        <AlertTriangle className="w-4 h-4" />
                        垃圾邮件
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500 hover:bg-green-600 text-white border-none py-1.5 px-3 text-sm flex items-center gap-1.5 shadow-lg shadow-green-500/20">
                        <CheckCircle className="w-4 h-4" />
                        安全邮件
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 pt-2">
                  
                  {/* Score */}
                  <div className="space-y-3 bg-card p-5 rounded-xl border border-border shadow-sm">
                    <div className="flex justify-between items-end">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">THREAT SCORE</h4>
                        <div className="text-sm">危险指数评估</div>
                      </div>
                      <div className={`text-5xl font-black font-mono tracking-tighter ${result.isSpam ? 'text-destructive' : 'text-green-500'}`}>
                        {Math.round(result.spamScore)}
                      </div>
                    </div>
                    <Progress 
                      value={result.spamScore} 
                      className={`h-3 ${result.isSpam ? '[&>div]:bg-destructive' : '[&>div]:bg-green-500'} bg-muted/50`} 
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>0.0</span>
                      <span>100.0</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-card p-4 rounded-xl border border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">CONFIDENCE</h4>
                      <div className="text-2xl font-bold font-mono">{(result.confidence * 100).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground mt-1">模型置信度</div>
                    </div>
                    {result.spamType && (
                      <div className="bg-card p-4 rounded-xl border border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">CATEGORY</h4>
                        <div className="text-lg font-bold truncate" title={result.spamType}>{result.spamType}</div>
                        <div className="text-xs text-muted-foreground mt-1">分类类型</div>
                      </div>
                    )}
                  </div>

                  {/* Reasons */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2 border-b border-border pb-2">
                      <Search className="w-4 h-4 text-primary" />
                      判定依据
                    </h4>
                    {result.reasons && result.reasons.length > 0 ? (
                      <ul className="space-y-3 mt-4">
                        {result.reasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm p-3 bg-card border border-border rounded-lg shadow-sm">
                            <span className="mt-0.5 text-primary shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-primary/10 text-xs font-bold font-mono">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground italic p-4 text-center bg-card rounded-lg border border-border">
                        常规内容，未触发特定风险规则。
                      </p>
                    )}
                  </div>

                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
