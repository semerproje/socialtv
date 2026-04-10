import { NextResponse } from 'next/server';
import type { MarketData } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Fetch exchange rates & crypto in parallel
    const [fxRes, cryptoRes] = await Promise.allSettled([
      fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 300 } }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,try', {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 },
      }),
    ]);

    let usdTry = 0;
    let eurUsd = 0;
    let gbpUsd = 0;
    let xauUsd = 0; // Gold oz/USD rate (fraction: e.g. 0.0004 means 1 USD = 0.0004 oz)

    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      const fxData = await fxRes.value.json();
      const rates = fxData.rates ?? {};
      usdTry = rates.TRY ?? 0;
      eurUsd = rates.EUR ?? 0;  // EUR per 1 USD
      gbpUsd = rates.GBP ?? 0;
      xauUsd = rates.XAU ?? 0; // oz gold per 1 USD
    }

    // Convert to TRY
    const eurTry = eurUsd > 0 ? usdTry / eurUsd : 0;
    const gbpTry = gbpUsd > 0 ? usdTry / gbpUsd : 0;

    // Gold price per gram in TRY
    // 1 oz = 31.1035 grams; xauUsd = oz/USD meaning 1 USD = xauUsd oz → 1 oz = 1/xauUsd USD
    const goldOzUsd = xauUsd > 0 ? 1 / xauUsd : 2350; // fallback ~$2350/oz
    const goldGramUsd = goldOzUsd / 31.1035;
    const goldGramTry = goldGramUsd * usdTry;

    let btcUsd = 0; let btcTry = 0;
    let ethUsd = 0; let ethTry = 0;

    if (cryptoRes.status === 'fulfilled' && cryptoRes.value.ok) {
      const cData = await cryptoRes.value.json();
      btcUsd = cData.bitcoin?.usd ?? 0;
      btcTry = cData.bitcoin?.try ?? btcUsd * usdTry;
      ethUsd = cData.ethereum?.usd ?? 0;
      ethTry = cData.ethereum?.try ?? ethUsd * usdTry;
    }

    const markets: MarketData = {
      timestamp: new Date().toISOString(),
      currencies: [
        { code: 'USD', name: 'Dolar', rate: parseFloat(usdTry.toFixed(2)) },
        { code: 'EUR', name: 'Euro', rate: parseFloat(eurTry.toFixed(2)) },
        { code: 'GBP', name: 'Sterlin', rate: parseFloat(gbpTry.toFixed(2)) },
      ].filter((c) => c.rate > 0),
      metals: goldOzUsd > 0 ? [
        {
          code: 'XAU',
          name: 'Altın (gram)',
          priceTRY: parseFloat(goldGramTry.toFixed(2)),
          priceUSD: parseFloat(goldGramUsd.toFixed(2)),
        },
      ] : [],
      crypto: [
        ...(btcUsd > 0 ? [{ code: 'BTC', name: 'Bitcoin', priceUSD: btcUsd, priceTRY: Math.round(btcTry) }] : []),
        ...(ethUsd > 0 ? [{ code: 'ETH', name: 'Ethereum', priceUSD: ethUsd, priceTRY: Math.round(ethTry) }] : []),
      ],
    };

    return NextResponse.json({ success: true, data: markets }, {
      headers: { 'Cache-Control': 'public, s-maxage=300', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Markets API error:', error);
    return NextResponse.json({ success: false, error: 'Markets fetch failed' }, { status: 500 });
  }
}
