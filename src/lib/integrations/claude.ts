import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IntegrationError } from "./errors";
import { GARDEN_LOCATION } from "./weather";

const client = new Anthropic();

function currentSeason(): string {
  const month = new Date().getMonth() + 1; // Northern hemisphere
  if ([12, 1, 2].includes(month)) return "winter";
  if ([3, 4, 5].includes(month)) return "spring";
  if ([6, 7, 8].includes(month)) return "summer";
  return "fall";
}

const captureSchema = z.object({
  plantName: z.string().describe("Best-guess plant name or nickname mentioned"),
  locationHint: z.string().nullable().describe("Where in the garden, if mentioned"),
  action: z.enum(["water", "prune", "fertilize", "watch", "other"]),
  urgency: z.enum(["today", "this_week", "someday"]),
  detail: z
    .string()
    .describe(
      "Expand her short flagged note into a clear, specific, plain-language explanation of exactly what to do — he's the one who'll actually do the work and isn't a gardening expert, so skip generic advice and be concrete (how much water, where to cut, what to check for). 1-3 sentences."
    ),
});

export type ParsedGardenCapture = z.infer<typeof captureSchema>;

/**
 * Voice/text capture (spec §2.7): "hydrangeas by the fence need watering"
 * -> structured task fields, plus an expanded, actionable explanation.
 * This is the core of the app's "take the mental load off her" goal — she
 * flags an issue in a sentence, he gets back something he can just follow.
 */
export async function parseGardenCapture(rawText: string): Promise<ParsedGardenCapture> {
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(captureSchema) },
      messages: [
        {
          role: "user",
          content: [
            `She just flagged a garden task in passing: "${rawText}"`,
            `Zone: ${GARDEN_LOCATION.name}, coastal BC (~8a/8b)`,
            `Season: ${currentSeason()}`,
          ].join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return response.parsed_output;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "voice/text capture parsing failed", err);
  }
}

/**
 * Photo capture flow (spec §2.7 step 4): species + zone + season + what's
 * visible in the photo -> specific, non-generic care actions.
 */
const careActionSchema = z.object({
  text: z.string().describe("The specific care action, e.g. 'prune again in 6 weeks'"),
  type: z
    .enum(["recurring", "one_off"])
    .describe("recurring -> becomes a MaintenanceItem; one_off -> a one-time GardenTask"),
  intervalDays: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("Only set when type is recurring"),
});

export type CareAction = z.infer<typeof careActionSchema>;

export async function generateCareAdvice(input: {
  species: string;
  zone: string;
  season: string;
  photoNotes?: string;
}): Promise<CareAction[]> {
  const adviceSchema = z.object({ actions: z.array(careActionSchema) });
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 2048,
      output_config: { effort: "medium", format: zodOutputFormat(adviceSchema) },
      messages: [
        {
          role: "user",
          content: [
            `Species: ${input.species}`,
            `Zone: ${input.zone}`,
            `Season: ${input.season}`,
            input.photoNotes ? `Visible in photo: ${input.photoNotes}` : null,
            "",
            "Give specific, non-generic care actions for this plant right now — not generic species advice. Include timing (e.g. 'prune again in 6 weeks') where relevant.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    if (!response.parsed_output) {
      throw new IntegrationError("claude", "no parsed output returned");
    }
    return response.parsed_output.actions;
  } catch (err) {
    if (err instanceof IntegrationError) throw err;
    throw new IntegrationError("claude", "care advice generation failed", err);
  }
}
