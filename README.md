# トランプコレクション 🃏

> 開発を引き継ぐ場合は **[HANDOFF.md](HANDOFF.md)** を最初に読んでください（仕様・制約・検証手順の正本）。開発ブランチの版は v1.5.5（main の公開版は v1.4.0）。

学校の iPad でも遊べる、定番トランプゲームを集めるブラウザゲーム集です。
**将来的には友達とルーム番号でオンライン対戦することが本命**。既存4ゲームは第一弾で、定番カードゲームとローカルルールを継続追加します。
v1.5.5の通常本体はCOM対戦のみ。別ページの神経衰弱2人オンライン版は**本人がPCとスマホの別端末で試遊成功**。ババ抜き・七並べ・大富豪は**共通4席のローカル検証版（遠隔Firebase未接続）**まで実装済み。

## 遊ぶ

- GitHub Pages通常版（v1.4.0）: https://8mahi8.github.io/trump-collection/
- **v1.5.5 試遊ページ（通常版は変更なし）**: https://8mahi8.github.io/trump-collection/preview-v1.5.5.html
- **神経衰弱・2人用の別端末オンライン試作**: https://8mahi8.github.io/trump-collection/preview-online-memory-remote.html （本人が別端末試遊で動作確認、学校Safariは未確認）
- Google サイトに貼る場合は `dist/trump-collection.html` の中身をそのまま貼り付けてください（単体ファイル版）。

## 今後の最優先開発

1. 共通のオンラインルーム（作成・番号参加・開始・再戦）と手札の非公開状態同期を設計・試作。
2. 既存4ゲームを友達同士のオンライン対戦へ対応。まず神経衰弱2人で接続検証し、4人ゲームへ展開。
3. 大富豪のローカルルールを追加し、ダウト・スピードなどの定番カードゲームを収録。

計画の詳細: [オンライン・カードゲーム拡張ロードマップ](docs/ROADMAP_ONLINE_AND_CARD_GAMES_2026-10-25.md)。学校での正式利用はGoogle Sitesへの単体HTML直接埋め込み、GitHub Pagesは試遊用。現行COM版とGoogle Sites版はオーナーが確認するまで変更しません。

## 収録ゲーム

| ゲーム | 人数 | 内容 |
|---|---|---|
| ババ抜き | 4人（あなた＋COM×3） | となりのカードを引いてペアを捨てる。ジョーカーが最後に残った人が負け |
| 七並べ | 4人（あなた＋COM×3） | パスは3回まで、4回で脱落（手札は場に並べられます） |
| 神経衰弱 | 2人（あなた vs COM） | 24枚・COM の記憶力は3段階（よわい／ふつう／つよい） |
| 大富豪 | 4人（あなた＋COM×3） | 8切り・革命・スート縛り・スペ3返し・イレブンバック・反則上がり・献上を ON/OFF 設定可能 |

## 開発メモ

- `index.html` … 画面（UI）
- `games.mjs` … ゲームのルールと COM の思考（画面なしでテスト可能）
- `tests/games.test.mjs` … ルールの自動テスト（`node --test "tests/*.mjs"`、計52件（既存・4席共通・Firebaseモックの統合テスト））
- `build-embed.mjs` … 単体ファイル版 `dist/trump-collection.html` の生成
- `dev/verify.mjs` … 総合検証（テスト→ビルド→フック駆動の通しプレイ→スクショ→基準画像との差分）
- `docs/research-*.md` … ルール／カード選択UI／カード品質の調査メモ

## 未確認事項（正直に書きます）

- 学校の iPad 実機（Safari）での動作・操作感は未確認です。試遊は GitHub Pages 経由でお願いします。
- Google サイトへ実際に貼った状態での動作は未確認です（単体ファイルは外部読み込みなしで作っています）。
- 神経衰弱はSupabaseで**本人の別端末試遊に成功**。学校iPad実機・Google Sitesでの実通信は未確認。4人対戦はローカルブラウザ検証済みだが**Firebase実通信・Auth/Rules・非公開手札配送は未実装**。
- COM の強さは「そこそこ考える」程度です。大富豪の打ち回しは実プレイの感想に合わせて調整していきます。


