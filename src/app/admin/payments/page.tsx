import Link from "next/link";
import { adminListPendingPayments } from "@/lib/admin/queries";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PaymentActions } from "./payment-actions";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam ?? 0) || 0;

  const { items: payments, total } = await adminListPendingPayments(page, 20);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Pending Payments</h1>

      <Card>
        <CardHeader>
          <CardTitle>{total} pending</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Credits requested</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No pending payments.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/users/${p.user_id}`} className="hover:underline">
                        {p.user?.name ?? p.user?.email ?? p.user_id}
                      </Link>
                    </TableCell>
                    <TableCell>{p.amount_inr}</TableCell>
                    <TableCell>{p.credits_requested}</TableCell>
                    <TableCell>{p.utr ?? "—"}</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <PaymentActions paymentId={p.id} />
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
