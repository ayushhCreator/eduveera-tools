"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { adminAdjustCredits } from "@/lib/credits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

export function AdjustCreditsForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);

    if (!Number.isInteger(parsedAmount) || parsedAmount === 0) {
      toast.error("Amount must be a nonzero integer");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Reason is required");
      return;
    }

    startTransition(async () => {
      const result = await adminAdjustCredits(userId, parsedAmount, reason.trim());
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(`Balance updated to ${result.newBalance}`);
      setAmount("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (positive to add, negative to remove)</Label>
        <Input
          id="amount"
          type="number"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adjusting…" : "Adjust credits"}
      </Button>
    </form>
  );
}
