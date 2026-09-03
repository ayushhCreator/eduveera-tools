"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { toast } from "sonner";
import { getCreditBalance, getToolPricing, settleToolUsage } from "@/lib/credits/actions";
import { cropToPassportPhotoBlob, type CropArea } from "@/lib/passport/crop";
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES, PASSPORT_PHOTO_ASPECT } from "@/lib/passport/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

type Gate = { status: "loading" } | { status: "blocked"; balance: number; cost: number } | { status: "ready" };

export default function PassportPhotoPage() {
  const [gate, setGate] = useState<Gate>({ status: "loading" });
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadGate() {
      try {
        const [balanceResult, pricing] = await Promise.all([getCreditBalance(), getToolPricing()]);
        if (cancelled) return;

        if (!balanceResult.success) {
          toast.error(balanceResult.message);
          setGate({ status: "blocked", balance: 0, cost: pricing.passport_photo ?? 0 });
          return;
        }

        const cost = pricing.passport_photo ?? 0;
        setGate(
          balanceResult.balance < cost
            ? { status: "blocked", balance: balanceResult.balance, cost }
            : { status: "ready" },
        );
      } catch {
        if (cancelled) return;
        toast.error("Could not check your credit balance. Please refresh and try again. / क्रेडिट जांच नहीं हो सकी।");
        setGate({ status: "blocked", balance: 0, cost: 0 });
      }
    }
    loadGate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      toast.error("Unsupported file type. Use JPG, PNG, or WEBP. / असमर्थित फ़ाइल प्रकार।");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File is too large (max 15 MB). / फ़ाइल बहुत बड़ी है (अधिकतम 15 MB)।");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setResultUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }

  const onCropComplete = useCallback((_area: CropArea, areaPixels: CropArea) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleGenerate() {
    if (!imageSrc || !croppedAreaPixels) return;
    setWorking(true);

    try {
      const blob = await cropToPassportPhotoBlob(imageSrc, croppedAreaPixels);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);

      const settled = await settleToolUsage("passport_photo", "success", {
        crop: croppedAreaPixels,
        zoom,
        finalKB: Math.round(blob.size / 1024),
      });

      if (!settled.success) {
        toast.error(settled.message);
        URL.revokeObjectURL(url);
        setResultUrl(null);
        return;
      }

      toast.success(`Photo ready. ${settled.creditsCharged} credit(s) used. / फोटो तैयार है।`);
    } catch {
      await settleToolUsage("passport_photo", "failed", null);
      toast.error("Could not generate the photo. Please try again. / फोटो नहीं बन सकी।");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Passport Photo / पासपोर्ट फोटो</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo, crop it to size, and download. / फोटो अपलोड करें, आकार में क्रॉप करें और डाउनलोड करें।
        </p>
      </div>

      {gate.status === "loading" && <p className="text-sm text-muted-foreground">Checking credits…</p>}

      {gate.status === "blocked" && (
        <Card>
          <CardHeader>
            <CardTitle>Insufficient credits / अपर्याप्त क्रेडिट</CardTitle>
            <CardDescription>
              This tool costs {gate.cost} credit(s). Your balance is {gate.balance}. Please top up to continue. / यह
              टूल {gate.cost} क्रेडिट लेता है। कृपया क्रेडिट जोड़ें।
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {gate.status === "ready" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="photo-upload">Choose photo / फोटो चुनें</Label>
            <Input id="photo-upload" type="file" accept={ACCEPTED_MIME_TYPES.join(",")} onChange={handleFileChange} />
          </div>

          {imageSrc && (
            <>
              <Separator />
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div
                    className="relative w-full overflow-hidden rounded-md bg-muted"
                    style={{ aspectRatio: PASSPORT_PHOTO_ASPECT, maxHeight: 420 }}
                  >
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={PASSPORT_PHOTO_ASPECT}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Zoom / ज़ूम</Label>
                    <Slider
                      min={1}
                      max={3}
                      step={0.01}
                      value={[zoom]}
                      onValueChange={(v) => setZoom(v[0])}
                    />
                  </div>

                  <Button onClick={handleGenerate} disabled={working || !croppedAreaPixels} className="w-full">
                    {working ? "Generating…" : "Generate / बनाएं"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {resultUrl && imageSrc && (
            <Card>
              <CardHeader>
                <CardTitle>Result / परिणाम</CardTitle>
                <CardDescription>Before and after / पहले और बाद में</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <figure className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageSrc}
                      alt="Original photo"
                      className="aspect-square w-full rounded-md border bg-muted object-contain"
                    />
                    <figcaption className="text-center text-xs text-muted-foreground">Before / पहले</figcaption>
                  </figure>
                  <figure className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultUrl}
                      alt="Cropped passport photo"
                      className="w-full rounded-md border"
                      style={{ aspectRatio: PASSPORT_PHOTO_ASPECT }}
                    />
                    <figcaption className="text-center text-xs text-muted-foreground">
                      After / बाद में — passport size
                    </figcaption>
                  </figure>
                </div>
                <a href={resultUrl} download="passport-photo.jpg">
                  <Button className="w-full">Download JPG / डाउनलोड करें</Button>
                </a>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
