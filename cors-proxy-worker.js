// 気配盤(kiseiban.html)用 データ中継Worker(OANDA Japan v1 API版)
//
// freeforexapi.comは実質的にサービス停止、Twelve Dataは無料枠(800クレジット/日、
// シンボルごとに1クレジット消費)だと3ペア同時取得で5分に1回程度が限界だった。
// OANDA証券(oanda.jp)のプラクティス(デモ)口座なら無料でREST APIが使え、
// レート取得(/v1/prices)にはaccountIdも不要でトークンだけで叩ける。
//
// 注意:
// - OANDA Japanは国際版OANDAとは別の、旧世代の「v1 API」を使用している
//   (https://developer.oanda.com/docs/jp/v1/ 参照。国際版のv20 APIとは
//   エンドポイント・レスポンス形式が異なるので注意)
// - プラクティス口座は仮想資金でのペーパートレード用であり、実際の資金移動は
//   一切発生しない。ここでは「無料のレートデータ供給源」としてのみ使う
// - OANDA Japanのデモ口座には利用期限(登録から約30日、規約により変動あり)が
//   あるため、期限が来たら口座を作り直し、Workerのシークレットを更新する必要がある
//
// デプロイ手順:
// 1. https://www.oanda.jp/ でプラクティス(デモ)口座を作成する(本人確認あり)
// 2. マイページにログイン後、左メニューの「口座管理」→「APIアクセスの管理」で
//    「REST APIトークンを発行する」をクリックしてトークンを発行する
// 3. https://dash.cloudflare.com/ → Workers & Pages → 対象のWorkerを開く →
//    「Settings」タブ →「Variables and Secrets」→「Add」で以下をSecretとして追加:
//      OANDA_API_TOKEN = 発行したAPIトークン
// 4. このファイルの内容をWorkerのコードエディタに丸ごと貼り付けて「Deploy」

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

    if (!env.OANDA_API_TOKEN) {
      return withCors(JSON.stringify({
        error: 'OANDA_API_TOKEN未設定。WorkerのSettings > Variables and SecretsでSecretを追加してください。',
      }), 500);
    }

    try {
      const url = `${OANDA_BASE_URL}/v1/prices?instruments=${encodeURIComponent(INSTRUMENTS)}`;
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
        if (typeof p.bid !== 'number' || typeof p.ask !== 'number') continue;
        const parsedTime = Date.parse(p.time);
        rates[pair] = {
          rate: (p.bid + p.ask) / 2,
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
