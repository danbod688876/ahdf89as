"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Minus, Plus, Repeat, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/lib/hooks/useSpeechInput";

type Module = "garden" | "home" | "vehicle";
type Unit = "days" | "weeks" | "months";

const MODULE_PLACEHOLDERS: Record<Module, string> = {
  garden: "e.g. water the ferns by the fence",
  home: "e.g. check the furnace filter",
  vehicle: "e.g. Forester needs an oil change",
};

/**
 * Universal capture bar (and its lighter per-card variant). Single field,
 * no dropdown, no confirmation screen — the task exists immediately after
 * submit. moduleHint fixes the module for a card's own bar; omitted for
 * the global bar, which lets POST /api/capture classify and auto-route.
 *
 * While the user types, a debounced dry-run preview (POST
 * /api/capture/classify) detects an implied recurring schedule ("check the
 * gutters every 3 months") and pre-fills/pre-toggles the Recurring
 * control — the user only ever confirms or nudges it, never builds one
 * from a blank state. Stops once the user touches the control themselves.
 */
export function CaptureBar({
  moduleHint,
  variant = "light",
  className,
}: {
  moduleHint?: Module;
  variant?: "full" | "light";
  className?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recurring, setRecurring] = useState(false);
  const [intervalNumber, setIntervalNumber] = useState(1);
  const [unit, setUnit] = useState<Unit>("days");
  const recurringTouchedRef = useRef(false);

  const { supported: speechSupported, isListening, toggleListening } = useSpeechInput((transcript) =>
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (recurringTouchedRef.current || text.trim().length < 6) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch("/api/capture/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text.trim(), moduleHint }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { recurrence: { interval: number; unit: Unit } | null } | null) => {
          if (!data || recurringTouchedRef.current) return;
          if (data.recurrence) {
            setRecurring(true);
            setIntervalNumber(data.recurrence.interval);
            setUnit(data.recurrence.unit);
          } else {
            setRecurring(false);
          }
        })
        .catch(() => {});
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, moduleHint]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function toggleRecurring() {
    recurringTouchedRef.current = true;
    setRecurring((v) => !v);
  }
  function adjustInterval(delta: number) {
    recurringTouchedRef.current = true;
    setIntervalNumber((v) => Math.max(1, v + delta));
  }
  function selectUnit(u: Unit) {
    recurringTouchedRef.current = true;
    setUnit(u);
  }

  function resetForm() {
    setText("");
    setRecurring(false);
    setIntervalNumber(1);
    setUnit("days");
    recurringTouchedRef.current = false;
  }

  async function handleSubmit() {
    const rawText = text.trim();
    if (!rawText) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          moduleHint,
          recurring: recurring ? { interval: intervalNumber, unit } : null,
        }),
      });

      if (!res.ok) {
        // Classification unavailable — fall back to a plain manual task
        // instead of failing silently (spec §4.6's existing pattern).
        const fallbackModule = moduleHint ?? "garden";
        const fallback =
          fallbackModule === "garden"
            ? await fetch("/api/garden/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText, actionType: "other", urgency: "someday" }),
              })
            : await fetch("/api/household-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetType: fallbackModule, action: rawText, rawText }),
              });
        if (!fallback.ok) throw new Error("Could not save this task. Try again in a moment.");
      }

      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFull = variant === "full";

  return (
    <div
      className={cn(
        isFull
          ? "sticky top-0 z-40 -mx-6 mb-5 border-b border-sage/20 bg-mist/95 px-6 py-3 backdrop-blur"
          : "mb-3",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={moduleHint ? MODULE_PLACEHOLDERS[moduleHint] : "Add a task"}
          className={cn(
            "min-w-0 flex-1 rounded-full border border-sage/30 bg-white/80 text-ink outline-none focus:border-pine",
            isFull ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs"
          )}
        />

        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            aria-label={isListening ? "Stop listening" : "Speak"}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full",
              isFull ? "size-9" : "size-7",
              isListening ? "bg-sand/20 text-[#8a6a3f]" : "bg-pine/10 text-pine"
            )}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={toggleRecurring}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full font-medium",
            isFull ? "px-3 py-2 text-xs" : "px-2.5 py-1 text-[11px]",
            recurring ? "bg-pine text-white" : "bg-pine/10 text-pine"
          )}
        >
          <Repeat className="size-3.5" />
          Recurring
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !text.trim()}
          aria-label="Add task"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-pine text-white disabled:opacity-50",
            isFull ? "size-9" : "size-7"
          )}
        >
          <Send className="size-3.5" />
        </button>
      </div>

      {recurring && (
        <div className="mx-auto mt-2 flex w-full max-w-7xl flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/70 px-1 py-1">
            <button
              type="button"
              onClick={() => adjustInterval(-1)}
              aria-label="Decrease"
              className="flex size-6 items-center justify-center rounded-full text-pine hover:bg-pine/10"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-5 text-center text-sm text-ink">{intervalNumber}</span>
            <button
              type="button"
              onClick={() => adjustInterval(1)}
              aria-label="Increase"
              className="flex size-6 items-center justify-center rounded-full text-pine hover:bg-pine/10"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="flex gap-1">
            {(["days", "weeks", "months"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => selectUnit(u)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs capitalize",
                  unit === u ? "bg-pine text-white" : "bg-pine/10 text-pine"
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mx-auto mt-2 w-full max-w-7xl text-xs text-sand">{error}</p>}
    </div>
  );
}
