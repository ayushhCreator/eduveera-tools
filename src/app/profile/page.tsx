import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getCreditBalance, getMyTransactions, getMyToolUsage } from "@/lib/credits/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export default async function ProfilePage() {
  const [user, balanceResult, transactions, toolUsage] = await Promise.all([
    getCurrentUser(),
    getCreditBalance(),
    getMyTransactions(0, 20),
    getMyToolUsage(0, 20),
  ]);

  const balance = balanceResult.success ? balanceResult.balance : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Profile / प्रोफ़ाइल</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Credit balance / क्रेडिट बैलेंस</p>
            <p className="text-3xl font-bold">{balance ?? "—"}</p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/buy-credits">Buy credits / क्रेडिट खरीदें</Link>
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Recent transactions / हाल के लेनदेन</h2>
        {transactions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Balance after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.items.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.type === "credit" ? "default" : "secondary"}>{tx.type}</Badge>
                  </TableCell>
                  <TableCell className={tx.amount > 0 ? "text-green-600" : "text-red-600"}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </TableCell>
                  <TableCell className="text-sm">{tx.reason}</TableCell>
                  <TableCell className="text-right">{tx.balance_after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="mb-3 text-lg font-medium">Recent tool activity / हाल की गतिविधि</h2>
        {toolUsage.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tool activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Credits charged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {toolUsage.items.map((usage) => (
                <TableRow key={usage.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(usage.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{usage.tool}</TableCell>
                  <TableCell>
                    <Badge variant={usage.status === "success" ? "default" : "destructive"}>{usage.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{usage.credits_charged}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
