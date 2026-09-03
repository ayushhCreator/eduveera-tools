import Link from "next/link";
import { getCreditPacks, getMyPayments } from "@/lib/payments/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BuyCreditsForm } from "./buy-credits-form";

export default async function BuyCreditsPage() {
  const [packs, payments] = await Promise.all([getCreditPacks(), getMyPayments(0, 10)]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Buy credits / क्रेडिट खरीदें</h1>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link href="/dashboard">Back to dashboard / डैशबोर्ड पर वापस</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pay via UPI, then submit your UTR</CardTitle>
          <CardDescription>
            An admin reviews and approves your payment manually. Credits are added once approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BuyCreditsForm packs={packs} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Your payment history / आपका भुगतान इतिहास</h2>
        {payments.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments submitted yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>UTR</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>₹{p.amount_inr}</TableCell>
                  <TableCell>{p.credits_requested}</TableCell>
                  <TableCell className="font-mono text-sm">{p.utr}</TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"
                      }
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
