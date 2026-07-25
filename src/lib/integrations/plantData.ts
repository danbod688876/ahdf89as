import { IntegrationError } from "./errors";

export type StockPhotoResult = { url: string; source: "perenual" | "trefle" };

/**
 * Voice/text capture, no plant-table match (spec §2.7): query a plant data
 * API for a stock reference photo by best-guess species. Perenual primary,
 * Trefle fallback. Returns null (not a thrown error) when neither has a
 * photo — callers should create the provisional plant row without one
 * rather than blocking capture.
 */
export async function fetchStockPhoto(speciesGuess: string): Promise<StockPhotoResult | null> {
  try {
    return await fetchFromPerenual(speciesGuess);
  } catch {
    try {
      return await fetchFromTrefle(speciesGuess);
    } catch {
      return null;
    }
  }
}

async function fetchFromPerenual(query: string): Promise<StockPhotoResult> {
  const apiKey = process.env.PERENUAL_API_KEY;
  if (!apiKey) throw new IntegrationError("perenual", "PERENUAL_API_KEY not set");

  const res = await fetch(
    `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new IntegrationError("perenual", `HTTP ${res.status}`);

  const data = await res.json();
  const photoUrl = data?.data?.[0]?.default_image?.regular_url;
  if (!photoUrl) throw new IntegrationError("perenual", "no photo found");
  return { url: photoUrl, source: "perenual" };
}

async function fetchFromTrefle(query: string): Promise<StockPhotoResult> {
  const apiKey = process.env.TREFLE_API_KEY;
  if (!apiKey) throw new IntegrationError("trefle", "TREFLE_API_KEY not set");

  const res = await fetch(
    `https://trefle.io/api/v1/plants/search?token=${apiKey}&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new IntegrationError("trefle", `HTTP ${res.status}`);

  const data = await res.json();
  const photoUrl = data?.data?.[0]?.image_url;
  if (!photoUrl) throw new IntegrationError("trefle", "no photo found");
  return { url: photoUrl, source: "trefle" };
}
