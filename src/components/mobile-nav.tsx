"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export interface NavLink {
  href: string;
  label: string;
}

/** Phone nav: a disclosure that closes itself on navigation. */
export function MobileNav({ email, links }: { email: string; links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center justify-between">
        <Link href="/dashboard" className="font-semibold tracking-tight">
          Eduveera<span className="text-muted-foreground"> Tools</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav-menu" className="flex flex-col gap-1 pb-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-2 text-sm hover:bg-muted"
              aria-current={pathname === l.href ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t pt-3">
            <p className="mb-2 px-2 text-xs text-muted-foreground break-all">{email}</p>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Log out
            </Button>
          </form>
        </nav>
      )}
    </div>
  );
}
