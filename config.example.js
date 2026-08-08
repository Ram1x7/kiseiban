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
};
