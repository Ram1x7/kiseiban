// 気配盤(kiseiban.html)用 データ中継Worker(OANDA practice API版)
//
// freeforexapi.comは実質的にサービス停止、Twelve Dataは無料枠(800クレジット/日、
// シンボルごとに1クレジット消費)だと3ペア同時取得で5分に1回程度が限界だった。
// OANDAの「プラクティス(デモ)口座」は無料で本人確認のみで開設でき、REST APIの
// レート制限が120リクエスト/秒と非常に緩いため、ほぼリアルタイムに近い頻度で
// レートを取得できる。取得した価格を index.html側が期待する
// {rates:{USDJPY:{rate,timestamp}, ...}} 形式に変換して返す。
//
// 注意: OANDAのプラクティス口座は仮想資金でのペーパートレード用であり、実際の
// 資金移動は一切発生しない。ここでは「無料のレートデータ供給源」としてのみ使う。
//
// デプロイ手順:
// 1. https://www.oanda.com/ でプラクティス(デモ)口座を作成する(本人確認あり)
// 2. ログイン後「My Account」→「My Services」→「Manage API Access」で
//    Personal Access Tokenを発行する
// 3. 口座一覧(Account一覧)から accountID(例: 101-009-XXXXXXX-001 のような形式)
//    を確認する
// 4. https://dash.cloudflare.com/ → Workers & Pages → 対象のWorkerを開く →
//    「Settings」タブ →「Variables and Secrets」→「Add」で以下の2つをSecretとして追加:
//      OANDA_API_TOKEN  = 発行したPersonal Access Token
//      OANDA_ACCOUNT_ID = 確認したaccountID
// 5. このファイルの内容をWorkerのコードエディタに丸ごと貼り付けて「Deploy」

const INSTRUMENTS = 'USD_JPY,EUR_JPY,GBP_JPY';
const INSTRUMENT_TO_PAIR = { USD_JPY: 'USDJPY', EUR_JPY: 'EURJPY', GBP_JPY: 'GBPJPY' };
// OANDAのレート制限(120req/秒)に対して十分な余裕があるが、同時に複数タブを
// 開いた場合の重複呼び出しを避けるため、ごく短時間だけキャッシュする。
const CACHE_TTL_SECONDS = 5;
const OANDA_BASE_URL = 'https://api-fxpractice.oanda.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(body, status){
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const cache = caches.default;
    const cacheKey = new Request('https://kiseiban-proxy.internal/quote-cache');
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCors(await cached.text(), 200);
    }

    if (!env.OANDA_API_TOKEN || !env.OANDA_ACCOUNT_ID) {
      return withCors(JSON.stringify({
        error: 'OANDA_API_TOKENまたはOANDA_ACCOUNT_ID未設定。WorkerのSettings > Variables and SecretsでSecretを追加してください。',
      }), 500);
    }

    try {
      const url = `${OANDA_BASE_URL}/v3/accounts/${env.OANDA_ACCOUNT_ID}/pricing?instruments=${encodeURIComponent(INSTRUMENTS)}`;
      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${env.OANDA_API_TOKEN}` },
      });
      const text = await upstream.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return withCors(JSON.stringify({
          error: 'upstream_not_json', status: upstream.status, body: text.slice(0, 300),
        }), 502);
      }

      if (!upstream.ok) {
        return withCors(JSON.stringify({
          error: 'oanda_error', status: upstream.status, body: data,
        }), 502);
      }

      const rates = {};
      const prices = Array.isArray(data.prices) ? data.prices : [];
      for (const p of prices) {
        const pair = INSTRUMENT_TO_PAIR[p.instrument];
        if (!pair) continue;
        const bid = p.bids && p.bids[0] && parseFloat(p.bids[0].price);
        const ask = p.asks && p.asks[0] && parseFloat(p.asks[0].price);
        if (!bid || !ask) continue;
        const parsedTime = Date.parse(p.time);
        rates[pair] = {
          rate: (bid + ask) / 2,
          timestamp: isNaN(parsedTime) ? Math.floor(Date.now() / 1000) : Math.floor(parsedTime / 1000),
        };
      }

      if (Object.keys(rates).length === 0) {
        return withCors(JSON.stringify({ error: 'no_rates_parsed', upstream: data }), 502);
      }

      const resultBody = JSON.stringify({ rates });
      const cacheResponse = new Response(resultBody, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResponse));

      return withCors(resultBody, 200);
    } catch (err) {
      return withCors(JSON.stringify({ error: String(err) }), 502);
    }
  },
};
