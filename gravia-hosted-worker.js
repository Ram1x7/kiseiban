// gravia-hosted-worker.js
//
// Gravia全体(ダッシュボード + MetaApi中継)を、このCloudflare Worker一つだけで
// ホストするためのスクリプトです。iPad/iPhoneのSafariから普通の https:// URL
// として開けるようにすることが目的です(ローカルファイルやWorking Copyの
// プレビュー機能に依存しません)。
//
// 重要: MetaApiのAPIトークンはこのWorkerの「Secret」としてのみ保存し、
// 配信するHTML/JSには一切含めません。ブラウザ側のJavaScriptは
// トークンの実際の値を知ることも送信することもなく、この同じWorkerの
// 中継エンドポイント(?url=...)にリクエストするだけです。実トークンは
// Cloudflare側でこのWorkerがMetaApiへ転送する際にサーバー側で付与します。
//
// さらに重要: このWorkerはURLさえ知っていれば誰でも開けます(パスワード等
// なし)。実トークンをサーバー側で自動付与する設計上、もしURLが漏れると
// 誰でも口座情報の閲覧・発注ができてしまいます。これを防ぐため、
// ACCESS_KEY という共有シークレットをこのWorkerのSecretとして必ず設定し、
// ダッシュボードには `https://xxxx.workers.dev/?key=<ACCESS_KEYの値>` の
// 形式のURL(キー付き)でアクセスしてください。キーが一致しない、または
// ACCESS_KEY自体が未設定の場合はすべてのリクエストを拒否します。
//
// デプロイ手順・Secret/変数の設定方法は README.md を参照してください。

const ALLOWED_HOST_SUFFIX = '.agiliumtrade.ai';

// ダッシュボード本体(index.html)の取得元。GitHub Pages上のindex.htmlは
// config.jsが存在しないため常にシミュレーションモードのソースであり、
// トークン等の秘密情報は一切含まれません。このWorkerが取得後にCONFIGだけ
// 差し替えて配信します。
const SOURCE_HTML_URL = 'https://ram1x7.github.io/kiseiban/index.html';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, auth-token, Accept',
};

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== '' ? n : fallback;
}

function checkAccessKey(reqUrl, env) {
  if (!env.ACCESS_KEY) {
    return errorResponse(500, 'ACCESS_KEY secret not configured on this Worker. このWorkerはURLを知る誰でも開けてしまうため、README.mdの手順に従いACCESS_KEYを必ず設定してください。');
  }
  const provided = reqUrl.searchParams.get('key') || '';
  if (provided !== env.ACCESS_KEY) {
    return errorResponse(403, 'invalid or missing key');
  }
  return null;
}

