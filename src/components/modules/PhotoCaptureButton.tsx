"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Loader2, Square, X } from "lucide-react";
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

type QueueItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "identifying" | "done" | "error";
  result?: PhotoResult;
  error?: string;
  nameCorrection?: string;
};

/**
 * Photo capture flow: upload one or many photos -> plant ID -> a
 * year-round care plan, saved straight to the garden's task list — no
 * separate confirmation step beyond correcting a low-confidence name.
 * Multiple files are processed one at a time (not in parallel) to stay
 * conservative against Claude/plant-ID rate limits and Vercel function
 * concurrency, with progress visible and stoppable mid-batch. Each
 * upload goes directly from the browser to Blob storage (POST
 * /api/garden/upload issues a short-lived token) so a full-res phone
 * photo never has to fit through a serverless function's request body
 * limit.
 */
export function PhotoCaptureButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const stopRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setQueue([]);
    setIsProcessing(false);
    stopRef.current = false;
  }

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function processQueue(items: QueueItem[]) {
    setIsProcessing(true);
    stopRef.current = false;
    for (const item of items) {
      if (stopRef.current) break;
      updateItem(item.id, { status: "uploading" });
      try {
        const blob = await upload(item.file.name, item.file, {
          access: "public",
          handleUploadUrl: "/api/garden/upload",
        });
        if (stopRef.current) break;

        updateItem(item.id, { status: "identifying" });
        const res = await fetch("/api/garden/photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoUrl: blob.url }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Couldn't identify this plant — try the text capture bar instead.");
        }
        updateItem(item.id, { status: "done", result: data, nameCorrection: data.plant.commonName });
        router.refresh();
      } catch (err) {
        updateItem(item.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    }
    setIsProcessing(false);
  }

  function handleFiles(fileList: FileList) {
    const items: QueueItem[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));
    if (items.length === 0) return;
    setQueue(items);
    processQueue(items);
  }

  async function saveNameCorrection(item: QueueItem) {
    if (!item.result || !item.nameCorrection?.trim() || item.nameCorrection === item.result.plant.commonName) return;
    const res = await fetch(`/api/garden/plants/${item.result.plant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commonName: item.nameCorrection.trim() }),
    });
    if (res.ok) {
      const updatedPlant = await res.json();
      updateItem(item.id, { result: { ...item.result, plant: updatedPlant, needsConfirmation: false } });
      router.refresh();
    }
  }

  const doneCount = queue.filter((i) => i.status === "done").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const allSettled = queue.length > 0 && queue.every((i) => i.status === "done" || i.status === "error");
  const singleItem = queue.length === 1 ? queue[0] : null;

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
          onClick={() => !isProcessing && setIsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-mist p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Identify plants</h2>
              {!isProcessing && (
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="text-sage hover:text-ink">
                  <X className="size-5" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />

            {queue.length === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-sage/40 py-10 text-sage hover:border-pine hover:text-pine"
              >
                <Camera className="size-7" />
                <span className="text-sm">Take or choose one or more photos</span>
              </button>
            )}

            {queue.length > 0 && (
              <>
                {queue.length > 1 && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-sage">
                      {allSettled
                        ? `${doneCount} identified${errorCount ? `, ${errorCount} failed` : ""}`
                        : `Processing ${doneCount + errorCount + 1} of ${queue.length}…`}
                    </p>
                    {isProcessing && (
                      <button
                        type="button"
                        onClick={() => {
                          stopRef.current = true;
                        }}
                        className="flex items-center gap-1 rounded-full bg-sand/20 px-2.5 py-1 text-xs font-medium text-[#8a6a3f]"
                      >
                        <Square className="size-3" /> Stop
                      </button>
                    )}
                  </div>
                )}

                <ul className="mt-3 space-y-2">
                  {queue.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-lg bg-white/60 p-2">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-sage/15">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.previewUrl} alt="" className="absolute inset-0 size-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {item.status === "uploading" && <p className="text-xs text-sage">Uploading…</p>}
                        {item.status === "identifying" && <p className="text-xs text-sage">Identifying…</p>}
                        {item.status === "pending" && <p className="text-xs text-sage">Waiting…</p>}
                        {item.status === "done" && item.result && (
                          <p className="truncate text-sm text-ink">
                            {item.result.plant.commonName}
                            {item.result.needsConfirmation && <span className="ml-1 text-xs text-sand">(unsure)</span>}
                          </p>
                        )}
                        {item.status === "error" && (
                          <p className="flex items-start gap-1 text-xs text-sand">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                            {item.error}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {(item.status === "uploading" || item.status === "identifying") && (
                          <Loader2 className="size-4 animate-spin text-pine" />
                        )}
                        {item.status === "done" && <Check className="size-4 text-pine" />}
                        {item.status === "error" && <X className="size-4 text-sand" />}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Full detail (identifying sentence, care actions, name-fix) only
                    for a single photo — for a big batch this list would be
                    unreadable, and the Garden task list already shows the results. */}
                {singleItem?.status === "done" && singleItem.result && (
                  <div className="mt-3 space-y-2 rounded-lg bg-white/60 p-3">
                    {singleItem.result.needsConfirmation ? (
                      <div className="space-y-1.5">
                        <p className="text-xs text-sand">Not fully sure — is this right?</p>
                        <div className="flex gap-2">
                          <input
                            value={singleItem.nameCorrection ?? ""}
                            onChange={(e) => updateItem(singleItem.id, { nameCorrection: e.target.value })}
                            className="flex-1 rounded-lg border border-sage/30 bg-white p-2 text-sm text-ink outline-none focus:border-pine"
                          />
                          <button
                            type="button"
                            onClick={() => saveNameCorrection(singleItem)}
                            className="rounded-full bg-pine px-3 py-1.5 text-xs font-medium text-white"
                          >
                            Fix
                          </button>
                        </div>
                      </div>
                    ) : (
                      singleItem.result.plant.identifyingFeature && (
                        <p className="text-xs text-sage">{singleItem.result.plant.identifyingFeature}</p>
                      )
                    )}

                    {singleItem.result.careAdviceUnavailable ? (
                      <p className="text-sm text-sage">Saved — care advice is unavailable right now.</p>
                    ) : (
                      (() => {
                        const careLines = [
                          ...(singleItem.result.createdTasks ?? []).map((t) => t.rawText),
                          ...(singleItem.result.createdMaintenanceItems ?? []).map(
                            (m) => `${m.task}${m.intervalDays ? ` — every ${m.intervalDays} days` : ""}`
                          ),
                        ];
                        return careLines.length > 0 ? (
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
                        );
                      })()
                    )}
                  </div>
                )}

                {allSettled && (
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                      setIsOpen(false);
                    }}
                    className="mt-4 w-full rounded-full bg-pine px-4 py-2 text-sm font-medium text-white"
                  >
                    Done
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
