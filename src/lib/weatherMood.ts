/**
 * weatherMood — maps WMO weather codes to MoodMode via OpenMeteo (free, no key).
 * Caches results for 30 minutes in sessionStorage.
 */
import type { MoodMode } from "@/types/mood";

export type WeatherCondition = "sunny" | "cloudy" | "rainy" | "stormy" | "snowy" | "windy";

// WMO code → MoodMode
const WMO_TO_MOOD: Record<string, MoodMode> = {
    "0": "fest", // Clear sky
    "1": "fest", // Mainly clear
    "2": "journey", // Partly cloudy
    "3": "dock", // Overcast
    "45": "dock", // Fog
    "48": "dock", // Icy fog
    "51": "dock", // Drizzle light
    "53": "dock", // Drizzle moderate
    "55": "storm", // Drizzle dense
    "61": "storm", // Rain slight
    "63": "storm", // Rain moderate
    "65": "storm", // Rain heavy
    "71": "dock", // Snow slight
    "73": "dock", // Snow moderate
    "75": "dock", // Snow heavy
    "77": "dock", // Snow grains
    "80": "storm", // Rain showers slight
    "81": "storm", // Rain showers moderate
    "82": "storm", // Rain showers violent
    "85": "dock", // Snow showers slight
    "86": "dock", // Snow showers heavy
    "95": "storm", // Thunderstorm slight
    "96": "storm", // Thunderstorm with hail
    "99": "storm", // Thunderstorm with heavy hail
};

// WMO code → condition category
const WMO_TO_CONDITION: Record<string, WeatherCondition> = {
    "0": "sunny",
    "1": "sunny",
    "2": "cloudy",
    "3": "cloudy",
    "45": "cloudy",
    "48": "cloudy",
    "51": "rainy",
    "53": "rainy",
    "55": "rainy",
    "61": "rainy",
    "63": "rainy",
    "65": "rainy",
    "71": "snowy",
    "73": "snowy",
    "75": "snowy",
    "77": "snowy",
    "80": "rainy",
    "81": "rainy",
    "82": "stormy",
    "85": "snowy",
    "86": "snowy",
    "95": "stormy",
    "96": "stormy",
    "99": "stormy",
};

const WMO_DESCRIPTIONS: Record<string, string> = {
    "0": "Clear sky",
    "1": "Mainly clear",
    "2": "Partly cloudy",
    "3": "Overcast",
    "45": "Foggy",
    "48": "Icy fog",
    "51": "Light drizzle",
    "53": "Moderate drizzle",
    "55": "Dense drizzle",
    "61": "Slight rain",
    "63": "Moderate rain",
    "65": "Heavy rain",
    "71": "Slight snow",
    "73": "Moderate snow",
    "75": "Heavy snow",
    "77": "Snow grains",
    "80": "Slight showers",
    "81": "Moderate showers",
    "82": "Violent showers",
    "85": "Slight snow showers",
    "86": "Heavy snow showers",
    "95": "Thunderstorm",
    "96": "Thunderstorm + hail",
    "99": "Thunderstorm + heavy hail",
};

const CACHE_KEY = "wideria-weather-mood";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface WeatherCache {
    ts: number;
    mood: MoodMode;
    condition: WeatherCondition;
    description: string;
}

function loadCache(): WeatherCache | null {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as WeatherCache;
        if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveCache(data: WeatherCache): void {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
        // ignore
    }
}

function timeOfDayMoodHint(): MoodMode {
    const h = new Date().getHours();
    if (h >= 6 && h < 9) return "journey";
    if (h >= 9 && h < 17) return "fest";
    if (h >= 17 && h < 20) return "dock";
    return "disco";
}

function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not available"));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 8000,
            maximumAge: 10 * 60 * 1000,
        });
    });
}

export interface WeatherMoodResult {
    mood: MoodMode;
    condition: WeatherCondition;
    description: string;
}

export async function fetchWeatherMood(): Promise<WeatherMoodResult | null> {
    const cached = loadCache();
    if (cached) return cached;

    try {
        const pos = await getPosition();
        const { latitude, longitude } = pos.coords;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current_weather=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = (await res.json()) as { current_weather?: { weathercode?: number } };
        const code = String(data.current_weather?.weathercode ?? "0");
        const mood: MoodMode = WMO_TO_MOOD[code] ?? timeOfDayMoodHint();
        const condition: WeatherCondition = WMO_TO_CONDITION[code] ?? "cloudy";
        const description = WMO_DESCRIPTIONS[code] ?? "Unknown";
        const result: WeatherMoodResult = { mood, condition, description };
        saveCache({ ...result, ts: Date.now() });
        return result;
    } catch {
        return null;
    }
}

export async function getSuggestedMood(): Promise<MoodMode> {
    const result = await fetchWeatherMood();
    return result?.mood ?? timeOfDayMoodHint();
}

export function getSuggestedWeatherCondition(): WeatherCondition | null {
    const cached = loadCache();
    return cached?.condition ?? null;
}