## オンライン基盤Phase 1（開発ラボ）

神経衰弱のホスト・ゲスト用ルーム、READY、START、カードをめくる、結果、再戦を別タブのローカル通信で検証済み。**まだ離れた端末とのインターネット対戦ではありません。**

- [2タブ試遊ラボ](https://8mahi8.github.io/trump-collection/preview-online-memory-lab.html)
- [実装ファイル・30テスト・残課題](online/README.md)

## Phase 3｜4席共通エンジン＋自動4画面試験（2026-10-25）

ババ抜き・七並べ・大富豪を共通の4人ルームエンジンへ移植。入室→READY→開始→合法手→決着→再戦を各ゲームで検証。**52件のNodeテスト合格（うち90試合の4席ロジック自動完走）**。Chromiumでも4画面・3ゲームの完走と一致を確認し、再実行用スクリプトをGitHubに保存。

- [4人共通エンジン](online/four-seat-authority.mjs) / [ローカル4タブ検証画面](online/four-seat-lab.html)
- 自動検証：`node --test tests/*.mjs`、`python dev/verify_four_seat_browser.py`（Python PlaywrightとChromiumが必要）
- [4席検証結果とFirebase移行設計](docs/FOUR_SEAT_PHASE3_2026-10-25.md)。**Firebaseへはまだ接続していない**ため、手札の非公開を保証するRules/Authを先にテストする。

## Phase 5｜Firebase実エミュレーターで4人対戦完走（2026-10-25）

- [GitHub Actions実行成功](https://github.com/8mahi8/trump-collection/actions/runs/40158460489)：既存Nodeテスト**52/52合格**、Firebase Local Emulator SuiteのAuth + RTDB Rules上でも4人が匿名認証→参加→READY→開始→対戦→決着→再戦。
- ババ抜き28手、七並べ52手、大富豪97手で**実エミュレーター上の対戦完走**。他人の非公開手札とコマンドキューの取得は拒否。
- 命令キューの権限と正式席番号を修正。詳しくは[Firebase設計／実エミュレーター検証記録](firebase/README.md)。
- **実Firebase本番と学校Safari/Google Sitesはまだ未検証**。専用Rulesは既存Firebaseへ勝手に適用しない。

## Phase 4｜Firebase RTDBの安全な通信基盤（2026-10-25）

- [専用Firebase設計と未完了ゲート](firebase/README.md)。匿名認証・トークン更新・UIDごとの手札・公開情報・操作命令・結果ACKを**SDK/CDN不要のRESTアダプター**として開発。
- `online/firebase-room-store.mjs` と `online/firebase-room-controller.mjs` を追加。ホスト／ゲスト4人の模擬通信で3ゲームを最後まで進行、切断相当の書込失敗・再送・古い操作・非公開手札の同期チェックを確認。
- `node --test tests/*.mjs` で**52/52合格**（Firebase REST/Auth部分はモック）。**実Firebase RTDB EmulatorでのRules評価、本番接続は未完了**。他ゲームのFirebaseデータやRulesは変更していない。

## Phase 2｜オンライン試作（2026-10-25）

- `online/memory-authority.mjs`: 2人神経衰弱の配札・手番の正本。伏せ札は公開viewへ含めない。
- `online/realtime-wire.mjs`: 外部CDN不要のSupabase標準WebSocket。再接続とルーム別topicを実装。
- `online/memory-remote.html`: GitHub Pagesとは別の開発用ソース。2人のルーム番号参加・対戦・再戦のUI。
- [Phase 2のテスト・既知制約](docs/ONLINE_REMOTE_PHASE2_2026-10-25.md)。既存のSupabase Freeプロジェクトの独立チャンネルを利用した**公開チャンネルの短期試作**であり、5桁番号は認証ではない。学校正式版へは未展開。
