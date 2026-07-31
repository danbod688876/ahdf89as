"use client";

import { useState } from "react";
import { Maximize2, X } from "lucide-react";
import type { Plant } from "@/lib/db/schema";

/** The AI-generated "what to look for" sentence is the whole point of this
 * component — far more useful for matching a row to the actual plant than
 * a species name. Species/location tag are just fallbacks for older rows
 * that predate it. */
export function plantIdentityLine(plant: Plant | null | undefined): string | null {
  return plant?.identifyingFeature ?? plant?.species ?? plant?.locationTag ?? null;
}

/**
 * Large enough to actually recognize the plant by, not just decorate the
 * row — and tappable, since even a bigger inline thumbnail is still small
 * next to a full plant. Tapping opens a full-size lightbox with the photo
 * and the identifying sentence together.
 */
export function PlantThumbnail({ plant }: { plant: Plant | null | undefined }) {
  const [isOpen, setIsOpen] = useState(false);
  const hasPhoto = !!plant?.referencePhotoUrl;
  const identityLine = plantIdentityLine(plant);

  return (
    <>
      <button
        type="button"
        onClick={() => hasPhoto && setIsOpen(true)}
        disabled={!hasPhoto}
        aria-label={hasPhoto ? `View larger photo of ${plant?.commonName}` : undefined}
        className="group relative size-20 shrink-0 overflow-hidden rounded-xl bg-sage/15 disabled:cursor-default sm:size-28"
      >
        {hasPhoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plant!.referencePhotoUrl!}
              alt={plant!.commonName}
              className="absolute inset-0 size-full object-cover"
            />
            <span className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-3.5" />
            </span>
          </>
        )}
      </button>

      {isOpen && hasPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-mist p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-serif text-lg text-ink">{plant!.commonName}</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
                className="text-sage hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="relative mt-3 aspect-square w-full overflow-hidden rounded-xl bg-sage/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={plant!.referencePhotoUrl!}
                alt={plant!.commonName}
                className="absolute inset-0 size-full object-cover"
              />
            </div>
            {identityLine && <p className="mt-3 text-sm text-ink">{identityLine}</p>}
          </div>
        </div>
      )}
    </>
  );
}
