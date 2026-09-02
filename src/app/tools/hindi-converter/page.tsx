"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { detectTextEncoding, convertHindiText } from "@/lib/hindi/actions";
import type { DetectionResult } from "@/lib/hindi/detect";
import type { ConvertDirection } from "@/lib/hindi/convert";

const DETECTION_LABEL: Record<DetectionResult, string> = {
  unicode: "Unicode Devanagari / यूनिकोड देवनागरी",
  legacy_krutidev: "Kruti Dev (legacy) / कृति देव",
  unknown: "Unknown / अज्ञात",
};

function directionFromDetection(result: DetectionResult): ConvertDirection {
  return result === "unicode" ? "unicode_to_kruti" : "kruti_to_unicode";
}

export default function HindiConverterPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [direction, setDirection] = useState<ConvertDirection>("kruti_to_unicode");
  const [unsupported, setUnsupported] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [converting, setConverting] = useState(false);

  async function handleDetect() {
    if (input.trim().length === 0) {
      toast.error("Paste some text first / पहले कुछ टेक्स्ट पेस्ट करें");
      return;
    }
    setDetecting(true);
    setUnsupported(false);
    try {
      const result = await detectTextEncoding(input);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      setDetection(result.result);
      setDirection(directionFromDetection(result.result));
    } finally {
      setDetecting(false);
    }
  }

  async function handleConvert() {
    if (input.trim().length === 0) {
      toast.error("Paste some text first / पहले कुछ टेक्स्ट पेस्ट करें");
      return;
    }
    setConverting(true);
    setUnsupported(false);
    setOutput("");
    try {
      const result = await convertHindiText(input, direction);
      if (!result.success) {
        if (result.message === "unsupported_no_mapping_available") {
          setUnsupported(true);
        } else {
          toast.error(result.message);
        }
        return;
      }
      setOutput(result.convertedText);
      toast.success(`Converted — ${result.creditsCharged} credit(s) charged`);
    } finally {
      setConverting(false);
    }
  }

  async function handleCopy() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    toast.success("Copied / कॉपी हो गया");
  }

  function handleClear() {
    setInput("");
    setOutput("");
    setDetection(null);
    setUnsupported(false);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Hindi Converter / हिंदी कनवर्टर</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kruti Dev ↔ Unicode conversion / कृति देव ↔ यूनिकोड कनवर्शन
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Input / इनपुट</CardTitle>
          <CardDescription>Paste text below / नीचे टेक्स्ट पेस्ट करें</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste Hindi or Kruti Dev text here…"
            className="min-h-32"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleDetect} disabled={detecting}>
              {detecting ? "Detecting…" : "Detect / पहचानें"}
            </Button>
            {detection && <Badge variant="secondary">{DETECTION_LABEL[detection]}</Badge>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Direction / दिशा</span>
            <Select value={direction} onValueChange={(v) => setDirection(v as ConvertDirection)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kruti_to_unicode">Kruti Dev → Unicode</SelectItem>
                <SelectItem value="unicode_to_kruti">Unicode → Kruti Dev</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleConvert} disabled={converting}>
              {converting ? "Converting…" : "Convert / बदलें"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClear}>
              Clear / साफ़ करें
            </Button>
          </div>
        </CardContent>
      </Card>

      {unsupported && (
        <Card className="mt-4 border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            Hindi conversion mapping data isn&apos;t available yet — this feature is under
            construction. / हिंदी कनवर्शन डेटा अभी उपलब्ध नहीं है — यह सुविधा निर्माणाधीन है।
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Output / आउटपुट</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={output} readOnly placeholder="Converted text will appear here…" className="min-h-32" />
          <Button type="button" variant="outline" onClick={handleCopy} disabled={!output}>
            Copy / कॉपी करें
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
