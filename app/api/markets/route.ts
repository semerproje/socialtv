import { NextResponse } from 'next/server';
import type { MarketData } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Fetch exchange rates & crypto in parallel
    const [fxRes, cryptoRes] = await Promise.allSettled([
      fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 180 } }),
      fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin&vs_currencies=usd,try&include_24hr_change=true',
        { headers: { Accept: 'application/json' }, next: { revalidate: 180 } },
      ),
    ]);

    let usdTry = 0, eurUsd = 0, gbpUsd = 0, chfUsd = 0, jpyUsd = 0;
    let xauUsd = 0, xagUsd = 0; // oz per USD

    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      const fxData = await fxRes.value.json();
      const rates = fxData.rates ?? {};
      usdTry  = rates.TRY ?? 0;
      eurUsd  = rates.EUR ?? 0;
      gbpUsd  = rates.GBP ?? 0;
      chfUsd  = rates.CHF ?? 0;
      jpyUsd  = rates.JPY ?? 0;
      xauUsd  = rates.XAU ?? 0;
      xagUsd  = rates.XAG ?? 0;
    }

    // Convert to TRY
    const eurTry = eurUsd > 0 ? usdTry / eurUsd : 0;
    const gbpTry = gbpUsd > 0 ? usdTry / gbpUsd : 0;
    const chfTry = chfUsd > 0 ? usdTry / chfUsd : 0;
    const jpyTry = jpyUsd > 0 ? usdTry / jpyUsd : 0; // per 100 JPY

    // Gold & Silver gram prices in TRY
    const goldOzUsd   = xauUsd > 0 ? 1 / xauUsd : 2350;
    const goldGramUsd = goldOzUsd / 31.1035;
    const goldGramTry = goldGramUsd * usdTry;

    const silverOzUsd   = xagUsd > 0 ? 1 / xagUsd : 28;
    const silverGramUsd = silverOzUsd / 31.1035;
    const silverGramTry = silverGramUsd * usdTry;

    // Crypto
    let btcUsd = 0, btcTry = 0, btcChg = 0;
    let ethUsd = 0, ethTry = 0, ethChg = 0;
    let solUsd = 0, solTry = 0, solChg = 0;
    let xrpUsd = 0, xrpTry = 0, xrpChg = 0;
    let bnbUsd = 0, bnbTry = 0, bnbChg = 0;

    if (cryptoRes.status === 'fulfilled' && cryptoRes.value.ok) {
      const cd = await cryptoRes.value.json();
      btcUsd = cd.bitcoin?.usd ?? 0;       btcTry = cd.bitcoin?.try ?? btcUsd * usdTry;       btcChg = cd.bitcoin?.usd_24h_change ?? 0;
      ethUsd = cd.ethereum?.usd ?? 0;      ethTry = cd.ethereum?.try ?? ethUsd * usdTry;      ethChg = cd.ethereum?.usd_24h_change ?? 0;
      solUsd = cd.solana?.usd ?? 0;        solTry = cd.solana?.try ?? solUsd * usdTry;        solChg = cd.solana?.usd_24h_change ?? 0;
      xrpUsd = cd.ripple?.usd ?? 0;        xrpTry = cd.ripple?.try ?? xrpUsd * usdTry;        xrpChg = cd.ripple?.usd_24h_change ?? 0;
      bnbUsd = cd['binancecoin']?.usd ?? 0; bnbTry = cd['binancecoin']?.try ?? bnbUsd * usdTry; bnbChg = cd['binancecoin']?.usd_24h_change ?? 0;
    }

    const markets: MarketData = {
      timestamp: new Date().toISOString(),
      currencies: [
        { code: 'USD', name: 'Dolar',   rate: parseFloat(usdTry.toFixed(3)) },
        { code: 'EUR', name: 'Euro',    rate: parseFloat(eurTry.toFixed(3)) },
        { code: 'GBP', name: 'Sterlin', rate: parseFloat(gbpTry.toFixed(3)) },
        { code: 'CHF', name: 'İsviçre Frangı', rate: parseFloat(chfTry.toFixed(3)) },
        { code: 'JPY', name: 'Japon Yeni (100)', rate: parseFloat((jpyTry * 100).toFixed(3)) },
      ].filter((c) => c.rate > 0),
      metals: [
        ...(goldOzUsd > 0 ? [{
          code: 'XAU', name: 'Altın',
          priceTRY: parseFloat(goldGramTry.toFixed(2)),
          priceUSD: parseFloat(goldGramUsd.toFixed(4)),
          unit: 'gram' as const,
        }] : []),
        ...(silverOzUsd > 0 ? [{
          code: 'XAG', name: 'Gümüş',
          priceTRY: parseFloat(silverGramTry.toFixed(2)),
          priceUSD: parseFloat(silverGramUsd.toFixed(4)),
          unit: 'gram' as const,
        }] : []),
      ],
      crypto: [
        ...(btcUsd > 0 ? [{ code: 'BTC', name: 'Bitcoin',  priceUSD: btcUsd, priceTRY: Math.round(btcTry), change: parseFloat(btcChg.toFixed(2)) }] : []),
        ...(ethUsd > 0 ? [{ code: 'ETH', name: 'Ethereum', priceUSD: ethUsd, priceTRY: Math.round(ethTry), change: parseFloat(ethChg.toFixed(2)) }] : []),
        ...(bnbUsd > 0 ? [{ code: 'BNB', name: 'BNB',      priceUSD: bnbUsd, priceTRY: Math.round(bnbTry), change: parseFloat(bnbChg.toFixed(2)) }] : []),
        ...(solUsd > 0 ? [{ code: 'SOL', name: 'Solana',   priceUSD: solUsd, priceTRY: Math.round(solTry), change: parseFloat(solChg.toFixed(2)) }] : []),
        ...(xrpUsd > 0 ? [{ code: 'XRP', name: 'XRP',      priceUSD: xrpUsd, priceTRY: Math.round(xrpTry), change: parseFloat(xrpChg.toFixed(2)) }] : []),
      ],
    };

    return NextResponse.json({ success: true, data: markets }, {
      headers: { 'Cache-Control': 'public, s-maxage=180', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('Markets API error:', error);
    return NextResponse.json({ success: false, error: 'Markets fetch failed' }, { status: 500 });
  }
}
