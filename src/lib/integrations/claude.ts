import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IntegrationError } from "./errors";
import { GARDEN_LOCATION, type WeatherSummary } from "./weather";

const client = new Anthropic();

export function currentSeason(): "winter" | "spring" | "summer" | "fall" {
  const month = new Date().getMonth() + 1; // Northern hemisphere
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "fall";
}

function forecastLine(weather: WeatherSummary | null | undefined): string | null {
  if (!weather) return null;
  const days = weather.days
    .map(
      (d) =>
        `${d.date} ${d.condition} ${d.minTemp}–${d.maxTemp}°C, ${Math.round(d.precipitationChance * 100)}% chance rain`
    )
    .join("; ");
  return `Forecast (${weather.location}): ${days}. ${weather.recommendation}`;
}

const capturedTaskSchema = z.object({
  plantName: z.string().describe("Best-guess plant name or nickname for this one plant"),
  locationHint: z.string().nullable().describe("Where in the garden, if mentioned"),
  action: z.enum(["water", "prune", "fertilize", "watch", "other"]),
  urgency: z.enum(["today", "this_week", "someday"]),
  detail: z
    .string()
    .describe(
      "A clear, specific, plain-language explanation of exactly what to do for this plant — he's the one who'll actually do the work and isn't a gardening expert, so skip generic advice and be concrete (how much water, where to cut, what to check for). 1-3 sentences, specific to this plant only."
    ),
});

const captureSchema = z.object({
  tasks: z
    .array(capturedTaskSchema)
    .min(1)
    .describe(
      "One entry per distinct plant/area mentioned. Split a note covering multiple plants (e.g. 'water the lavender and the laurel') into separate entries, one per plant, each with its own detail — don't lump them into a single combined entry."
    ),
});

export type ParsedGardenTask = z.infer<typeof capturedTaskSchema>;

/**
 * Voice/text capture (spec §2.7): "hydrangeas by the fence need watering"
 * -> structured task fields, plus an expanded, actionable explanation, one
 * entry per plant mentioned. This is the core of the app's "take the
 * mental load off her" goal — she flags issues in a sentence, he gets back
 * separate, specific, followable tasks (each matched to its own plant photo).
 */
export async function parseGardenCapture(rawText: string): Promise<ParsedGardenTask[]> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: { effort: "low", format: zodOutputFormat(captureSchema) },
      messages: [
        {
          role: "user",
          content: [
            `She just flagged garden task(s) in passing: "${rawText}"`,
            `Zone: ${GARDEN_LOCATION.name}, ${GARDEN_LOCATION.zone}`,
            `Season: ${currentSeason()}`,
          ].join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return response.parsed_output.tasks;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "voice/text capture parsing failed", err);
  }
}

const recurrenceGuessSchema = z
  .object({
    interval: z.number().int().positive().describe("How many of the unit, e.g. 3 for 'every 3 months'"),
    unit: z.enum(["days", "weeks", "months"]),
  })
  .nullable()
  .describe(
    "Set only when the text genuinely implies a repeating schedule (e.g. 'every 3 months', 'twice a week' -> 1 week). Otherwise null — don't invent a schedule that isn't there."
  );

const captureClassificationSchema = z.object({
  module: z
    .enum(["garden", "home", "vehicle", "uncertain"])
    .describe(
      "garden = plant/yard language; home = furnace/gutter/appliance/house language; vehicle = car/tire/oil/registration language. Use 'uncertain' only if genuinely ambiguous."
    ),
  assetReference: z
    .string()
    .nullable()
    .describe("The plant, appliance, or vehicle mentioned, in plain text as said — null if nothing specific is named."),
  action: z.string().describe("Short plain-language description of what needs doing, e.g. 'oil change', 'check gutters'."),
  dueHint: z
    .string()
    .nullable()
    .describe("Free-text timing only if actually implied by the text, e.g. 'next week', 'before winter' — null otherwise."),
  recurrence: recurrenceGuessSchema,
});

export type CaptureClassification = z.infer<typeof captureClassificationSchema>;

/**
 * Universal capture bar's routing step: one freeform sentence -> which
 * module it belongs to, plain-language fields for a one-off task, and a
 * best-guess recurrence if the text implies a repeating schedule. Reuses
 * the same structured-output pattern as parseGardenCapture rather than a
 * bespoke parser per module.
 *
 * moduleHint is set when captured from inside a specific module's own card
 * (the user looking at that card is the explicit signal) — classification
 * is skipped and Claude just extracts fields for that fixed module.
 */
