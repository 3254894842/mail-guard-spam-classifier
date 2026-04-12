import { Link, useLocation } from "wouter";
import { useGetSession, useDisconnectEmail, useAdminLogout } from "@workspace/api-client-react";
import { Shield, Inbox as InboxIcon, Edit3, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const disconnectMutation = useDisconnectEmail();
  const logoutMutation = useAdminLogout();

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
      },
    });
  };

  const handleAdminLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/admin/login");
      },
    });
  };

  const isAdmin = location.startsWith("/admin");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground dark">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight text-white">邮件卫士</span>
          </div>

          <div className="flex items-center gap-6">
            {!isLoading && (
              <>
                {isAdmin ? (
                  <>
                    {session?.adminUser && (
                      <>
                        <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                          管理面板
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleAdminLogout}
                          data-testid="button-admin-logout"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          退出管理
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {session?.connected ? (
                      <>
                        <nav className="flex items-center gap-4">
                          <Link href="/inbox" className={`text-sm font-medium transition-colors ${location === '/inbox' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                            <span className="flex items-center gap-1.5"><InboxIcon className="w-4 h-4" /> 收件箱</span>
                          </Link>
                          <Link href="/classify" className={`text-sm font-medium transition-colors ${location === '/classify' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                            <span className="flex items-center gap-1.5"><Edit3 className="w-4 h-4" /> 手动检测</span>
                          </Link>
                        </nav>
                        <div className="flex items-center gap-3 border-l border-border pl-6 ml-2">
                          <div className="text-xs text-muted-foreground text-right hidden md:block">
                            <div>已连接至 <span className="text-foreground">{session.providerName}</span></div>
                            <div className="font-medium text-foreground">{session.userEmail}</div>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleDisconnect}
                            disabled={disconnectMutation.isPending}
                            data-testid="button-disconnect"
                            className="border-border hover:bg-destructive/20 hover:text-destructive hover:border-destructive"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            断开连接
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Link href="/admin/login">
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          <Settings className="w-4 h-4 mr-2" />
                          管理员登录
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
            {isLoading && <Skeleton className="h-8 w-32 bg-muted" />}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