async function handleProxy(request, targetParam, env) {
  let targetUrl;
  try {
    targetUrl = new URL(targetParam);
  } catch (e) {
    return errorResponse(400, 'invalid url: ' + targetParam);
  }
  if (!targetUrl.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return errorResponse(403, 'host not allowed: ' + targetUrl.hostname);
  }
  if (!env.METAAPI_TOKEN) {
    return errorResponse(500, 'METAAPI_TOKEN secret not configured on this Worker (Settings > Variables and Secrets)');
  }

  try {
    const upstreamHeaders = new Headers();
    // 実トークンはここでサーバー側からのみ付与する。クライアントが送った
    // auth-tokenヘッダーがあっても無視する(そもそもクライアントは実トークンを
    // 知らない)。
    upstreamHeaders.set('auth-token', env.METAAPI_TOKEN);
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
}

async function handleDashboard(reqUrl, env) {
  let html;
  try {
    const src = await fetch(SOURCE_HTML_URL, { cf: { cacheTtl: 30, cacheEverything: true } });
    if (!src.ok) throw new Error('HTTP ' + src.status);
    html = await src.text();
  } catch (err) {
    return new Response('ダッシュボードの取得に失敗しました(SOURCE_HTML_URLを確認してください): ' + err, { status: 502 });
  }

  if (!env.METAAPI_ACCOUNT_ID) {
    return new Response(
      'METAAPI_ACCOUNT_ID が未設定です。Cloudflareダッシュボード > Workers & Pages > このWorker > Settings > Variables and Secrets で設定してください。',
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  // クライアントに渡すCONFIG。METAAPI_TOKENは実トークンではなく、
  // LIVE_MODE判定を有効にするためだけのダミー文字列。実際の認証は
  // このWorkerが中継時にサーバー側で行う。
  const config = {
    METAAPI_TOKEN: 'server-side-only',
    METAAPI_ACCOUNT_ID: env.METAAPI_ACCOUNT_ID,
    METAAPI_REGION: env.METAAPI_REGION || 'new-york',
    SYMBOL: env.SYMBOL || 'BTCUSD',
    // Optional comma-separated list of symbols the on-screen switcher lets
    // the user flip between (e.g. "USDJPY,BTCUSD"). Leaving this unset
    // keeps the switcher hidden and SYMBOL above as the only symbol used.
    SYMBOL_CHOICES: env.SYMBOL_CHOICES || undefined,
    // Purely cosmetic: the character shown before every money amount on
    // the dashboard (equity, PnL, daily loss limit, price tags). Doesn't
    // convert or affect any actual number — just changes which symbol is
    // printed in front of it. Useful e.g. for a JPY-denominated account
    // where "$" is misleading.
    CURRENCY_SYMBOL: env.CURRENCY_SYMBOL || '$',
    POLL_MS: numOr(env.POLL_MS, 5000),
    WORKER_PROXY_URL: reqUrl.origin,
    AUTOTRADE: {
      ENABLED: env.AUTOTRADE_ENABLED === 'true',
      SYMBOL: env.AUTOTRADE_SYMBOL || 'USDJPY',
      TIMEFRAME: env.AUTOTRADE_TIMEFRAME || '4h',
      LOT_SIZE: numOr(env.AUTOTRADE_LOT_SIZE, 0.01),
      // Optional: if set (>0), lot size is computed per trade from this
      // account-currency risk amount and the signal's SL distance, instead
      // of always using the fixed LOT_SIZE above. See the caveat in
      // index.html's computeRiskBasedLotSize() comment (assumes account
      // currency == traded symbol's quote currency).
      RISK_PER_TRADE: numOr(env.AUTOTRADE_RISK_PER_TRADE, 0),
      LOOKBACK_BARS: numOr(env.AUTOTRADE_LOOKBACK_BARS, 20),
      MAX_OPEN_POSITIONS: numOr(env.AUTOTRADE_MAX_OPEN_POSITIONS, 1),
      MAX_DAILY_LOSS: numOr(env.AUTOTRADE_MAX_DAILY_LOSS, 50),
      PINBAR_WICK_MULT: numOr(env.AUTOTRADE_PINBAR_WICK_MULT, 1.5),
      PINBAR_WICK_RATIO: numOr(env.AUTOTRADE_PINBAR_WICK_RATIO, 0.5),
      // Pattern I (RSI scalping) entry threshold: RSI must be above this
      // (both timeframes) for LONG, or below (100 - this) for SHORT.
      // Default 50 matches the source material's plain "which side of 50"
      // check; raising it (e.g. 60) requires a stronger RSI reading before
      // entering, cutting down on low-conviction signals near the midline.
      RSI_THRESHOLD: numOr(env.AUTOTRADE_RSI_THRESHOLD, 50),
      POLL_MS: numOr(env.AUTOTRADE_POLL_MS, 30000),
      // Comma-separated list of pattern keys (e.g. "I" or "I,K") to pull
      // out of both live autotrade and the backtest-frequency check,
      // without any code change — e.g. to pause a pattern that's
      // empirically performing poorly in current market conditions.
      DISABLED_PATTERNS: env.AUTOTRADE_DISABLED_PATTERNS || undefined,
      // Optional per-pattern timeframe overrides (each falls back to
      // TIMEFRAME above if unset on this Worker). Undefined keys are
      // dropped by JSON.stringify, so leaving a variable unset here is
      // exactly equivalent to not setting it at all client-side.
      TIMEFRAME_A: env.AUTOTRADE_TIMEFRAME_A || undefined,
      TIMEFRAME_B: env.AUTOTRADE_TIMEFRAME_B || undefined,
      TIMEFRAME_C: env.AUTOTRADE_TIMEFRAME_C || undefined,
      TIMEFRAME_D: env.AUTOTRADE_TIMEFRAME_D || undefined,
      TIMEFRAME_F: env.AUTOTRADE_TIMEFRAME_F || undefined,
      TIMEFRAME_E: env.AUTOTRADE_TIMEFRAME_E || undefined,
      TIMEFRAME_G: env.AUTOTRADE_TIMEFRAME_G || undefined,
      TIMEFRAME_H: env.AUTOTRADE_TIMEFRAME_H || undefined,
      // Pattern I is the first multi-timeframe pattern, so it has two
      // independent timeframe overrides instead of one.
      TIMEFRAME_I_HIGH: env.AUTOTRADE_TIMEFRAME_I_HIGH || undefined,
      TIMEFRAME_I_LOW: env.AUTOTRADE_TIMEFRAME_I_LOW || undefined,
      TIMEFRAME_J: env.AUTOTRADE_TIMEFRAME_J || undefined,
      TIMEFRAME_K_HIGH: env.AUTOTRADE_TIMEFRAME_K_HIGH || undefined,
      TIMEFRAME_K_LOW: env.AUTOTRADE_TIMEFRAME_K_LOW || undefined,
      TIMEFRAME_L_HIGH: env.AUTOTRADE_TIMEFRAME_L_HIGH || undefined,
      TIMEFRAME_L_LOW: env.AUTOTRADE_TIMEFRAME_L_LOW || undefined,
    },
  };

  const configScript = `<script>window.CONFIG = ${JSON.stringify(config)};</script>`;
  const injected = html.replace('<script src="config.js"></script>', configScript);

  // Every response here has a freshly injected CONFIG (including secrets
  // and any newly-changed settings/features), so the browser must never
  // reuse a cached copy — without this, iOS Safari in particular can keep
  // serving a stale page for a long time after a Worker/index.html update.
  return new Response(injected, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const reqUrl = new URL(request.url);

    const keyError = checkAccessKey(reqUrl, env);
    if (keyError) return keyError;

    const target = reqUrl.searchParams.get('url');
    if (target) {
      return handleProxy(request, target, env);
    }
    return handleDashboard(reqUrl, env);
  },
};
