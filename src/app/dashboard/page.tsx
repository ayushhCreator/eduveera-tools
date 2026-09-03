import Link from "next/link";
import { getCreditBalance } from "@/lib/credits/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const TOOLS = [
  {
    href: "/tools/image-compressor",
    title: "Image Compressor",
    titleHi: "इमेज कंप्रेसर",
    description: "Shrink a photo below a target size.",
  },
  {
    href: "/tools/passport-photo",
    title: "Passport Photo",
    titleHi: "पासपोर्ट फोटो",
    description: "Crop and generate a passport-style photo.",
  },
  {
    href: "/tools/hindi-converter",
    title: "Hindi Converter",
    titleHi: "हिंदी कनवर्टर",
    description: "Unicode ↔ Kruti Dev conversion.",
  },
];

export default async function DashboardPage() {
  const balanceResult = await getCreditBalance();
  const balance = balanceResult.success ? balanceResult.balance : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard / डैशबोर्ड</h1>
        <p className="text-sm text-muted-foreground">Your credits and tools / आपके क्रेडिट और टूल्स</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Credit balance / क्रेडिट बैलेंस</p>
            <p className="text-3xl font-bold">{balance ?? "—"}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/profile">History / इतिहास</Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard/buy-credits">Buy credits / क्रेडिट खरीदें</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-medium">Tools / टूल्स</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {TOOLS.map((tool) => (
            <Card key={tool.href}>
              <CardHeader>
                <CardTitle className="text-base">{tool.title}</CardTitle>
                <CardDescription>{tool.titleHi}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">{tool.description}</p>
                <Button asChild className="w-full">
                  <Link href={tool.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
