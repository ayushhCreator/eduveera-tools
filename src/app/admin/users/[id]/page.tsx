import { notFound } from "next/navigation";
import { adminGetUser } from "@/lib/admin/queries";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AdjustCreditsForm } from "./adjust-credits-form";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await adminGetUser(id);
  if (!data) notFound();

  const { profile, balance, transactions, toolUsage, payments } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{profile.name ?? profile.email}</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
        {profile.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={profile.status === "active" ? "secondary" : "destructive"}>{profile.status}</Badge>
          <span className="text-sm">Balance: {balance}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjust credits</CardTitle>
        </CardHeader>
        <CardContent>
          <AdjustCreditsForm userId={profile.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent credit transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Balance after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No transactions.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell>{t.amount}</TableCell>
                    <TableCell>{t.reason}</TableCell>
                    <TableCell>{t.balance_after}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent tool usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credits charged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {toolUsage.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No tool usage.
                  </TableCell>
                </TableRow>
              ) : (
                toolUsage.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{new Date(u.created_at).toLocaleString()}</TableCell>
                    <TableCell>{u.tool}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "success" ? "secondary" : "destructive"}>{u.status}</Badge>
                    </TableCell>
                    <TableCell>{u.credits_charged}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Credits requested</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No payments.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                    <TableCell>{p.amount_inr}</TableCell>
                    <TableCell>{p.credits_requested}</TableCell>
                    <TableCell>{p.utr ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.status === "approved" ? "secondary" : p.status === "rejected" ? "destructive" : "default"
                        }
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
