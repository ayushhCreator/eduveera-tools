import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

const TOOLS = [
  { href: "/tools/image-compressor", label: "Image compressor / इमेज कंप्रेसर" },
  { href: "/tools/passport-photo", label: "Passport photo / पासपोर्ट फोटो" },
  { href: "/tools/hindi-converter", label: "Hindi converter / हिंदी कनवर्टर" },
  { href: "/dashboard/buy-credits", label: "Buy credits / क्रेडिट खरीदें" },
];

/** Matches SiteNav: only shown to signed-in users; auth pages stay bare. */
export async function SiteFooter() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="font-semibold tracking-tight">
            Eduveera<span className="text-muted-foreground"> Tools</span>
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Compress an image, make a passport photo, convert Kruti Dev and Unicode Hindi.
            Files are processed in your browser, not stored.
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            इमेज कंप्रेस करें, पासपोर्ट फोटो बनाएं, कृति देव और यूनिकोड हिंदी बदलें।
            फ़ाइलें आपके ब्राउज़र में ही रहती हैं।
          </p>
        </div>
        <nav className="flex flex-col gap-2 text-sm sm:items-end">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="text-muted-foreground hover:text-foreground">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
