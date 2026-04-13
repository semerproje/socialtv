import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNextAd } from '@/lib/ad-scheduler';
import { getWeatherDescription } from '@/lib/utils';
import type { DisplayData, WeatherData, MarketData, NewsItem } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchWeather(lat: string, lon: string): Promise<WeatherData | undefined> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=4&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return undefined;

    const json = await res.json();
    const c = json.current;
    const code = c.weather_code as number;

    // Build 3-day forecast (skip today — index 0)
    const forecast = (json.daily?.time ?? []).slice(1, 4).map((date: string, i: number) => {
      const fc = json.daily;
      const wcode = fc.weather_code[i + 1] as number;
      return {
        date,
        tempMax: Math.round(fc.temperature_2m_max[i + 1]),
        tempMin: Math.round(fc.temperature_2m_min[i + 1]),
        weatherCode: wcode,
        description: getWeatherDescription(wcode),
      };
    });

    return {
      city: '',
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      weatherCode: code,
      description: getWeatherDescription(code),
      icon: '',
      forecast: forecast.length > 0 ? forecast : undefined,
    };
  } catch {
    return undefined;
  }
}

async function fetchMarkets(): Promise<MarketData | undefined> {
  try {
    // Prefer server-to-server URL in production, fall back to local for dev
    const base = process.env.INTERNAL_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/markets`, { next: { revalidate: 300 } });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.data ?? undefined;
  } catch { return undefined; }
}

async function fetchNews(): Promise<NewsItem[] | undefined> {
  try {
    const base = process.env.INTERNAL_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const res = await fetch(`${base}/api/news?limit=10`, { next: { revalidate: 600 } });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.data ?? undefined;
  } catch { return undefined; }
}

export async function GET() {
  try {
    // Fetch all data in parallel
    const [settings, content, tickers, currentAd] = await Promise.all([
      db.setting.findMany(),
      db.content.findMany({
        where: { isApproved: true, moderationPassed: true },
        orderBy: [{ isFeatured: 'desc' }, { isHighlight: 'desc' }, { postedAt: 'desc' }],
        take: 12,
      }),
      db.tickerMessage.findMany({
        where: {
          isActive: true,
          endDate: true,  // filter expired tickers
        },
      }),
      getNextAd(),
    ]);

    const settingsMap = Object.fromEntries(settings.map((s: { key: string; value: string }) => [s.key, s.value]));

    // Fetch weather + markets + news in parallel
    const lat = settingsMap.weather_lat ?? '41.0082';
    const lon = settingsMap.weather_lon ?? '28.9784';
    const showMarkets = settingsMap.show_markets !== 'false';
    const showNews = settingsMap.show_news !== 'false';

    const [weather, markets, newsResult] = await Promise.allSettled([
      fetchWeather(lat, lon),
      showMarkets ? fetchMarkets() : Promise.resolve(undefined),
      showNews ? fetchNews() : Promise.resolve(undefined),
    ]);

    const weatherData = weather.status === 'fulfilled' ? weather.value : undefined;
    const marketsData = markets.status === 'fulfilled' ? markets.value : undefined;
    const newsData = newsResult.status === 'fulfilled' ? newsResult.value : undefined;

    if (weatherData) {
      weatherData.city = settingsMap.weather_city ?? 'İstanbul';
    }

    // Get next ad (for pre-loading)
    const nextAd = currentAd ? await getNextAd(currentAd.id) : null;

    const displayData: DisplayData = {
      currentAd: currentAd as DisplayData['currentAd'],
      nextAd: nextAd as DisplayData['nextAd'],
      content: content as unknown as DisplayData['content'],
      tickers: tickers as unknown as DisplayData['tickers'],
      settings: settingsMap,
      weather: weatherData,
      markets: marketsData,
      news: newsData,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(displayData, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Display API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
