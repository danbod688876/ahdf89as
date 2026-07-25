import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { IntegrationError } from "./errors";

const client = new Anthropic();

const captureSchema = z.object({
  plantName: z.string().describe("Best-guess plant name or nickname mentioned"),
  locationHint: z.string().nullable().describe("Where in the garden, if mentioned"),
  action: z.enum(["water", "prune", "fertilize", "watch", "other"]),
  urgency: z.enum(["today", "this_week", "someday"]),
});

export type ParsedGardenCapture = z.infer<typeof captureSchema>;

/**
 * Voice/text capture (spec §2.7): "hydrangeas by the fence need watering"
 * -> structured task fields. Low effort — this is a short extraction task,
 * not a reasoning-heavy one.
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
          content: `Extract a garden task from this note: "${rawText}"`,
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
