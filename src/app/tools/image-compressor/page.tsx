"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getCreditBalance, getToolPricing, settleToolUsage } from "@/lib/credits/actions";
import { pickPresetTargetKB, findCompressionTarget, type CompressPreset } from "@/lib/image/compress";
import { loadImageBitmap, makeCanvasEncoder } from "./encode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB, SECURITY.md § 10
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PRESETS: { value: Exclude<CompressPreset, "custom">; label: string }[] = [
  { value: "under_100kb", label: "Under 100 KB" },
  { value: "under_50kb", label: "Under 50 KB" },
  { value: "under_30kb", label: "Under 30 KB" },
];

type Gate = { loading: true } | { loading: false; balance: number; cost: number };

export default function ImageCompressorPage() {
  const [gate, setGate] = useState<Gate>({ loading: true });
  const [gateError, setGateError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<CompressPreset>("under_100kb");
  const [customKB, setCustomKB] = useState("");
  const [status, setStatus] = useState<"idle" | "compressing" | "done" | "failed">("idle");
  const [originalKB, setOriginalKB] = useState<number | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [finalKB, setFinalKB] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const originalUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [balanceResult, pricing] = await Promise.all([getCreditBalance(), getToolPricing()]);
        if (cancelled) return;
        if (!balanceResult.success) {
          setGateError(balanceResult.message);
          return;
        }
        setGate({ loading: false, balance: balanceResult.balance, cost: pricing.image_compressor });
      } catch {
        if (!cancelled) setGateError("Could not load credit balance. Please refresh.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    };
  }, []);

  function resetResult() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setDownloadUrl(null);
    setFinalKB(null);
    setQuality(null);
    setScale(null);
    setStatus("idle");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    resetResult();
    if (originalUrlRef.current) {
      URL.revokeObjectURL(originalUrlRef.current);
      originalUrlRef.current = null;
    }
    setOriginalUrl(null);
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      setOriginalKB(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      toast.error("Unsupported file type. Use JPG, PNG, or WebP. / असमर्थित फ़ाइल प्रकार");
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error("File too large. Max 15 MB. / फ़ाइल बहुत बड़ी है");
      e.target.value = "";
      return;
    }
    setFile(selected);
    setOriginalKB(selected.size / 1024);
    const url = URL.createObjectURL(selected);
    originalUrlRef.current = url;
    setOriginalUrl(url);
  }

  const customKBNumber = Number(customKB);
  const customKBValid = customKB.trim() !== "" && Number.isFinite(customKBNumber) && customKBNumber > 0;
  const canCompress =
    !gate.loading && gateError === null && file !== null && (preset !== "custom" || customKBValid);
  const insufficientCredits = !gate.loading && gateError === null && gate.balance < gate.cost;

  async function handleCompress() {
    if (!file || gate.loading) return;

    let targetKB: number;
    try {
      targetKB = pickPresetTargetKB(preset, preset === "custom" ? customKBNumber : undefined);
    } catch {
      toast.error("Enter a valid target size in KB.");
      return;
    }

    resetResult();
    setStatus("compressing");

    try {
      const img = await loadImageBitmap(file);
      const encoder = makeCanvasEncoder(img);
      const outcome = await findCompressionTarget(targetKB, encoder);

      if (!outcome.ok) {
        setStatus("failed");
        await settleToolUsage("image_compressor", "failed", {
          preset,
          originalKB: Math.round((originalKB ?? 0) * 10) / 10,
          note: "target_not_reachable",
        });
        toast.error("Could not compress below the target size. Try a larger target. / लक्ष्य आकार तक नहीं पहुँच सके");
        return;
      }

      const settled = await settleToolUsage("image_compressor", "success", {
        preset,
        originalKB: Math.round((originalKB ?? 0) * 10) / 10,
        finalKB: Math.round(outcome.result.sizeKB * 10) / 10,
      });

      if (!settled.success) {
        setStatus("failed");
        toast.error(settled.message || "Could not settle credits for this action.");
        return;
      }

      const url = URL.createObjectURL(outcome.result.blob);
      objectUrlRef.current = url;
      setDownloadUrl(url);
      setFinalKB(outcome.result.sizeKB);
      setQuality(outcome.attempt.quality);
      setScale(outcome.attempt.scale);
      setGate({ loading: false, balance: settled.newBalance, cost: gate.cost });
      setStatus("done");
      toast.success(`Compressed to ${Math.round(outcome.result.sizeKB)} KB. ${settled.creditsCharged} credit charged.`);
    } catch {
      setStatus("failed");
      await settleToolUsage("image_compressor", "failed", { preset, note: "client_error" });
      toast.error("Something went wrong while compressing. Please try another image.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Image Compressor / इमेज कंप्रेसर</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a photo, pick a target size, compress right in your browser. Nothing is uploaded to a server.
      </p>

      {gateError && (
        <Card className="mt-6 border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{gateError}</CardContent>
        </Card>
      )}

      {!gate.loading && !gateError && insufficientCredits && (
        <Card className="mt-6 border-destructive">
          <CardHeader>
            <CardTitle>Insufficient credits / अपर्याप्त क्रेडिट</CardTitle>
            <CardDescription>
              This tool costs {gate.cost} credit{gate.cost === 1 ? "" : "s"}. Your balance is {gate.balance}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <a href="/dashboard">Buy credits / क्रेडिट खरीदें</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1. Upload / फ़ोटो चुनें</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={gate.loading || !!gateError}
            className="h-auto py-2"
          />
          {originalKB !== null && (
            <p className="text-sm text-muted-foreground">Original size: {Math.round(originalKB)} KB</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2. Target size / लक्ष्य आकार</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                disabled={gate.loading || !!gateError}
                className={cn(
                  "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  preset === p.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset("custom")}
              disabled={gate.loading || !!gateError}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                preset === "custom"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              Custom
            </button>
          </div>

          {preset === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customKB">Custom target (KB) / कस्टम आकार</Label>
              <Input
                id="customKB"
                type="number"
                inputMode="numeric"
                min={1}
                value={customKB}
                onChange={(e) => setCustomKB(e.target.value)}
                placeholder="e.g. 75"
                aria-invalid={customKB.trim() !== "" && !customKBValid}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="mt-4 h-12 w-full text-base"
        size="lg"
        onClick={handleCompress}
        disabled={!canCompress || insufficientCredits || status === "compressing"}
      >
        {status === "compressing" ? "Compressing… / कंप्रेस हो रहा है…" : "Compress / कंप्रेस करें"}
      </Button>

      {status === "compressing" && (
        <div className="mt-3 space-y-2">
          <Progress value={undefined} className="animate-pulse" />
          <p className="text-center text-sm text-muted-foreground">
            Compressing in your browser — finding the highest quality that fits your target…
            <br />
            <span className="text-xs">ब्राउज़र में कंप्रेस हो रहा है…</span>
          </p>
        </div>
      )}

      {status === "done" && downloadUrl && originalUrl && finalKB !== null && originalKB !== null && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Done / पूरा हुआ</CardTitle>
            <CardDescription>
              {Math.round((1 - finalKB / originalKB) * 100)}% smaller
              {quality !== null && scale !== null && (
                <> · quality {Math.round(quality * 100)}%{scale < 1 ? ` · resized to ${Math.round(scale * 100)}%` : " · full resolution"}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <figure className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={originalUrl} alt="Before compression" className="aspect-square w-full rounded-md border object-contain bg-muted" />
                <figcaption className="text-center text-xs text-muted-foreground">
                  Before / पहले — {Math.round(originalKB)} KB
                </figcaption>
              </figure>
              <figure className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={downloadUrl} alt="After compression" className="aspect-square w-full rounded-md border object-contain bg-muted" />
                <figcaption className="text-center text-xs text-muted-foreground">
                  After / बाद में — {Math.round(finalKB)} KB
                </figcaption>
              </figure>
            </div>
            <Button asChild className="h-12 w-full text-base">
              <a href={downloadUrl} download={`compressed-${file?.name ?? "image"}.jpg`}>
                Download / डाउनलोड करें
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
