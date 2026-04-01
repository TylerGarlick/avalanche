'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { type UnifiedForecast, type AvalancheProblem, type DangerLevel, DANGER_COLORS, DANGER_LABELS, ELEVATIONS } from '@/lib/types';

interface Zone {
  zoneId: string;
  zone: string;
  center: 'CAIC' | 'UAC';
  lat: number;
  lon: number;
}

interface WeatherData {
  current_weather?: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    snowfall: number[];
    windspeed_10m: number[];
    winddirection_10m: number[];
    weathercode: number[];
  };
}

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear', icon: '☀️' },
  1: { label: 'Mostly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Rime Fog', icon: '🌫️' },
  51: { label: 'Light Drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Heavy Drizzle', icon: '🌧️' },
  61: { label: 'Light Rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '🌧️' },
  71: { label: 'Light Snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy Snow', icon: '❄️' },
  77: { label: 'Snow Grains', icon: '🌨️' },
  80: { label: 'Rain Showers', icon: '🌦️' },
  81: { label: 'Rain Showers', icon: '🌦️' },
  82: { label: 'Heavy Showers', icon: '🌧️' },
  85: { label: 'Snow Showers', icon: '🌨️' },
  86: { label: 'Heavy Snow Showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { label: 'Thunderstorm + Heavy Hail', icon: '⛈️' },
};

function getWMO(code: number) {
  return WMO_CODES[code] ?? { label: `Code ${code}`, icon: '❓' };
}

function getWindDirection(deg: number) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function DangerBadge({ level }: { level: DangerLevel }) {
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-white font-bold text-sm"
      style={{ backgroundColor: DANGER_COLORS[level] }}
    >
      {DANGER_LABELS[level]}
    </span>
  );
}

