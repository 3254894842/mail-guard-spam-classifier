import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ShieldOff, Home } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
          <ShieldOff className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-5xl font-black text-foreground mb-3 font-mono">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">页面不存在</h2>
        <p className="text-muted-foreground max-w-sm mb-8">
          您访问的页面不存在或已被移除，请返回首页重新操作。
        </p>
        <Link href="/">
          <Button>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
        </Link>
      </div>
    </Layout>
  );
}
