import Link from "next/link";
import { adminListUsers, adminGetToolUsageStats, adminCountPendingPayments } from "@/lib/admin/queries";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Number(pageParam ?? 0) || 0;

  const [{ items: users, total }, toolStats, pendingCount] = await Promise.all([
    adminListUsers(q, page, 20),
    adminGetToolUsageStats(),
    adminCountPendingPayments(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Dashboard</h1>
        <Link href="/admin/payments">
          <Badge variant={pendingCount > 0 ? "default" : "secondary"} className="text-sm">
            {pendingCount} pending payment{pendingCount === 1 ? "" : "s"}
          </Badge>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tool usage</CardTitle>
        </CardHeader>
        <CardContent>
          {toolStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tool usage yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Success</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toolStats.map((s) => (
                  <TableRow key={s.tool}>
                    <TableCell>{s.tool}</TableCell>
                    <TableCell>{s.successCount}</TableCell>
                    <TableCell>{s.failedCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="flex gap-2">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by name, email, or phone" className="max-w-sm" />
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/users/${u.id}`} className="block hover:underline">
                        {u.name ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/users/${u.id}`} className="block hover:underline">
                        {u.email}
                      </Link>
                    </TableCell>
                    <TableCell>{u.balance}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "secondary" : "destructive"}>{u.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <p className="text-sm text-muted-foreground">
            Showing {users.length} of {total}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