function WeatherCard({ weather }: { weather: WeatherData }) {
  const cw = weather.current_weather;
  if (!cw) return null;

  const wmo = getWMO(cw.weathercode);
  const hourly = weather.hourly;

  // Today's hourly data (next 24h from current time)
  const now = new Date(cw.time);
  const todayHours = hourly?.time
    ? hourly.time.slice(0, 24).map((t, i) => ({
        time: t,
        temp: hourly.temperature_2m?.[i] ?? 0,
        precip: hourly.precipitation?.[i] ?? 0,
        snow: hourly.snowfall?.[i] ?? 0,
        wind: hourly.windspeed_10m?.[i] ?? 0,
        windDir: hourly.winddirection_10m?.[i] ?? 0,
        code: hourly.weathercode?.[i] ?? 0,
      }))
    : [];

  const tomorrowHours = hourly?.time
    ? hourly.time.slice(24, 48).map((t, i) => ({
        time: t,
        temp: hourly.temperature_2m?.[24 + i] ?? 0,
        precip: hourly.precipitation?.[24 + i] ?? 0,
        snow: hourly.snowfall?.[24 + i] ?? 0,
        wind: hourly.windspeed_10m?.[24 + i] ?? 0,
        windDir: hourly.winddirection_10m?.[24 + i] ?? 0,
        code: hourly.weathercode?.[24 + i] ?? 0,
      }))
    : [];

  const todaySnow = todayHours.reduce((s, h) => s + h.snow, 0);
  const tomorrowSnow = tomorrowHours.reduce((s, h) => s + h.snow, 0);
  const todayPrecip = todayHours.reduce((s, h) => s + h.precip, 0);
  const tomorrowPrecip = tomorrowHours.reduce((s, h) => s + h.precip, 0);
  const maxWindToday = Math.max(...todayHours.map(h => h.wind), 0);
  const maxWindTomorrow = Math.max(...tomorrowHours.map(h => h.wind), 0);

  return (
    <div className="space-y-4">
      {/* Current */}
      <div className="flex items-center gap-4">
        <span className="text-5xl">{wmo.icon}</span>
        <div>
          <div className="text-2xl font-bold text-white">{cw.temperature}°C</div>
          <div className="text-slate-400 text-sm">{wmo.label}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-white font-semibold">{cw.windspeed.toFixed(0)} km/h {getWindDirection(cw.winddirection)}</div>
          <div className="text-slate-400 text-sm">Wind</div>
        </div>
      </div>

      {/* 48h Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Today — Next 24h</div>
          <div className="text-white font-bold">{todaySnow.toFixed(0)} cm snow</div>
          <div className="text-slate-400 text-xs">{todayPrecip.toFixed(1)} mm precip</div>
          <div className="text-slate-400 text-xs mt-1">max wind {maxWindToday.toFixed(0)} km/h</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Tomorrow</div>
          <div className="text-white font-bold">{tomorrowSnow.toFixed(0)} cm snow</div>
          <div className="text-slate-400 text-xs">{tomorrowPrecip.toFixed(1)} mm precip</div>
          <div className="text-slate-400 text-xs mt-1">max wind {maxWindTomorrow.toFixed(0)} km/h</div>
        </div>
      </div>
    </div>
  );
}

function NoGoReason({ forecast, weather }: { forecast: UnifiedForecast; weather: WeatherData | null }) {
  const reasons: { icon: string; text: string; severity: 'high' | 'med' | 'low' }[] = [];

  // Danger at Above Treeline
  const aboveTreeline = forecast.dangerByElevation['Above Treeline'] ?? forecast.dangerRating;
  if (aboveTreeline >= 4) {
    reasons.push({
      icon: '⚠️',
      text: `High danger ${DANGER_LABELS[aboveTreeline as DangerLevel]} at and above treeline`,
      severity: 'high',
    });
  } else if (aboveTreeline >= 3) {
    reasons.push({
      icon: '🔶',
      text: `Considerable danger ${DANGER_LABELS[aboveTreeline as DangerLevel]} at and above treeline`,
      severity: 'med',
    });
  }

  // Avalanche problems
  forecast.avalancheProblems.forEach((p: AvalancheProblem) => {
    if (p.likelihood === 'Almost Certain' || p.likelihood === 'Likely') {
      reasons.push({
        icon: '⛷️',
        text: `${p.type} — ${p.likelihood} ${p.size}`,
        severity: 'high',
      });
    }
  });

  // Weather escalation
  if (weather?.hourly) {
    const hourly = weather.hourly;
    const todaySnow = hourly.snowfall?.slice(0, 24).reduce((s, v) => s + v, 0) ?? 0;
    const tomorrowSnow = hourly.snowfall?.slice(24, 48).reduce((s, v) => s + v, 0) ?? 0;
    const maxWind = Math.max(...(hourly.windspeed_10m?.slice(0, 24) ?? [0]));

    if (tomorrowSnow > todaySnow * 1.5) {
      reasons.push({
        icon: '🌨️',
        text: `${tomorrowSnow.toFixed(0)} cm snow expected tomorrow — danger may escalate`,
        severity: 'med',
      });
    }
    if (maxWind > 40) {
      reasons.push({
        icon: '💨',
        text: `Strong winds ${maxWind.toFixed(0)} km/h — wind slab formation likely`,
        severity: 'high',
      });
    }
  }

  if (reasons.length === 0) {
    reasons.push({
      icon: '✅',
      text: 'No immediate avalanche red flags detected',
      severity: 'low',
    });
  }

  return (
    <div className="space-y-2">
      {reasons.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
            r.severity === 'high' ? 'bg-red-900/30 border border-red-800' :
            r.severity === 'med' ? 'bg-orange-900/30 border border-orange-800' :
            'bg-green-900/30 border border-green-800'
          }`}
        >
          <span className="text-xl">{r.icon}</span>
          <span className="text-white text-sm">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function NoGoClient({
  forecasts,
  zones,
  selectedZoneId,
  weather,
}: {
  forecasts: UnifiedForecast[];
  zones: Zone[];
  selectedZoneId: string | null;
  weather: WeatherData | null;
}) {
  const router = useRouter();

  const selectedForecast = useMemo(() => {
    if (!selectedZoneId) return null;
    return forecasts.find(f => f.zoneId === selectedZoneId) ?? null;
  }, [forecasts, selectedZoneId]);

  // Compute GO / NO-GO
  const verdict = useMemo(() => {
    if (!selectedForecast) return null;
    const at = selectedForecast.dangerByElevation['Above Treeline'] ?? selectedForecast.dangerRating;
    const problems = selectedForecast.avalancheProblems;

    const highWind = weather?.current_weather?.windspeed &&
      weather.current_weather.windspeed > 40;
    const heavySnow = (weather?.hourly?.snowfall?.slice(0, 24).reduce((s, v) => s + v, 0) ?? 0) > 30;
    const extremeDanger = at >= 4;
    const certainDanger = problems.some(p => p.likelihood === 'Almost Certain' || p.likelihood === 'Likely');

    if (extremeDanger || certainDanger) {
      return { go: false, reason: 'Extreme avalanche conditions' };
    }
    if (at >= 3 && (highWind || heavySnow)) {
      return { go: false, reason: 'High danger + adverse weather' };
    }
    if (at >= 3) {
      return { go: false, reason: `Considerable danger ${DANGER_LABELS[at as DangerLevel]} at treeline` };
    }
    if (highWind || heavySnow) {
      return { go: true, reason: 'Caution advised — check terrain carefully', caution: true };
    }
    return { go: true, reason: 'Conditions generally safe — always assess terrain', caution: false };
  }, [selectedForecast, weather]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white text-sm transition">← Map</Link>
        <span className="text-slate-600">|</span>
        <span className="text-white font-semibold text-sm">Go / No-Go</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Zone Selector */}
        <div>
          <label className="block text-slate-400 text-xs uppercase tracking-widest mb-2">
            Select Your Zone
          </label>
          <select
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
            value={selectedZoneId ?? ''}
            onChange={e => {
              if (e.target.value) {
                router.push(`/no-go?zone=${e.target.value}`);
              } else {
                router.push('/no-go');
              }
            }}
          >
            <option value="">— Choose a zone —</option>
            <optgroup label="Utah (UAC)">
              {zones.filter(z => z.center === 'UAC').map(z => (
                <option key={z.zoneId} value={z.zoneId}>{z.zone}</option>
              ))}
            </optgroup>
            <optgroup label="Colorado (CAIC)">
              {zones.filter(z => z.center === 'CAIC').map(z => (
                <option key={z.zoneId} value={z.zoneId}>{z.zone}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Verdict */}
        {selectedForecast && verdict && (
          <div className="text-center py-6 space-y-4">
            <div
              className={`inline-block px-12 py-6 rounded-2xl text-5xl font-black tracking-tight ${
                verdict.go
                  ? verdict.caution
                    ? 'bg-yellow-600 text-yellow-100'
                    : 'bg-green-600 text-green-100'
                  : 'bg-red-700 text-red-100'
              }`}
            >
              {verdict.go ? (verdict.caution ? '⚠️ CAUTION' : '✅  GO') : '🚫  NO-GO'}
            </div>
            <div className="text-slate-400 text-sm">{verdict.reason}</div>
          </div>
        )}

        {!selectedZoneId && (
          <div className="text-center py-16 text-slate-500">
            Select a zone above to get your go/no-go recommendation
          </div>
        )}

        {selectedZoneId && !selectedForecast && (
          <div className="text-center py-16 text-slate-500">
            No forecast data available for this zone
          </div>
        )}

        {/* Details */}
        {selectedForecast && verdict && (
          <div className="space-y-6">
            {/* Danger at treeline */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Danger at Treeline</h3>
              <div className="grid grid-cols-3 gap-2">
                {ELEVATIONS.map(elev => {
                  const danger = selectedForecast.dangerByElevation[elev] ?? selectedForecast.dangerRating;
                  return (
                    <div key={elev} className="bg-slate-900 rounded-lg p-3 text-center">
                      <div className="text-slate-400 text-xs mb-2">{elev}</div>
                      <div
                        className="inline-block px-2 py-1 rounded text-white text-sm font-bold"
                        style={{ backgroundColor: DANGER_COLORS[danger as DangerLevel] }}
                      >
                        {DANGER_LABELS[danger as DangerLevel]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weather */}
            {weather && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Weather — Open-Meteo</h3>
                <WeatherCard weather={weather} />
              </div>
            )}

            {/* Reasons */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Reasoning</h3>
              <NoGoReason forecast={selectedForecast} weather={weather} />
            </div>

            {/* Avalanche Problems */}
            {selectedForecast.avalancheProblems.length > 0 && (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">
                  Avalanche Problems ({selectedForecast.avalancheProblems.length})
                </h3>
                <div className="space-y-2">
                  {selectedForecast.avalancheProblems.map((p: AvalancheProblem, i: number) => (
                    <div key={i} className="bg-slate-900 rounded-lg px-4 py-3 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold text-sm">{p.type}</span>
                        <span className="text-slate-400 text-xs">{p.likelihood} · {p.size}</span>
                      </div>
                      {p.aspect && (
                        <div className="text-slate-500 text-xs mt-1">
                          Aspects: {p.aspect.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forecast stretch note */}
            <div className="bg-slate-900/50 rounded-lg px-4 py-3 text-slate-500 text-xs text-center">
              Advisory valid through {new Date(selectedForecast.validDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — conditions may evolve; check back for updates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
