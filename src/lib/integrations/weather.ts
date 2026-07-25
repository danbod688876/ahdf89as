/**
 * Optional weather check (spec §5): skip/flag watering tasks after recent
 * rain. Returns false (assume dry) on any failure — a missed skip is a
 * much smaller cost than blocking task creation on a weather API being down.
 */
export async function hasRecentRain(lat: number, lon: number): Promise<boolean> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    if (!res.ok) return false;

    const data = await res.json();
    const conditionCode: number | undefined = data?.weather?.[0]?.id;
    const recentRainVolume: number | undefined = data?.rain?.["1h"];
    const isRainCondition = typeof conditionCode === "number" && conditionCode < 700; // 2xx-6xx = precipitation
    return isRainCondition || (recentRainVolume ?? 0) > 0;
  } catch {
    return false;
  }
}
