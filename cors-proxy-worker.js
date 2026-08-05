// 気配盤(kiseiban.html)用 データ中継Worker(Twelve Data版)
//
// freeforexapi.comは実質的にサービスが停止しており(Cloudflare Workerからのサーバー間
// 通信でも 522 Connection timed out が返る)、代わりにTwelve Data
// (https://twelvedata.com/)の無料枠(1日800リクエスト・1分8リクエスト)を使ってレート
// を取得し、index.html側が期待する {rates:{USDJPY:{rate,timestamp}, ...}} 形式に変換
// して返す。無料枠を超えないよう、Worker側で数分間キャッシュしている。
//
// デプロイ手順:
// 1. https://twelvedata.com/ で無料アカウントを作成し、APIキーを取得する
// 2. https://dash.cloudflare.com/ → Workers & Pages → 対象のWorkerを開く →
//    「Settings」タブ →「Variables and Secrets」→「Add」で
//      種類: Secret
//      名前: TWELVEDATA_API_KEY
//      値:   取得したAPIキー
//    を追加して保存する(公開リポジトリのコードにキーを直接書かないため)
// 3. このファイルの内容をWorkerのコードエディタに丸ごと貼り付けて「Deploy」
//
// 無料枠の消費が気になる場合(Twelve Dataのダッシュボードで使用量を確認できます)は、
// 下のCACHE_TTL_SECONDSを大きくしてください。3ペアをまとめて取得するため、
// 1回のアップストリーム呼び出しで複数クレジットを消費する可能性を見込んで
// デフォルトは保守的に300秒(5分)にしている。

const SYMBOLS = 'USD/JPY,EUR/JPY,GBP/JPY';
const SYMBOL_TO_PAIR = { 'USD/JPY': 'USDJPY', 'EUR/JPY': 'EURJPY', 'GBP/JPY': 'GBPJPY' };
const CACHE_TTL_SECONDS = 300;

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

    if (!env.TWELVEDATA_API_KEY) {
      return withCors(JSON.stringify({
        error: 'TWELVEDATA_API_KEY未設定。WorkerのSettings > Variables and SecretsでSecretを追加してください。',
      }), 500);
    }

    try {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(SYMBOLS)}&apikey=${env.TWELVEDATA_API_KEY}`;
      const upstream = await fetch(url);
      const text = await upstream.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return withCors(JSON.stringify({
          error: 'upstream_not_json', status: upstream.status, body: text.slice(0, 300),
        }), 502);
      }

      const rates = {};
      for (const [symbol, pair] of Object.entries(SYMBOL_TO_PAIR)) {
        const q = data[symbol];
        if (!q || q.close == null) continue;
        let ts = Math.floor(Date.now() / 1000);
        if (q.timestamp) {
          ts = q.timestamp;
        } else if (q.datetime) {
          const parsed = Date.parse(q.datetime);
          if (!isNaN(parsed)) ts = Math.floor(parsed / 1000);
        }
        rates[pair] = { rate: parseFloat(q.close), timestamp: ts };
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
