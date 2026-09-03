import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

/**
 * Gate for the whole /admin section. This is UX/defense-in-depth only —
 * the actual security boundary is requireAdmin() called independently
 * inside every Server Action and query in src/lib/admin/queries.ts and
 * src/lib/credits/actions.ts. Never rely on this layout alone to protect
 * an admin operation (SECURITY.md § 2, AI_RULES.md rule 13).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4">
        <Link href="/admin" className="font-semibold">
          Admin
        </Link>
        <Link href="/admin/payments" className="text-sm text-muted-foreground hover:text-foreground">
          Pending Payments
        </Link>
      </nav>
      {children}
    </div>
  );
}
