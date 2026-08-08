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

  // ---- 自動売買(EMAタッチ+ピンバー戦略) ----
  // 必ずデモ口座で動作確認してから使ってください。ENABLEDをtrueにしても、
  // 画面上の「自動売買」トグルを別途ONにしない限り発注は行われません
  // (二重の安全装置)。
  AUTOTRADE: {
    ENABLED: false,          // マスタースイッチ。falseなら画面上のトグルごと無効化される
    SYMBOL: 'USDJPY',        // 発注する銘柄名(ブローカーにより末尾にサフィックスが付く場合あり。例: USDJPY.)
    TIMEFRAME: '4h',         // EMA判定の時間足
    LOT_SIZE: 0.01,          // 1回あたりのロット数
    LOOKBACK_BARS: 20,       // 直近高値/安値を見るバー数(利確/損切りの基準)
    MAX_OPEN_POSITIONS: 1,   // 同時保有ポジション数の上限(これに達したら新規発注しない)
    MAX_DAILY_LOSS: 50,      // 本日の実現損益がこの金額(口座通貨)を下回ったら当日は新規発注を停止
    PINBAR_WICK_MULT: 1.5,   // ピンバー判定: ヒゲが実体の何倍以上か
    PINBAR_WICK_RATIO: 0.5,  // ピンバー判定: ヒゲがレンジ全体の何割以上か
    POLL_MS: 30000,          // 戦略判定(H4足取得)の間隔
  },
};
