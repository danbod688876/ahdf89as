import { PlantThumbnail } from "./PlantThumbnail";
import { plantIdentityLine } from "@/lib/utils";
import type { Plant } from "@/lib/db/schema";

/**
 * The library this app is meant to build up over time — every plant
 * that's ever been identified, not just the ones with something due
 * right now. Tap a photo for the full-size view + identifying sentence.
 */
export function PlantLibrary({ plants }: { plants: Plant[] }) {
  if (plants.length === 0) {
    return (
      <p className="text-sm text-sage">
        No plants identified yet — use &ldquo;Identify a plant&rdquo; above to start building your library.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      {plants.map((plant) => {
        const identityLine = plantIdentityLine(plant);
        return (
          <li key={plant.id} className="flex flex-col items-center gap-1.5 text-center">
            <PlantThumbnail plant={plant} />
            <p className="text-xs font-medium text-ink">{plant.commonName}</p>
            {identityLine && <p className="line-clamp-2 text-[11px] text-sage">{identityLine}</p>}
          </li>
        );
      })}
    </ul>
  );
}
