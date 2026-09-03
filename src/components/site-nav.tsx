import Link from "next/link";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { MobileNav, type NavLink } from "@/components/mobile-nav";

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tools/image-compressor", label: "Image compressor" },
  { href: "/tools/passport-photo", label: "Passport photo" },
  { href: "/tools/hindi-converter", label: "Hindi converter" },
  { href: "/dashboard/buy-credits", label: "Buy credits" },
  { href: "/profile", label: "Profile" },
];

/** Global nav. Renders nothing when signed out, so /login and /signup stay bare. */
export async function SiteNav() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = await isCurrentUserAdmin();
  const links = isAdmin ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl px-4">
        {/* tablet / desktop */}
        <nav className="hidden h-14 items-center gap-1 md:flex">
          <Link href="/dashboard" className="mr-3 font-semibold tracking-tight">
            Eduveera<span className="text-muted-foreground"> Tools</span>
          </Link>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <span className="max-w-[16ch] truncate text-sm text-muted-foreground lg:max-w-none">{user.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          </div>
        </nav>

        {/* phone */}
        <MobileNav email={user.email ?? ""} links={links} />
      </div>
    </header>
  );
}
