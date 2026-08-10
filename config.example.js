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
  METAAPI_TOKEN: '',        // 例: 'eyJhbGciOiJSUzI1NiIs...'
  METAAPI_ACCOUNT_ID: '',   // 例: '865d3a4d-3803-486d-bdf3-a85679d9fad2'
  METAAPI_REGION: 'new-york', // 口座を追加した地域(通常は new-york のままでOK)
  SYMBOL: 'BTCUSD',         // ローソク足に表示したいシンボル(ブローカーの銘柄名に合わせて変更)
  POLL_MS: 5000,            // 何msごとにMT5へ問い合わせるか(短すぎるとAPI制限に注意)

  // 画面上の金額(資産・損益・日次損失上限など)の先頭に付ける通貨記号。
  // 表示だけの設定で、数値の換算などは一切行わない(口座がJPY建てで
  // "$"表記が紛らわしい場合などに変更する)。
  // CURRENCY_SYMBOL: '¥',

  // 画面上に銘柄切り替えボタンを表示したい場合のみ設定する(カンマ区切り、
  // または配列)。ボタンを押すとSYMBOL・AUTOTRADE.SYMBOLの両方が切り替わる。
  // 未設定、または1つしか無い場合はボタンは表示されない。
  // SYMBOL_CHOICES: 'USDJPY,BTCUSD',

  // MetaApiの取引用REST APIはブラウザからの直接アクセス(CORS)に対応していないため、
  // metaapi-proxy-worker.js をCloudflare Workersにデプロイし、発行されたURLをここに
  // 設定する(末尾のスラッシュは不要)。未設定の場合は直接アクセスを試みるが、
  // 動作しない可能性が高い。
  WORKER_PROXY_URL: '',     // 例: 'https://gravia-proxy.xxxx.workers.dev'

  // ---- 自動売買(複数パターンを並行判定) ----
  // 必ずデモ口座で動作確認してから使ってください。ENABLEDをtrueにしても、
  // 画面上の「自動売買」トグルを別途ONにしない限り発注は行われません
  // (二重の安全装置)。パターンの詳細はREADME.mdを参照してください。
  AUTOTRADE: {
    ENABLED: false,          // マスタースイッチ。falseなら画面上のトグルごと無効化される
    SYMBOL: 'USDJPY',        // 発注する銘柄名(ブローカーにより末尾にサフィックスが付く場合あり。例: USDJPY.)
    TIMEFRAME: '4h',         // パターンA/B/C共通の時間足(個別に上書きしない限りこれが使われる)
    LOT_SIZE: 0.01,          // 1回あたりのロット数(RISK_PER_TRADEを設定しない場合、常にこの値を使う)
    // 設定すると、ロット数を毎回固定せず「1トレードで損切りになった場合の
    // 損失額」がおおよそこの金額(口座通貨)になるよう、SLまでの値幅に応じて
    // 自動計算する。パターンごとに時間足がバラバラ(1分〜4時間)なため、
    // LOOKBACK_BARSベースのSL幅はパターンによって大きく異なり、固定ロットだと
    // 実質的なリスクがパターンごとにばらつく問題を緩和する。
    // 注意: 口座通貨と発注銘柄の決済通貨が一致している場合のみ正しく計算される
    // (例: 円建て口座でUSDJPYを取引する場合)。一致しない場合は計算が狂うため、
    // 未設定のままLOT_SIZEを使うことを推奨。
    // RISK_PER_TRADE: 500,
    LOOKBACK_BARS: 20,       // 直近高値/安値を見るバー数(利確/損切りの基準。パターン共通)
    MAX_OPEN_POSITIONS: 1,   // 同時保有ポジション数の上限(全パターン合計。これに達したら新規発注しない)
    MAX_DAILY_LOSS: 50,      // 本日の実現損益がこの金額(口座通貨)を下回ったら当日は新規発注を停止
    PINBAR_WICK_MULT: 1.5,   // ピンバー判定(パターンA/B): ヒゲが実体の何倍以上か
    PINBAR_WICK_RATIO: 0.5,  // ピンバー判定(パターンA/B): ヒゲがレンジ全体の何割以上か
    RSI_THRESHOLD: 50,       // パターンI(RSIスキャルピング): 上位足・下位足ともにRSIがこの値超でLONG、(100-この値)未満でSHORT。
                             // 既定の50は「50を基準にどちら側か」だけの判定。60などに上げるとより強いRSIの偏りが必要になり、シグナルが厳しくなる
    POLL_MS: 30000,          // 戦略判定(ローソク足取得)の間隔

    // 特定のパターンを一時的に無効化したい場合のみ設定する(カンマ区切り、
    // または配列)。例えばレンジ相場で成績が悪化しているパターンだけを
    // 一時停止したい場合など。無効化されたパターンは自動売買・過去の
    // シグナル頻度確認の両方から除外される。未設定なら全パターン有効。
    // DISABLED_PATTERNS: 'I',

    // 各パターンの時間足を個別に上書きしたい場合のみ設定する(未設定なら
    // 上記TIMEFRAMEが使われる。パターンD/Fは未設定時のデフォルトが'4h')。
    // TIMEFRAME_A: '15m',
    // TIMEFRAME_B: '15m',
    // TIMEFRAME_C: '1h',
    // TIMEFRAME_D: '4h',
    // TIMEFRAME_F: '4h',
    // TIMEFRAME_E: '4h',
    // TIMEFRAME_G: '15m',
    // TIMEFRAME_H: '4h',
    // パターンI/K/Lのみ、上位足・下位足の2つを個別に持つ(未設定時のデフォルトは以下の通り)。
    // TIMEFRAME_I_HIGH: '15m',
    // TIMEFRAME_I_LOW: '1m',
    // TIMEFRAME_J: '15m',
    // TIMEFRAME_K_HIGH: '15m',
    // TIMEFRAME_K_LOW: '1m',
    // TIMEFRAME_L_HIGH: '1h',
    // TIMEFRAME_L_LOW: '15m',
    // TIMEFRAME_M: '15m',
  },
};
