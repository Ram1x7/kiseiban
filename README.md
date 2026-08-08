# Gravia Dashboard

動画と同じ見た目の「AI自動売買」風ライブダッシュボードです。トークン未設定なら自動でシミュレーションモードになり、設定すると本物のMT5口座データで動きます。**iPad/iPhoneだけで完結します**(PC不要)。

## ファイル

- `index.html` — ダッシュボード本体。これをブラウザで開くだけで動きます。GitHub Pagesにそのまま置いてもOK。
- `config.js` — MetaApiのトークン・口座IDを書く設定ファイル。**`.gitignore`で除外されておりコミットされません**。最初は存在しないので、`config.example.js`をコピーして作成してください。(下記「方法B」で使用)
- `config.example.js` — `config.js`のテンプレート(値は空欄でコミットされています)。
- `metaapi-proxy-worker.js` — MetaApiのREST APIはブラウザからの直接アクセス(CORS)に対応していないため、これをCloudflare Workersにデプロイして中継させる(下記「方法B」で使用)。
- `gravia-hosted-worker.js` — **iPad/iPhoneだけで完結する推奨方式**。ダッシュボード全体をCloudflare Worker一つでホストし、トークンはCloudflareの「Secret」にのみ保存する(下記「方法A」で使用)。

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

## 2. ダッシュボードを開く:2つの方法

どちらも安全にトークンを扱えますが、**iPad/iPhoneだけで作業している場合は方法Aを強く推奨**します(方法Bはローカルファイルをブラウザで開く必要があり、Working Copyアプリのプレビュー機能などiOS側の制限で正しく動かない場合があるため)。

### 方法A(推奨・iPad/iPhoneだけで完結): Graviaを丸ごとCloudflare Workerでホストする

`gravia-hosted-worker.js` を使い、ダッシュボード自体を`https://xxxx.workers.dev`という普通のURLとしてホストします。トークンはブラウザ側のコードには一切含まれず、Cloudflareの「Secret」にのみ保存されます。実際の認証もWorkerがサーバー側で行うため、ブラウザのJavaScriptは実トークンを一度も見ることがありません。

1. https://dash.cloudflare.com/ → 「Workers & Pages」→「Create」→**「Hello World」等の空のテンプレートから作成**(「Import a repository」は選ばないこと)
2. エディタの中身を、このリポジトリの `gravia-hosted-worker.js` の内容で丸ごと置き換えて「Deploy」
3. デプロイしたWorkerの「Settings」→「Variables and Secrets」を開き、以下を追加します

   **必ずSecret(暗号化)として追加するもの:**

   | 名前 | 値 |
   |---|---|
   | `METAAPI_TOKEN` | MetaApiのAPIトークン(上記「1.」で取得したもの) |
   | `METAAPI_ACCOUNT_ID` | MetaApiのAccount ID(上記「1.」で取得したもの) |
   | `ACCESS_KEY` | **自分で決める合言葉(誰にも推測されない適当な英数字の文字列)**。このWorkerはURLさえ知っていれば誰でも開けてしまうため、この鍵でアクセスを制限します。未設定の場合はダッシュボードが一切開けなくなります(安全側の既定動作) |

   **必要に応じて追加する(通常のVariableでOK。未設定でも既定値で動きます):**

   | 名前 | 既定値 | 説明 |
   |---|---|---|
   | `METAAPI_REGION` | `new-york` | 口座を追加した地域(例: `london`) |
   | `SYMBOL` | `BTCUSD` | ローソク足に表示する銘柄 |
   | `POLL_MS` | `5000` | 何msごとにMT5へ問い合わせるか |
   | `AUTOTRADE_ENABLED` | `false` | `true`にすると自動売買のマスタースイッチがONになる(下記「3.」参照) |
   | `AUTOTRADE_SYMBOL` | `USDJPY` | 自動売買の対象銘柄 |
   | `AUTOTRADE_TIMEFRAME` | `4h` | 自動売買の判定時間足 |
   | `AUTOTRADE_LOT_SIZE` | `0.01` | 1回あたりのロット数 |
   | `AUTOTRADE_LOOKBACK_BARS` | `20` | 利確/損切りの基準にする直近バー数 |
   | `AUTOTRADE_MAX_OPEN_POSITIONS` | `1` | 同時保有ポジション数の上限 |
   | `AUTOTRADE_MAX_DAILY_LOSS` | `50` | 本日の実現損益がこれを下回ったら新規発注を停止 |
   | `AUTOTRADE_PINBAR_WICK_MULT` | `1.5` | ピンバー判定の閾値 |
   | `AUTOTRADE_PINBAR_WICK_RATIO` | `0.5` | ピンバー判定の閾値 |
   | `AUTOTRADE_POLL_MS` | `30000` | 戦略判定の間隔 |
   | `AUTOTRADE_TIMEFRAME_A`〜`_F` | (未設定) | パターンごとに時間足を個別指定したい場合のみ設定(A/B/Cは未設定なら`AUTOTRADE_TIMEFRAME`、D/Fは未設定なら`4h`)。パターンの詳細は下記「3.」参照 |

