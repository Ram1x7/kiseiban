# Gravia Dashboard

動画と同じ見た目の「AI自動売買」風ライブダッシュボードです。トークン未設定なら自動でシミュレーションモードになり、設定すると本物のMT5口座データで動きます。**iPad/iPhoneだけで完結します**(PC不要)。

## ファイル

- `index.html` — ダッシュボード本体。これをブラウザで開くだけで動きます。GitHub Pagesにそのまま置いてもOK。
- `config.js` — MetaApiのトークン・口座IDを書く設定ファイル。**`.gitignore`で除外されておりコミットされません**。最初は存在しないので、`config.example.js`をコピーして作成してください。
- `config.example.js` — `config.js`のテンプレート(値は空欄でコミットされています)。
- `metaapi-proxy-worker.js` — MetaApiのREST APIはブラウザからの直接アクセス(CORS)に対応していないため、これをCloudflare Workersにデプロイして中継させる(下記「2.5」参照)。

## ⚠️ このリポジトリはpublicです(重要)

このリポジトリはGitHub上でpublic(誰でも閲覧可能)に設定されています。MetaApiのAPIトークンは口座に接続できてしまう認証情報なので、**`index.html`や他のコミットされるファイルに直接書き込んで`git push`しないでください**。誰でもコードを見てトークンを盗める状態になります。

そのため設定は`config.js`という別ファイルに分離し、`.gitignore`でGitの管理対象から外しています。この結果として:

- **GitHub Pages上のダッシュボードは、`config.js`が存在しないため常にシミュレーションモードで動作します**(これは意図した安全な挙動です)
- 本物のMT5データを見るには、後述の通り**自分のローカル環境(またはトークンが外部に漏れない自分専用のホスティング先)で`config.js`を用意して開く**必要があります

## 1. MetaApi.cloud に登録する(ブラウザだけでOK)

1. https://app.metaapi.cloud にアクセスしてアカウント作成
2. https://app.metaapi.cloud/token を開き、**API token** をコピー
3. https://app.metaapi.cloud/accounts で「Add account」→ MT5のログインID・パスワード・サーバー名(ブローカーから発行されているもの)を入力して接続
4. 接続が完了すると **Account ID**(例: `865d3a4d-3803-486d-bdf3-a85679d9fad2`)が表示されるのでコピー

## 2. config.js に設定を入れる(ローカルのみ・Gitにはコミットしない)

`config.example.js` をコピーして `config.js` を作成し、中身を書き換えます。

```
cp config.example.js config.js
```

```js
const CONFIG = {
  METAAPI_TOKEN: 'ここにAPIトークンを貼る',
  METAAPI_ACCOUNT_ID: 'ここにAccount IDを貼る',
  METAAPI_REGION: 'new-york',   // 通常はそのままでOK
  SYMBOL: 'BTCUSD',             // ブローカー側の銘柄名に合わせて変更(候補が違う場合はローソク足だけ表示されません)
  POLL_MS: 5000,                // 何msごとにMT5へ問い合わせるか
};
```

保存してブラウザで`index.html`をリロードすれば、口座残高・約定履歴・ポジションが本物のデータで表示されます。`config.js`は`.gitignore`で除外されているため、**このファイルは`git push`されず、GitHub Pages上には反映されません**(意図した動作です)。iPadでローカルに試したい場合は、Textastic・Working Copyなどのアプリでリポジトリをクローンし、アプリ内で`config.js`を作成・編集してください(GitHub上のWeb編集画面で直接書き換えて`git push`することは、トークンが公開されてしまうため絶対に行わないでください)。

## 2.5. MetaApi中継Workerをデプロイする(CORS対策・必須)

MetaApiの取引用REST APIはブラウザからの直接アクセス(CORS)に対応していないため、上記の設定だけではデータ取得・発注に失敗します(実行ログに `network error calling ...` のようなエラーが出ます)。`metaapi-proxy-worker.js` をCloudflare Workersにデプロイして中継させてください。

1. https://dash.cloudflare.com/ → 「Workers & Pages」→「Create」→**「Hello World」等の空のテンプレートから作成**(「Import a repository」は選ばないこと)
2. エディタの中身を `metaapi-proxy-worker.js` の内容で丸ごと置き換えて「Deploy」
3. 発行されたURL(`https://xxxx.workers.dev`)を `config.js` の `WORKER_PROXY_URL` に設定(末尾のスラッシュは不要)

このWorkerはMetaApi(`*.agiliumtrade.ai`)以外への転送を拒否するようになっており、認証トークン自体を保存・記録することもありません。あくまでCORSを回避するためだけの中継です。

## 3. 自動売買(参考実装・任意)

USD/JPYのH4足で「EMAタッチ+ピンバー」を検出し、条件が揃うと自動で成行発注する機能です。**利益を保証するものではありません**。有効化する前に必ず以下を理解してください。

- **必ずデモ口座で動作確認してから使ってください。** 本番口座でいきなり有効化することはおすすめしません
- 発注には2つの独立したスイッチが両方ONである必要があります: (1) `config.js`の`AUTOTRADE.ENABLED`、(2) 画面上の「自動売買」トグル。**トグルは安全のため、ページを開き直すたびに毎回OFFにリセットされます**
- `config.js`の`AUTOTRADE`セクションで、対象銘柄・時間足・ロット数・同時保有上限・日次最大損失額などを調整できます(`config.example.js`にデフォルト値付きで記載)
- 同時保有ポジション数の上限と、本日の実現損益が設定額を下回った場合の新規発注停止(サーキットブレーカー)を実装していますが、これらはあくまで参考実装であり、あらゆる相場状況・ブローカーの挙動を考慮したものではありません
- 実行ログ(画面下部)に、シグナル検出・発注成功/失敗がすべて記録されます

## 各パネルとデータの対応

| パネル | データソース |
|---|---|
| エクイティカード | account-information の equity |
| ローソク足チャート | historical-market-data(symbol/timeframeで取得。取れない場合は非表示) |
| ライブストリーク | 直近24時間の約定履歴から連勝数を計算 |
| 資産曲線 | ポーリングごとの equity を蓄積 |
| 直近約定テーブル/実行ログ | history-deals(新規に増えた約定のみ追加) |
| 出来高バー | 約定のvolume(BUY/SELL別) |
| MicroFish散布図 | **装飾表示のまま**(MT5には該当データがないため) |

## 無料枠と料金について

MetaApiは無料枠がありますが、常時ライブでポーリングし続ける用途では有料プランが必要になる可能性があります。最新の料金は https://metaapi.cloud/#pricing で確認してください。

## うまく表示されない場合

- ブラウザのコンソール、または画面下部の実行ログに赤字でエラーが出ます
- `METAAPI_ACCOUNT_ID` の口座がMetaApi側で「deployed」状態になっているか確認してください(初回接続直後は数分かかることがあります)
- `SYMBOL` がブローカーの銘柄名と一致しているか確認してください(例: `BTCUSD` ではなく `BTCUSD.` など末尾にサフィックスが付くブローカーもあります)
