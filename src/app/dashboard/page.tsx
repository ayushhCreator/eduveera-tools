import { getCurrentUser } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

// Barebones for Phase 3 (protected route + session plumbing). Balance,
// transaction history, tool usage, and tool cards are built in Phase 5.
export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard / डैशबोर्ड</h1>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Log out
          </Button>
        </form>
      </div>
      <p className="mt-4 text-muted-foreground">Signed in as {user?.email}</p>
    </div>
  );
}