4. 保存後、`https://xxxx.workers.dev/?key=<ACCESS_KEYに設定した値>` をSafariで開きます。これがあなたの本番ダッシュボードURLです。**このURL(鍵付き)をSafariのブックマーク/ホーム画面に追加**しておくと便利です
5. `key`が一致しない、または`ACCESS_KEY`/`METAAPI_TOKEN`/`METAAPI_ACCOUNT_ID`のいずれかが未設定の場合は、安全のためすべてのリクエストが拒否されます(エラーメッセージに何が未設定かが表示されます)

このWorkerは内部で `metaapi-proxy-worker.js` と同様のCORS中継も兼ねているため、**この方法を使う場合は`metaapi-proxy-worker.js`を別途デプロイする必要はありません**。設定を変更したい場合(銘柄・時間足など)は、上記のVariablesを編集して再度「Deploy」するだけです。`config.js`はこの方法では使いません。

⚠️ `ACCESS_KEY`はパスワードと同じです。他人に教えず、URLも安易に共有しないでください。

### 方法B: 自分の端末のconfig.jsを使う(PC推奨。iPadでも可能だが制限あり)

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

### 2.5. MetaApi中継Workerをデプロイする(CORS対策・必須。方法Bのみ)

MetaApiの取引用REST APIはブラウザからの直接アクセス(CORS)に対応していないため、上記の設定だけではデータ取得・発注に失敗します(実行ログに `network error calling ...` のようなエラーが出ます)。`metaapi-proxy-worker.js` をCloudflare Workersにデプロイして中継させてください。

1. https://dash.cloudflare.com/ → 「Workers & Pages」→「Create」→**「Hello World」等の空のテンプレートから作成**(「Import a repository」は選ばないこと)
2. エディタの中身を `metaapi-proxy-worker.js` の内容で丸ごと置き換えて「Deploy」
3. 発行されたURL(`https://xxxx.workers.dev`)を `config.js` の `WORKER_PROXY_URL` に設定(末尾のスラッシュは不要)

このWorkerはMetaApi(`*.agiliumtrade.ai`)以外への転送を拒否するようになっており、認証トークン自体を保存・記録することもありません。あくまでCORSを回避するためだけの中継です。

## 3. 自動売買(参考実装・任意)

条件が揃うと自動で成行発注する機能です。**利益を保証するものではありません**。有効化する前に必ず以下を理解してください。

複数の独立したパターンを同時に判定し、いずれかが成立すると発注します(同じティックで複数成立した場合はそれぞれ順に処理します):

