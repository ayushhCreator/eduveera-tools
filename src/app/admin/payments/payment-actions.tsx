"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { approvePayment, rejectPayment } from "@/lib/credits/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const router = useRouter();

  function handleApprove() {
    startTransition(async () => {
      const result = await approvePayment(paymentId);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(`Approved — granted ${result.creditsGranted} credits`);
      router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectPayment(paymentId);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success("Payment rejected");
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        Approve
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" disabled={isPending}>
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this payment?</DialogTitle>
            <DialogDescription>
              This cannot be undone. No credits will be granted for this submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? "Rejecting…" : "Confirm reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
