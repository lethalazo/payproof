"use client";

interface Region {
  name: string;
  temperature_f: number;
  humidity_pct: number;
  precipitation_in: number;
  wind_mph: number;
  forecast: string;
  crop_impact: string;
}

interface WeatherData {
  provider: string;
  timestamp: string;
  regions: Region[];
}

export default function WeatherViz({ data }: { data: WeatherData }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌦</span>
        <span className="text-sm font-medium text-gray-200">
          {data.provider}
        </span>
        <span className="text-xs text-gray-500 ml-auto">
          {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.regions.map((region) => {
          const isWarning = region.crop_impact
            .toLowerCase()
            .includes("risk") ||
            region.crop_impact.toLowerCase().includes("damage") ||
            region.crop_impact.toLowerCase().includes("drought");

          return (
            <div
              key={region.name}
              className="min-w-[220px] bg-gray-800/60 rounded-lg p-3 border border-gray-700/50 shrink-0"
            >
              <div className="text-sm font-medium text-gray-200 mb-2">
                {region.name}
              </div>

              <div className="text-3xl font-bold text-white mb-2">
                {region.temperature_f}°F
              </div>

              {/* Humidity bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                  <span>Humidity</span>
                  <span>{region.humidity_pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${region.humidity_pct}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-3 text-xs text-gray-400 mb-2">
                <span>💨 {region.wind_mph} mph</span>
                <span>🌧 {region.precipitation_in} in</span>
              </div>

              <div
                className={`text-xs px-2 py-1 rounded ${
                  isWarning
                    ? "bg-amber-900/40 text-amber-300 border border-amber-700/30"
                    : "bg-emerald-900/40 text-emerald-300 border border-emerald-700/30"
                }`}
              >
                {region.crop_impact}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
