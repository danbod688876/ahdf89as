import type { Plant } from "@/lib/db/schema";

/** Species (from a photo ID) is the most useful identifier; location tag
 * (from a voice note like "by the fence") is the fallback when it's not
 * been identified yet. */
export function plantIdentityLine(plant: Plant | null | undefined): string | null {
  return plant?.species ?? plant?.locationTag ?? null;
}

/**
 * Large enough to actually recognize the plant by, not just decorate the
 * row — a square crop (not a circle) so more of the photo stays visible.
 */
export function PlantThumbnail({ plant }: { plant: Plant | null | undefined }) {
  return (
    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sage/15">
      {plant?.referencePhotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plant.referencePhotoUrl}
          alt={plant.commonName}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
