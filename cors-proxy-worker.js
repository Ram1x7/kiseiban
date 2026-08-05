// 気配盤(kiseiban.html)用 CORS中継Worker
//
// freeforexapi.com はブラウザからの直接fetch(CORS)に対応していないため、
// GitHub Pages(静的サイト)からは直接呼び出せない。このWorkerをCloudflare Workersに
// デプロイし、index.html側の「データ取得プロキシURL」欄にデプロイ後のURL
// (例: https://xxxx.yyyy.workers.dev)を設定すると、このWorkerがサーバーサイドで
// freeforexapi.comを呼び出し、CORSヘッダーを付けて結果をそのまま返す。
//
// デプロイ手順:
// 1. https://dash.cloudflare.com/ にログイン(無料アカウントで可)
// 2. 左メニュー「Workers & Pages」→「Create」→「Create Worker」
// 3. 生成されたエディタの中身をこのファイルの内容で置き換えて「Deploy」
// 4. 発行されたURL(https://xxxx.workers.dev)を index.html の
//    「データ取得プロキシURL」欄に貼り付ける

const UPSTREAM_URL = 'https://www.freeforexapi.com/api/live?pairs=USDJPY,EURJPY,GBPJPY';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const upstream = await fetch(UPSTREAM_URL);
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
