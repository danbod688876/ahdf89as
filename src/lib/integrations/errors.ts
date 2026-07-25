/**
 * Thrown by every integration module (Claude, plant ID, plant data, weather).
 * Routes catch this and fall back to manual entry rather than blocking —
 * garden's AI layer is the app's one dependency with an external failure
 * mode the rest doesn't have (spec §4.6).
 */
export class IntegrationError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${service}] ${message}`);
    this.name = "IntegrationError";
  }
}
