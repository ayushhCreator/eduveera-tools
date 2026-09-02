"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { submitUtrPayment } from "@/lib/payments/actions";
import { UPI_PAYEE } from "@/lib/payments/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Pack {
  id: string;
  label: string;
  price_inr: string;
  credits: number;
}

export function BuyCreditsForm({ packs }: { packs: Pack[] }) {
  const router = useRouter();
  const [selectedPackId, setSelectedPackId] = useState(packs[0]?.id ?? "");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackId) {
      toast.error("Choose a credit pack first.");
      return;
    }
    setSubmitting(true);
    const result = await submitUtrPayment(selectedPackId, utr);
    setSubmitting(false);

    if (!result.success) {
      const messages: Record<string, string> = {
        invalid_utr_format: "UTR looks wrong — it should be 6–32 letters/numbers.",
        utr_already_submitted: "This UTR was already submitted.",
        invalid_or_inactive_pack: "That pack isn't available anymore, pick another.",
      };
      toast.error(messages[result.message] ?? result.message);
      return;
    }

    toast.success("Payment submitted — an admin will review it shortly.");
    setUtr("");
    router.refresh();
  }

  if (packs.length === 0) {
    return <p className="text-sm text-muted-foreground">No credit packs are configured yet.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>1. Choose a pack</Label>
        <RadioGroup value={selectedPackId} onValueChange={setSelectedPackId}>
          {packs.map((pack) => (
            <div key={pack.id} className="flex items-center space-x-2 rounded-md border p-3">
              <RadioGroupItem value={pack.id} id={pack.id} />
              <Label htmlFor={pack.id} className="flex-1 cursor-pointer font-normal">
                {pack.label} — ₹{pack.price_inr} for {pack.credits} credits
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">2. Pay via UPI</p>
        <p>
          UPI ID: <span className="font-mono">{UPI_PAYEE.vpa}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Payee details are provisional — confirm with the client before launch (see TODO.md, blocker M5).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="utr">3. Enter your UTR / UPI transaction reference</Label>
        <Input
          id="utr"
          required
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="e.g. 123456789012"
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit payment"}
      </Button>
    </form>
  );
}
