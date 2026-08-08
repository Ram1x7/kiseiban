// config.example.js — config.js のテンプレートです。
// このファイルをコピーして config.js を作成し、値を入力してください。
//   cp config.example.js config.js
//
// config.js は .gitignore で除外されているためGitにはコミットされません。
// つまりGitHub Pages上には決して配信されず、本物のMT5データはこのファイルを
// 自分で用意したローカル環境(または自分だけがアクセスできるホスティング先)で
// 開いたときにのみ有効になります。GitHub Pages上は常にシミュレーションモード
// のままになります(トークンを公開リポジトリに置かないための仕様です)。
//
// トークン/口座IDの取得方法は README.md を参照してください。
const CONFIG = {
  METAAPI_TOKEN: '(既存のトークンのまま)',
  METAAPI_ACCOUNT_ID: 'cc7db6c5-bdf2-418c-b5d1-6e1af1c4fbc6',
  METAAPI_REGION: 'london',   // ← new-york から london に変更
  SYMBOL: 'BTCUSD',           // 表示用。ブローカーの実際の銘柄名に合わせて調整
  POLL_MS: 5000,

  AUTOTRADE: {
    ENABLED: true,            // まずは false のままログだけ確認するのもおすすめです
    SYMBOL: 'BTCUSD',         // ← こちらもブローカーの実際の銘柄名に合わせる
    TIMEFRAME: '4h',
    LOT_SIZE: 0.01,
    LOOKBACK_BARS: 20,
    MAX_OPEN_POSITIONS: 1,
    MAX_DAILY_LOSS: 50,
    PINBAR_WICK_MULT: 1.5,
    PINBAR_WICK_RATIO: 0.5,
    POLL_MS: 30000,
  },
};
