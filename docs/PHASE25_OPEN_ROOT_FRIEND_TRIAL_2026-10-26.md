# Phase25｜既存Firebaseのルール変更なしで友達と試遊するHTML

作業日：2026-10-26。対象：`dev/quality-and-ui-v1-5-20261024`。**本番Firebase・Google Sitesの公開ページ・`main`は一切変更しない**。

## 目的と本人の決定

本人は「現在のFirebaseルールは11月8日まで有効なので、今は変えずにまず友達と遊びたい」と明示した。従来はトランプ3ゲームがFirebase Anonymous Auth＋本人別手札Rulesを要求するため、既存公開DBに接続できず開発を止めていた。しかし既存の学校ゲーム（LEMON CLASH `src/firebase-config.js`）は**同じRTDBのURLだけで動き、Firebase Authを必須にしていない**。友達対戦の優先順位を尊重し、**認証付き通常モードを維持したまま、公開DBを使う試遊モードを別に実装**した。

## 追加したファイル・変更点

- **実物HTML：`dist/trump-collection-open-root-trial.html`**。4ゲーム×COM/友達対戦、チャット、退出を含む、Google Sitesの「コードを埋め込む」に**HTMLソース全文を直接貼る用**の約203KB単体ファイル。Firebaseには前に本人が示した共有RTDB URLだけ設定。Firebase Web APIキー、アカウント、Auth利用を必要としない。既存Google Sites版・GitHub Pages本番は未変更。
- **`online/firebase-room-store.mjs`**に`createFirebaseOpenRootTrialIdentity`を追加。各ブラウザが16バイトの暗号学的乱数から`tc`で始まる一時UIDを生成する。ログインやlocalStorage/sessionStorageを使わず、ページ更新時には別UIDになる。 `token()`が`null`の場合、RTDB RESTの`auth`クエリーは送信しない。通常のFirebase匿名認証は保持。
- **`online/four-seat-remote.html`**は`window.TRUMP_FIREBASE_OPEN_ROOT_TRIAL === true`かつ既知の`mygame-df915`とDBホスト一致時だけ一時UIDを有効化。それ以外は従来の匿名Authへ進む。試遊UIでは**公開DBで手札・チャットが外部から読めること**を警告する。
- **`online/collection-launcher.template.html`**でGoogle Sitesの二重`iframe/srcdoc`を跨ぐフラグと公開DB接続先の受け渡しを追加。`dist/trump-collection-online-lab.html`と`dist/trump-collection-integrated-lab.html`もビルド元と一致するよう再生成（**後者は未設定の安全な開発用HTMLのまま**）。
- **`dev/build-configured-sites.mjs`**に`buildOpenRootTrialSitesHtml`とCLI `--open-root-trial --acknowledge-public-db --out dist/local-configured-trump-trial.html` を追加。公開DBの危険を明示承認した場合のみ、確認済みRTDBのためのローカル試遊HTMLを生成。これまでの厳格なprivate Rules向けパッケージ生成は変更なし。
- 新規 `tests/open-root-trial.test.mjs`に生成・UID・認証なし通信・GitHub保存済みHTML完全一致の回帰検査。
- 新規 `firebase.open-trial-emulator.json` で、本人報告の期限制Rootルールを**ローカルエミュレーターにのみ読み込み**、`TC_OPEN_ROOT_TRIAL=1 node dev/verify-configured-sites-emulator.mjs`をChromium/WebKitで動作検査。既存の認証付きエミュレーター試験と**両方式をCIで検証**。

## セキュリティ・運用上の明確な制限

- **現在のFirebase Root Rulesは全世界の人が直接RTDBを読み書き可能**。「ルームの人しか手札を見られない」「チャットはルーム参加者だけ」は**この試遊モードでは保証しない**。5桁ルーム番号は秘密の認証情報ではない。ホスト・参加者の識別IDも真のアカウント認証ではない。
- ゲーム画面では他人の手札を伏せて表示するが、他のゲームも含むRTDB内部データは公開Ruleで読み書き可能。**個人情報・本名・パスワード・連絡先などはチャットに送らない**。
- 試遊HTMLは学校で身内だけに使うが、**技術的なアクセス制限はない**。試遊後にルールを絞るなら、既存ゲームの使用ルートを保全した上で別の正式対応を判断する。
- 以前の本人確認が正しければ、今のRoot Rulesは**2026-11-08 00:00 JST**で期限切れ。**期限までに既存ゲームも含めルール延長が必要**。今回の実装では期限を延ばしていない。
- ファイルには公開Firebase DB URL（すでにLEMON CLASHのコードで使用）を含むが、**秘密鍵や管理者トークンは含めていない**。自動GitHub Sites/Google Sites公開・Firebase本番接続は実行していない。

## 具体的な利用時の流れ

実際の学校用Google Sitesへ試遊HTMLソース全文を貼り付けるのは本人の操作。ホストがババ抜き・七並べ・大富豪を選び「友達と遊ぶ」→5桁ルーム番号を作成、ほかの3人が入力して参加し、全員準備→ホスト開始。神経衰弱は従来のSupabase Broadcast（2人）で独立。チャットボタンでテキスト会話。

**試遊で本番Firebaseへ初めて通信するのは本人がそのHTMLを開いてボタン操作した時であり、こちらから本番DBへの試し書きは行っていない**。学校iPad/Safariでの実機対戦はこれから確認。
