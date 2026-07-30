import { Sun, Cloud, CloudRain, CloudLightning, CloudSnow, Droplets } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { WeatherSummary } from "@/lib/integrations/weather";

const CONDITION_ICON: Record<string, typeof Sun> = {
  Clear: Sun,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudRain,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
};

export function WeatherWidget({ weather }: { weather: WeatherSummary | null }) {
  if (!weather) return null;

  return (
    <div className="mb-3 rounded-xl bg-pine/5 p-3">
      <p className="text-sm text-ink">{weather.recommendation}</p>
      <div className="mt-2 flex gap-3 overflow-x-auto">
        {weather.days.map((day) => {
          const Icon = CONDITION_ICON[day.condition] ?? Cloud;
          return (
            <div key={day.date} className="flex shrink-0 flex-col items-center gap-0.5 text-center">
              <span className="text-[11px] uppercase tracking-wide text-sage">
                {format(parseISO(day.date), "EEE")}
              </span>
              <Icon className="size-4 text-pine" />
              <span className="text-xs text-ink">
                {day.maxTemp}° <span className="text-sage">{day.minTemp}°</span>
              </span>
              {day.precipitationChance >= 0.3 && (
                <span className="flex items-center gap-0.5 text-[10px] text-sage">
                  <Droplets className="size-2.5" />
                  {Math.round(day.precipitationChance * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
