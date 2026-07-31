"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { cn } from "@/lib/utils";
import type { GardenTask, MaintenanceItem, Plant } from "@/lib/db/schema";

type PhotoResult = {
  plant: Plant;
  needsConfirmation: boolean;
  createdTasks?: GardenTask[];
  createdMaintenanceItems?: MaintenanceItem[];
  careAdviceUnavailable?: boolean;
};

/**
 * Photo capture flow (spec §2.7 step 4): upload a photo -> plant ID ->
 * zone/season/forecast-specific care advice, saved straight to the
 * garden's task list — no separate confirmation step beyond correcting a
 * low-confidence name. Upload goes directly from the browser to Blob
 * storage (POST /api/garden/upload issues a short-lived token) so a
 * full-res phone photo never has to fit through a serverless function's
 * request body limit.
 */
export function PhotoCaptureButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "identifying" | "done">("idle");
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameCorrection, setNameCorrection] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPreviewUrl(null);
    setStatus("idle");
    setResult(null);
    setError(null);
    setNameCorrection("");
  }

  async function handleFile(file: File) {
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("uploading");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/garden/upload",
      });

      setStatus("identifying");
      const res = await fetch("/api/garden/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: blob.url }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Couldn't identify this plant — try the text capture bar instead.");
      }

      setResult(data);
      setNameCorrection(data.plant.commonName);
      setStatus("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  async function saveNameCorrection() {
    if (!result || !nameCorrection.trim() || nameCorrection === result.plant.commonName) return;
    const res = await fetch(`/api/garden/plants/${result.plant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commonName: nameCorrection.trim() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setResult({ ...result, plant: updated, needsConfirmation: false });
      router.refresh();
    }
  }

  const careLines = result
    ? [
        ...(result.createdTasks ?? []).map((t) => t.rawText),
        ...(result.createdMaintenanceItems ?? []).map(
          (m) => `${m.task}${m.intervalDays ? ` — every ${m.intervalDays} days` : ""}`
        ),
      ]
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setIsOpen(true);
        }}
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-pine/10 px-3 py-1.5 text-xs font-medium text-pine hover:bg-pine/15",
          className
        )}
      >
        <Camera className="size-3.5" />
        Identify a plant
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 sm:items-center"
          onClick={() => setIsOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-mist p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Identify a plant</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="text-sage hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {!previewUrl && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sage/40 py-10 text-sage hover:border-pine hover:text-pine"
              >
                <Camera className="size-7" />
                <span className="text-sm">Take or choose a photo</span>
              </button>
            )}

            {previewUrl && (
              <div className="relative mt-4 aspect-square w-full overflow-hidden rounded-xl bg-sage/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Uploaded plant" className="absolute inset-0 size-full object-cover" />
                {(status === "uploading" || status === "identifying") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/50 text-white">
                    <Loader2 className="size-6 animate-spin" />
                    <span className="text-sm">{status === "uploading" ? "Uploading…" : "Identifying…"}</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-sand">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            )}

            {result && status === "done" && (
              <div className="mt-4 space-y-3">
                <div>
                  {result.needsConfirmation ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-sand">Not fully sure — is this right?</p>
                      <div className="flex gap-2">
                        <input
                          value={nameCorrection}
                          onChange={(e) => setNameCorrection(e.target.value)}
                          className="flex-1 rounded-lg border border-sage/30 bg-white p-2 text-sm text-ink outline-none focus:border-pine"
                        />
                        <button
                          type="button"
                          onClick={saveNameCorrection}
                          className="rounded-full bg-pine px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Fix
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-serif text-lg text-ink">{result.plant.commonName}</p>
                  )}
                  {result.plant.identifyingFeature && (
                    <p className="mt-1 text-xs text-sage">{result.plant.identifyingFeature}</p>
                  )}
                </div>

                {result.careAdviceUnavailable ? (
                  <p className="text-sm text-sage">Saved — care advice is unavailable right now.</p>
                ) : careLines.length > 0 ? (
                  <ul className="space-y-1 text-sm text-ink">
                    {careLines.map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-pine" />
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-sage">No specific care actions right now.</p>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-full bg-pine px-4 py-2 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
