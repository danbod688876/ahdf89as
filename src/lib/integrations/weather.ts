// Default garden location — Campbell River, coastal BC (~8a/8b), per spec §2.7/§5.
export const GARDEN_LOCATION = { lat: 50.0163, lon: -125.2461, name: "Campbell River, BC" };

export type DayForecast = {
  date: string; // yyyy-mm-dd
  minTemp: number; // °C
  maxTemp: number; // °C
  condition: string; // e.g. "Rain", "Clouds", "Clear"
  icon: string; // OpenWeatherMap icon code
  precipitationMm: number; // total expected rainfall for the day
  precipitationChance: number; // 0–1, highest probability-of-precipitation reading that day
};

export type WeatherSummary = {
  location: string;
  days: DayForecast[];
  recommendation: string;
};

interface ForecastEntry {
  dt_txt: string;
  main: { temp: number };
  weather?: { main?: string; icon?: string }[];
  rain?: { "3h"?: number };
  pop?: number;
}

/**
 * Multi-day forecast + a plain-language watering recommendation (spec §5:
 * "skip/flag watering tasks after recent rain... cheap addition, high value
 * since watering is the easiest task to over- or under-do"). Returns null on
 * any failure — a missing weather widget is a much smaller cost than
 * blocking the garden module on a third-party API being down (spec §4.6).
 */
export async function getWeatherForecast(
  lat: number = GARDEN_LOCATION.lat,
  lon: number = GARDEN_LOCATION.lon
): Promise<WeatherSummary | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const list: ForecastEntry[] | undefined = data?.list;
    if (!list?.length) return null;

    const byDate = new Map<string, ForecastEntry[]>();
    for (const entry of list) {
      const date = entry.dt_txt.slice(0, 10);
      byDate.set(date, [...(byDate.get(date) ?? []), entry]);
    }

    const days: DayForecast[] = [...byDate.entries()].slice(0, 5).map(([date, entries]) => {
      const temps = entries.map((e) => e.main.temp);
      const precipitationMm = entries.reduce((sum, e) => sum + (e.rain?.["3h"] ?? 0), 0);
      const precipitationChance = Math.max(...entries.map((e) => e.pop ?? 0));
      const midday = entries.find((e) => e.dt_txt.includes("12:00:00")) ?? entries[0];

      return {
        date,
        minTemp: Math.round(Math.min(...temps)),
        maxTemp: Math.round(Math.max(...temps)),
        condition: midday.weather?.[0]?.main ?? "—",
        icon: midday.weather?.[0]?.icon ?? "01d",
        precipitationMm: Math.round(precipitationMm * 10) / 10,
        precipitationChance: Math.round(precipitationChance * 100) / 100,
      };
    });

    return {
      location: GARDEN_LOCATION.name,
      days,
      recommendation: buildWateringRecommendation(days),
    };
  } catch {
    return null;
  }
}

function buildWateringRecommendation(days: DayForecast[]): string {
  const [today, ...rest] = days;
  const next3 = days.slice(0, 3);
  const totalRainNext3 = next3.reduce((sum, d) => sum + d.precipitationMm, 0);

  const rainToday =
    today && (today.precipitationMm > 0 || today.precipitationChance >= 0.5);
  if (rainToday) return "Rain expected today — skip watering.";

  if (totalRainNext3 >= 5) {
    return `Rain expected over the next few days (~${Math.round(totalRainNext3)}mm) — hold off on watering.`;
  }

  const allDry = next3.every((d) => d.precipitationChance < 0.3);
  if (allDry) return "Dry stretch ahead — stick to the regular watering schedule.";

  return rest.length ? "Mixed conditions ahead — check the forecast before watering." : "Check back for a fuller forecast.";
}
