# V2｜学校試遊直前のルーム作成・参加UI改善（2026-10-28）

## 本人指示
- 学校iPad/Safari、Google Sitesに単体HTML直接貼り付け、友達だけで遊ぶ。4ゲーム共通ルーム、4席不足分CPU補充、神経衰弱2席（不足CPU1人）。
- 匿名認証は不要、ホストがリロードした後の対戦復帰も不要。mainや学校公開Google Sites、本番Firebase Rules/DBを無断変更しない。

## 今回修正
- `v2/online-app.mjs`：学校RTDB URLを組み込んだHTMLで、誤解を招く『オンライン未設定・開発用』という通知を出さず、5桁の部屋番号作成/参加を案内。
- 作成ボタン連打による二重要求をページ内ロックで防止。
- 5桁部屋番号が既存の部屋と重なり、Firebase ETag CASの予約が412を返した場合、**別の乱数5桁で最大6回だけ試す**。既存の他人の部屋を上書き・参加しない。
- 入室開始時に失敗した場合、roomCode、coordinator、clientなどの半端な状態を消し、操作をやり直せる状態に戻す。試合中のリロード復帰ではない。
- 満室、数字5桁以外、存在しない部屋、アクセス拒否など、学校iPadの画面で判別できる日本語エラーを追加。
- `dev/verify-v2-memory-cpu-ui.mjs`にローカルで**最初の部屋予約だけ意図的に412を返す**再現を追加。衝突後、新しい部屋を作り直し、神経衰弱1人+CPU1人の試合を実タップで最後まで進行させて、同じルームへ復帰する。
- `dev/verify-v2-online-ui.mjs`に「存在しない00000部屋への参加失敗→同じ画面で正しい部屋に再参加」の4画面実ブラウザ試験を追加。800×450・667×375のロビーの画面証拠・ボタン幅と縦スクロールチェックを追加。

## 視覚レビューで追加発見したロビーの問題と修正
- Google Sites風WebKit 667×375の実スクリーンショットを直接確認した結果、旧ロビーでは4ゲーム選択が縦一列のため、最下部の『ルームを退出』ボタンが画面下に一部はみ出していた。従来のテストはスクロールできるかだけを見ていたため検出できなかった。
- `v2/online-app.mjs`でゲーム選択を `.v2-game-picker` にまとめ、`v2/ui/online-shell.css`で2列×2行に配置。ボタンのクリック動作・IDは維持。
- `dev/verify-v2-online-ui.mjs`で667×375と800×450のロビーの『退出』ボタンがスクロールせず全体表示されること、4ゲームボタンが揃うことを検証するゲートを追加。スクリーンショットは `online-lobby-*.png` としてGitHub CI Artifactに保存。
- この表示変更の最新版UI CIは[Actionsワークフロー](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-ui-emulator.yml)で確認すること。学校iPad本体の視認性については現地の実測が必要。
## 実証
- **[Actions #40596710093 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40596710093)**：Chromiumで予約競合の412を人工的に起こして自動的に部屋番号を変更、そのまま神経衰弱1人+CPU1人を最後まで完走。WebKit（Safari相当）でも神経衰弱1人＋CPUの試合を完走。Firebase Auth 0。
- [最新版 Room-first UI E2E](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-ui-emulator.yml)：存在しない部屋番号を入力してから正常参加する試験と、ロビー画面の写真を含む。実行が成功したか最新runで確認すること。
- [Foundation V2 #40596947661 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40596947661)：修正後の既存ルール/通信回帰テスト。
- 実学校Firebaseへの読取専用確認 [#40551481506 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40551481506)：匿名AuthなしRTDB GET=200、ETag取得、OPTIONSによるCORS確認。本番書き込みはゼロ。実際にルーム作成（PUT）が認可されるかはまだ本番で未確認。

## 最終確認：ロビー改善後の実画面・4ゲーム完走
- **[UI Safari/Chromium #40597869423 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40597869423)**：新しい2×2ロビー配置の667×375／800×450スクリーンショットを撮影し、**退出ボタンが画面下に隠れない**ことを機械検証。4人ルームへの誤番号→正しい番号での再参加、4ゲーム連続の実タップ試合完走、神経衰弱の2人選択／残り2人待機、匿名Auth 0をChromium/WebKit両方で合格。
- **[Memory CPU #40596947657 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40596947657)**：1人＋CPU1人の神経衰弱を両ブラウザエンジンで完走。
- **[Foundation V2 #40596947661 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40596947661)**：ルール・通信の基礎回帰テスト成功。
- 学校試遊用オフラインHTMLは上記UI Actions Artifact `v2-room-first-sites-school-trial.html`、内容約75KB、同一生成物SHA256 `d6dfb3415163aac5add1d1adafc3cb1a5fa2fb0ad9721940566c45388c0f715e`。これは本番FirebaseルールへのPUTを検証した証拠ではない。
## 本番変更なし
- **main／本番Firebase RTDB Rules／本番DB／Google Sites公開版／Google Driveを変更していない**。
- エミュレーターの校内ブラウザ再現が成功しても、実学校のiPadとFirebase本番のPUTが成功するかは本人の実機試遊まで保証できない。
- 学校用HTMLの最新版は上記ワークフローの成功Artifactから取り出す。旧版は機能修正前なので配布しない。
