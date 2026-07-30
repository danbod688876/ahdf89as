"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sprout, Mic, MicOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/lib/hooks/useSpeechInput";

/**
 * Persistent, low-friction capture entry point — she's often outside with
 * hands full, so voice capture can't be buried a level deep (spec §5).
 * Fixed to the viewport, independent of the Garden module's expand state.
 */
export function VoiceCaptureButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { supported: speechSupported, isListening, toggleListening } = useSpeechInput((transcript) =>
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
  );

  async function handleSubmit() {
    const rawText = text.trim();
    if (!rawText) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/garden/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!res.ok) {
        // Plant/AI parsing unavailable — fall back to a plain manual task
        // instead of failing silently (spec §4.6).
        const fallback = await fetch("/api/garden/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, actionType: "other", urgency: "someday" }),
        });
        if (!fallback.ok) throw new Error("Could not save this task. Try again in a moment.");
      }

      setText("");
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-pine px-5 py-3.5",
          "text-sm font-medium text-white shadow-lg shadow-pine/25 transition-transform hover:scale-105",
          className
        )}
        aria-label="Capture a garden task by voice"
      >
        <Sprout className="size-4" />
        Tell the garden
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-mist p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-ink">Tell the garden</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-sage hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. hydrangeas by the fence need watering"
              rows={3}
              className="mt-4 w-full rounded-xl border border-sage/30 bg-white/70 p-3 text-sm text-ink outline-none focus:border-pine"
            />

            {error && <p className="mt-2 text-sm text-sand">{error}</p>}

            <div className="mt-4 flex items-center justify-between gap-3">
              {speechSupported ? (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm",
                    isListening ? "bg-sand/20 text-[#8a6a3f]" : "bg-pine/10 text-pine"
                  )}
                >
                  {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {isListening ? "Listening…" : "Speak"}
                </button>
              ) : (
                <span className="text-xs text-sage">Voice input isn&rsquo;t supported in this browser — type instead.</span>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !text.trim()}
                className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
