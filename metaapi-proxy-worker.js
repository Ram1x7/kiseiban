// Gravia(index.html)用 MetaApi CORS中継Worker
//
// MetaApiの取引用REST API(mt-client-api-v1.*, mt-market-data-client-api-v1.*)は
// サーバーサイドからの利用を前提としており、ブラウザからの直接fetch(CORS)には
// 対応していない。このWorkerがサーバーサイドでMetaApiを呼び出し、CORSヘッダーを
// 付けて結果をそのまま返す。認証トークンはブラウザからのリクエストヘッダーを
// そのまま転送するだけで、Worker自体はトークンを保持・記録しない。
//
// セキュリティ上、agiliumtrade.ai(MetaApiのドメイン)以外への転送は拒否する
// (誰でも使える汎用CORSプロキシにはしない)。
//
// デプロイ手順:
// 1. https://dash.cloudflare.com/ → Workers & Pages → Create →
//    「Hello World」等の空のテンプレートから作成(「Import a repository」は選ばない)
// 2. エディタの中身をこのファイルの内容で丸ごと置き換えて Deploy
// 3. 発行されたURL(https://xxxx.workers.dev)を config.js の
//    WORKER_PROXY_URL に設定する(末尾のスラッシュは不要)

const ALLOWED_HOST_SUFFIX = '.agiliumtrade.ai';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, auth-token, Accept',
};

function errorResponse(status, message){
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const target = reqUrl.searchParams.get('url');
    if (!target) return errorResponse(400, 'missing url query param');

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (e) {
      return errorResponse(400, 'invalid url: ' + target);
    }

    if (!targetUrl.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      return errorResponse(403, 'host not allowed: ' + targetUrl.hostname);
    }

    try {
      const upstreamHeaders = new Headers();
      const authToken = request.headers.get('auth-token');
      if (authToken) upstreamHeaders.set('auth-token', authToken);
      upstreamHeaders.set('Accept', 'application/json');
      const contentType = request.headers.get('Content-Type');
      if (contentType) upstreamHeaders.set('Content-Type', contentType);

      const hasBody = !(request.method === 'GET' || request.method === 'HEAD');
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: hasBody ? await request.text() : undefined,
      });

      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (err) {
      return errorResponse(502, String(err));
    }
  },
};