- **パターンA/B(EMAタッチ+ピンバー)**: EMA10(A)またはEMA20(B)のクロスでトレンド方向が確定 → 押し戻ってEMAにタッチ → そのローソク足がピンバー形状、で成立(LONG/SHORT両方向)
- **パターンC(ICT手法)**: 直近の高値/安値を一瞬突き抜けてから反転する「流動性の掃除(Liquidity Sweep)」 → その直後にできる価格の不均衡「Fair Value Gap(FVG)」 → 直前の反対方向の足「Order Block」、この3つが重なる帯(Unicorn Model)へ価格が押し戻り、確認足が出た時点で成立(LONG/SHORT両方向)
- **パターンD(押し目買い、EMA50・LONGのみ)**: EMA50が上向き(上昇トレンド) → 数本の押し戻り(下落) → 直前の高値を上抜けて終値をつける「再進行」の足が出たら成立
- **パターンF(戻り売り、EMA200・SHORTのみ)**: EMA200が下向き(下降トレンド) → 数本の戻り(上昇) → 直前の安値を下抜けて終値をつける「再進行」の足が出たら成立。パターンDと同じ仕組みの売り専用版
- **パターンE(ダウ理論×水平線ブレイク)**: 直近のスイング高値/安値(前後6本より高い/低いローソク足)を「確定した節目」とし、直近2つの高値と安値がどちらも切り上がっていれば上昇トレンド(切り下がっていれば下降トレンド)と判定 → 直近の節目(高値/安値)を実体の終値で上抜け/下抜けしたら成立(LONG/SHORT両方向)

パターンごとに時間足を個別に設定できます(未設定ならA/B/Cは共通の`TIMEFRAME`、D/Fは`4h`が既定値になります)。方法A(Worker)なら`AUTOTRADE_TIMEFRAME_A`〜`AUTOTRADE_TIMEFRAME_F`、方法B(config.js)なら`AUTOTRADE.TIMEFRAME_A`〜`TIMEFRAME_F`で上書きしてください(`config.example.js`にコメントアウトで記載)。

- **必ずデモ口座で動作確認してから使ってください。** 本番口座でいきなり有効化することはおすすめしません
- 発注には2つの独立したスイッチが両方ONである必要があります: (1) マスタースイッチ(方法A: Workerの`AUTOTRADE_ENABLED`変数 / 方法B: `config.js`の`AUTOTRADE.ENABLED`)、(2) 画面上の「自動売買」トグル。**トグルは安全のため、ページを開き直すたびに毎回OFFにリセットされます**
- 対象銘柄・ロット数・同時保有上限(全パターン合計)・日次最大損失額などを調整できます(方法A: Workerの`AUTOTRADE_*`変数 / 方法B: `config.js`の`AUTOTRADE`セクション。`config.example.js`にデフォルト値付きで記載)
- 同時保有ポジション数の上限と、本日の実現損益が設定額を下回った場合の新規発注停止(サーキットブレーカー)を実装していますが、これらはあくまで参考実装であり、あらゆる相場状況・ブローカーの挙動を考慮したものではありません
- **トレンドフォロー系のパターン(A/B/D/F)と、後述の逆張り系パターンを両方有効にすると、同時期に正反対の方向へシグナルが出ることがあります。** どのパターンを使うか吟味した上で有効化してください(現状、パターン単位でのON/OFFはできず、全パターンが常に判定対象です)
- 実行ログ(画面下部)に、シグナル検出・発注成功/失敗がすべて記録されます
- 自動売買パネルの「過去のシグナル頻度を確認」ボタンで、直近の過去データに対して全パターンを機械的に走らせ、シグナルが何回出たか(パターン別・1日あたりの目安を含む)を確認できます。あくまで過去の出現回数の集計であり、将来の頻度や利益を保証するものではありません(損益シミュレーションではありません)

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
- (方法A) `{"error":"invalid or missing key"}` と出る場合はURLの `?key=...` が`ACCESS_KEY`の値と一致していません。`{"error":"ACCESS_KEY secret not configured..."}` の場合はCloudflare側でSecretを設定し忘れています
- (方法A) ダッシュボードの中身が古い場合、`gravia-hosted-worker.js`は`index.html`をGitHub Pagesから30秒キャッシュして取得しています。少し待つか再読み込みしてください
