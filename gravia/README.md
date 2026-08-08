# Gravia Dashboard

動画と同じ見た目の「AI自動売買」風ライブダッシュボードです。トークン未設定なら自動でシミュレーションモードになり、設定すると本物のMT5口座データで動きます。**iPad/iPhoneだけで完結します**(PC不要)。

## ファイル

- `index.html` — ダッシュボード本体。これをブラウザで開くだけで動きます。GitHub Pagesにそのまま置いてもOK。

## 1. MetaApi.cloud に登録する(ブラウザだけでOK)

1. https://app.metaapi.cloud にアクセスしてアカウント作成
2. https://app.metaapi.cloud/token を開き、**API token** をコピー
3. https://app.metaapi.cloud/accounts で「Add account」→ MT5のログインID・パスワード・サーバー名(ブローカーから発行されているもの)を入力して接続
4. 接続が完了すると **Account ID**(例: `865d3a4d-3803-486d-bdf3-a85679d9fad2`)が表示されるのでコピー

## 2. index.html に設定を入れる

`index.html` を開き、`<script>`内の上の方にある `CONFIG` を書き換えます。

```js
const CONFIG = {
  METAAPI_TOKEN: 'ここにAPIトークンを貼る',
  METAAPI_ACCOUNT_ID: 'ここにAccount IDを貼る',
  METAAPI_REGION: 'new-york',   // 通常はそのままでOK
  SYMBOL: 'BTCUSD',             // ブローカー側の銘柄名に合わせて変更(候補が違う場合はローソク足だけ表示されません)
  POLL_MS: 5000,                // 何msごとにMT5へ問い合わせるか
};
```

保存してブラウザをリロードすれば、口座残高・約定履歴・ポジションが本物のデータで表示されます。iPadのテキストエディタアプリ(Textastic、Working Copy など)やSafari上のGitHub編集画面から直接書き換えられます。

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
