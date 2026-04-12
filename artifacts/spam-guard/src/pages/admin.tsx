import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetSession,
  useListUsers,
  getListUsersQueryKey,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useUnlockUser,
  AppUserRole,
  CreateUserRequestRole,
  AppUser
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Layout } from "@/components/layout";
import { 
  Shield, 
  Users, 
  UserPlus, 
  Lock, 
  Unlock, 
  Trash2, 
  Settings2, 
  Loader2, 
  MoreVertical,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const createUserSchema = z.object({
  username: z.string().min(3, { message: "用户名至少3个字符" }).max(20),
  email: z.string().email({ message: "请输入有效的邮箱" }).optional().or(z.literal("")),
  password: z.string().min(6, { message: "密码至少6个字符" }),
  role: z.nativeEnum(CreateUserRequestRole)
});

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: session, isLoading: sessionLoading } = useGetSession();
  
  useEffect(() => {
    if (!sessionLoading && !session?.adminUser) {
      setLocation("/admin/login");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: usersData, isLoading: usersLoading } = useListUsers({
    query: { enabled: !!session?.adminUser }
  });

  const createUserMutation = useCreateUser();
  const deleteUserMutation = useDeleteUser();
  const unlockUserMutation = useUnlockUser();
  const updateUserMutation = useUpdateUser();

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      role: CreateUserRequestRole.user,
    },
  });

  const onCreateSubmit = (values: z.infer<typeof createUserSchema>) => {
    // Transform empty email to undefined
    const submitData = {
      ...values,
      email: values.email === "" ? undefined : values.email
    };
    
    createUserMutation.mutate({ data: submitData }, {
      onSuccess: () => {
        toast({ title: "用户创建成功" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ 
          variant: "destructive", 
          title: "创建失败", 
          description: err.error || "未知错误" 
        });
      }
    });
  };

  const handleDeleteUser = (id: number) => {
    deleteUserMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "用户已删除" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "删除失败", description: err.error });
      }
    });
  };

  const handleUnlockUser = (id: number) => {
    unlockUserMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "账号已解锁", description: "登录尝试次数已重置" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "解锁失败", description: err.error });
      }
    });
  };

  const handleRoleChange = (id: number, newRole: AppUserRole) => {
    updateUserMutation.mutate({ id, data: { role: newRole as any } }, {
      onSuccess: () => {
        toast({ title: "角色已更新" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "更新失败", description: err.error });
      }
    });
  };

  if (sessionLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-4 max-w-6xl mt-8">
          <Skeleton className="h-10 w-64 mb-8 bg-card" />
          <Skeleton className="h-[400px] w-full bg-card" />
        </div>
      </Layout>
    );
  }

  if (!session?.adminUser) return null;

  return (
    <Layout>
      <div className="container mx-auto p-4 max-w-6xl py-8 animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
              <Settings2 className="w-8 h-8 text-primary" />
              系统管理面板
            </h1>
            <p className="text-muted-foreground">管理系统用户、角色和安全状态。</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user-modal">
                <UserPlus className="mr-2 h-4 w-4" />
                新增用户
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-border bg-card">
              <DialogHeader>
                <DialogTitle>创建系统用户</DialogTitle>
                <DialogDescription>
                  添加新的系统操作员或管理员账号。
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>用户名</FormLabel>
                        <FormControl>
                          <Input placeholder="输入登录账号" {...field} data-testid="input-new-username" />
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
                        <FormLabel>初始密码</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="不少于6位" {...field} data-testid="input-new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系邮箱 (可选)</FormLabel>
                        <FormControl>
                          <Input placeholder="contact@example.com" {...field} data-testid="input-new-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>系统角色</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-new-role">
                              <SelectValue placeholder="选择角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CreateUserRequestRole.user}>普通用户 (User)</SelectItem>
                            <SelectItem value={CreateUserRequestRole.admin}>管理员 (Admin)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="mt-6">
                    <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-new-user">
                      {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      确认创建
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                用户列表
              </CardTitle>
              <CardDescription>
                共 {usersData?.total || 0} 个系统账号
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>用户名</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="hidden md:table-cell">失败尝试</TableHead>
                      <TableHead className="hidden lg:table-cell">创建时间</TableHead>
                      <TableHead className="hidden lg:table-cell">最后登录</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users.map((user) => (
                      <TableRow key={user.id} className="border-border/50 hover:bg-muted/30">
                        <TableCell className="font-mono text-muted-foreground">{user.id}</TableCell>
                        <TableCell>
                          <div className="font-medium">{user.username}</div>
                          {user.email && <div className="text-xs text-muted-foreground">{user.email}</div>}
                        </TableCell>
                        <TableCell>
                          {user.role === AppUserRole.admin ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">管理员</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-secondary text-secondary-foreground border-border">普通用户</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isLocked ? (
                            <Badge variant="destructive" className="bg-destructive/20 text-destructive border-none flex items-center w-fit gap-1">
                              <Lock className="w-3 h-3" />
                              已锁定
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-none flex items-center w-fit gap-1">
                              <Shield className="w-3 h-3" />
                              正常
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className={user.loginAttempts > 0 ? "text-orange-500 font-bold" : "text-muted-foreground"}>
                            {user.loginAttempts}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'yyyy-MM-dd HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`dropdown-user-${user.id}`}>
                                <span className="sr-only">打开菜单</span>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-border bg-popover">
                              <DropdownMenuLabel>用户管理</DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-border" />
                              
                              {user.isLocked && (
                                <DropdownMenuItem 
                                  onClick={() => handleUnlockUser(user.id)}
                                  className="text-green-500 focus:text-green-500 focus:bg-green-500/10 cursor-pointer"
                                  data-testid={`action-unlock-${user.id}`}
                                >
                                  <Unlock className="mr-2 h-4 w-4" />
                                  <span>解除锁定</span>
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem 
                                onClick={() => handleRoleChange(user.id, user.role === AppUserRole.admin ? AppUserRole.user : AppUserRole.admin)}
                                className="cursor-pointer"
                                data-testid={`action-role-${user.id}`}
                                disabled={session.adminUser?.id === user.id} // Can't change own role
                              >
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                <span>设为{user.role === AppUserRole.admin ? '普通用户' : '管理员'}</span>
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-border" />
                              
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem 
                                    onSelect={(e) => e.preventDefault()} 
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                    data-testid={`action-delete-${user.id}`}
                                    disabled={session.adminUser?.id === user.id} // Can't delete self
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>删除用户</span>
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="border-border bg-card">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除用户？</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      此操作不可逆。删除用户 "{user.username}" 后，该账号将无法再登录系统。
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border bg-transparent">取消</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      确认删除
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