export async function classifyCapture(
  rawText: string,
  moduleHint?: "garden" | "home" | "vehicle"
): Promise<CaptureClassification> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(captureClassificationSchema) },
      messages: [
        {
          role: "user",
          content: [
            moduleHint
              ? `This was captured from the "${moduleHint}" card, so it definitely belongs to that module — just extract the fields, don't second-guess the module.`
              : "Classify which household module this task belongs to and extract its fields.",
            `Text: "${rawText}"`,
          ].join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return moduleHint ? { ...response.parsed_output, module: moduleHint } : response.parsed_output;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "capture classification failed", err);
  }
}

const identifierSchema = z.object({
  identifier: z
    .string()
    .describe(
      "One plain-language sentence describing the specific visual features to look for — leaf shape, color, texture, flower type/color, size, distinguishing marks. Written for someone with no gardening background matching this to what's actually in their yard, e.g. 'Look for glossy, dark green oval leaves speckled with cream or gold, sometimes with small red berries in winter.'"
    ),
});

/**
 * Generated alongside a plant's reference photo (both capture flows) so
 * the thumbnail isn't the only way to recognize it — a short, concrete
 * "what to look for" sentence rather than generic species trivia.
 */
export async function generatePlantIdentifier(plantName: string, context?: string | null): Promise<string> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 256,
      output_config: { effort: "low", format: zodOutputFormat(identifierSchema) },
      messages: [
        {
          role: "user",
          content: [
            `Plant: "${plantName}"`,
            context ? `Extra context: ${context}` : null,
            "Give the single sentence described in the schema — concrete visual features only, not care instructions or trivia.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return response.parsed_output.identifier;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "plant identifier generation failed", err);
  }
}

/**
 * Photo capture flow: species + zone + what's visible in the photo ->
 * a full year-round care plan, one entry per season, generated once
 * rather than only "right now" — so the plant's task list builds itself
 * as each season arrives instead of requiring a fresh photo every visit.
 * The current forecast (when given) only informs the season actually
 * happening now; the other three reflect typical conditions for the zone.
 */
const seasonalActionSchema = z.object({
  careKey: z
    .string()
    .describe(
      "Short, stable snake_case key grouping this action across seasons, e.g. 'watering', 'pruning', 'fertilizing'. Reuse the SAME key across season entries for the same conceptual recurring action so its cadence can be updated as seasons change rather than treated as a brand new task each time."
    ),
  action: z.string().describe("The specific care action for this season, e.g. 'Water deeply twice a week during hot spells'"),
  type: z
    .enum(["recurring", "one_off"])
    .describe("recurring -> an ongoing reminder for this season; one_off -> a single task when the season starts"),
  intervalDays: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("Only set when type is recurring — how often to repeat during this season"),
  isWatering: z
    .boolean()
    .describe("True if this action is specifically about watering — used to automatically factor in the weather forecast"),
});

const seasonalPlanSchema = z.object({
  seasons: z
    .array(
      z.object({
        season: z.enum(["winter", "spring", "summer", "fall"]),
        actions: z.array(seasonalActionSchema),
      })
    )
    .length(4)
    .describe("Exactly one entry per season covering the full year — an empty actions array is fine for a dormant season."),
});

export type SeasonalCareAction = z.infer<typeof seasonalActionSchema>;
export type SeasonalCarePlan = z.infer<typeof seasonalPlanSchema>["seasons"];

export async function generateSeasonalCarePlan(input: {
  species: string;
  zone: string;
  currentSeason: string;
  photoNotes?: string;
  weather?: WeatherSummary | null;
}): Promise<SeasonalCarePlan> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 3072,
      output_config: { effort: "medium", format: zodOutputFormat(seasonalPlanSchema) },
      messages: [
        {
          role: "user",
          content: [
            `Species: ${input.species}`,
            `Zone: ${input.zone}`,
            `Current season: ${input.currentSeason}`,
            input.photoNotes ? `Visible in photo: ${input.photoNotes}` : null,
            forecastLine(input.weather),
            "",
            "Build this plant's full year-round care plan, one entry per season — not just what to do right now. For each season, give specific, non-generic actions (watering cadence, pruning/fertilizing timing, protection needed) rather than generic species trivia. Use the forecast above, if given, only to inform right-now details for the current season; the other three should reflect typical conditions for the zone.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return response.parsed_output.seasons;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "seasonal care plan generation failed", err);
  }
}
