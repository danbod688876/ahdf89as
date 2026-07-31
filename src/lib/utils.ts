import { clsx, type ClassValue } from "clsx";
import type { Plant } from "@/lib/db/schema";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

/** The AI-generated "what to look for" sentence is the whole point of this
 * — far more useful for matching a row to the actual plant than a species
 * name. Species/location tag are just fallbacks for older rows that
 * predate it. Kept out of PlantThumbnail (a "use client" file) since
 * server components (e.g. PlantLibrary) need it too. */
export function plantIdentityLine(plant: Plant | null | undefined): string | null {
  return plant?.identifyingFeature ?? plant?.species ?? plant?.locationTag ?? null;
}
