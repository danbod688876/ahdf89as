import { IntegrationError } from "./errors";

export type PlantIdResult = {
  commonName: string;
  species: string;
  confidence: number;
  source: "plant.id" | "plantnet";
};

/**
 * Photo capture flow (spec §2.7): plant.id performs strongest on
 * cultivated/ornamental garden plants specifically; PlantNet is the free
 * fallback when plant.id is unavailable or low-confidence.
 */
export async function identifyPlant(imageUrl: string): Promise<PlantIdResult> {
  try {
    return await identifyWithPlantId(imageUrl);
  } catch {
    return await identifyWithPlantNet(imageUrl);
  }
}

async function identifyWithPlantId(imageUrl: string): Promise<PlantIdResult> {
  const apiKey = process.env.PLANT_ID_API_KEY;
  if (!apiKey) throw new IntegrationError("plant.id", "PLANT_ID_API_KEY not set");

  const res = await fetch("https://api.plant.id/v3/identification", {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ images: [imageUrl], similar_images: false }),
  });
  if (!res.ok) throw new IntegrationError("plant.id", `HTTP ${res.status}`);

  const data = await res.json();
  const suggestion = data?.result?.classification?.suggestions?.[0];
  if (!suggestion) throw new IntegrationError("plant.id", "no suggestions returned");

  return {
    commonName: suggestion.details?.common_names?.[0] ?? suggestion.name,
    species: suggestion.name,
    confidence: suggestion.probability ?? 0,
    source: "plant.id",
  };
}

async function identifyWithPlantNet(imageUrl: string): Promise<PlantIdResult> {
  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) throw new IntegrationError("plantnet", "PLANTNET_API_KEY not set");

  const res = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?api-key=${apiKey}&images=${encodeURIComponent(imageUrl)}`
  );
  if (!res.ok) throw new IntegrationError("plantnet", `HTTP ${res.status}`);

  const data = await res.json();
  const result = data?.results?.[0];
  if (!result) throw new IntegrationError("plantnet", "no results returned");

  return {
    commonName: result.species?.commonNames?.[0] ?? result.species?.scientificNameWithoutAuthor,
    species: result.species?.scientificNameWithoutAuthor,
    confidence: result.score ?? 0,
    source: "plantnet",
  };
}
