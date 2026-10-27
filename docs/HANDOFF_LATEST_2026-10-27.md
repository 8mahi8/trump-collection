# トランプコレクション｜開発担当AI 最新引き継ぎ【2026-10-27】

## 最初に必ず読む
1. [V2 Phase1｜単一カードUI・CPU／オンライン共通セッションの実装](V2_PHASE1_SHARED_RENDERER_2026-10-27.md) — 最新の実装・テスト結果・未完成事項。
2. [Foundation V2｜学校実機の失敗からの再設計](FOUNDATION_V2_2026-10-27.md) — 方針と優先順位。
3. [外部フレームワーク調査とプラグイン化](V2_EXTERNAL_FRAMEWORK_RESEARCH_AND_PLUGIN_PLAN_2026-10-27.md) — boardgame.io、Colyseus、Board Game Arena、Firebaseの設計知見。
4. [PR #2](https://github.com/8mahi8/trump-collection/pull/2) — V2開発PR（Draft）。
5. [GitHub Actions #40453199726](https://github.com/8mahi8/trump-collection/actions/runs/40453199726) — V2 CPU版UI＋room adapter時点の**Node126/126・Chromium/WebKit実タップ成功**。

## 重要なユーザーからの実機フィードバック
ユーザーが学校iPadのGoogle Sites版で実際に遊んだところ、**非常に重かった**、**神経衰弱の対戦は接続できなかった**、**COMと対人戦のUIが別物で使いづらかった**。旧版のPlaywright＋Firebaseエミュレーター試験が通っていても学校で遊べる保証にならない。**個別UIや通信をゲームごとに再実装する方式自体を廃止**し、共通エンジン／共通UI／ゲームプラグイン方式で根本から作り直す。外部資料も都度調べ、設計の根拠を残す。

## リポジトリ・作業境界
- Repo: https://github.com/8mahi8/trump-collection
- **現在の開発ブランチ**: `refactor/unified-core-and-school-network-20261027`
- **開発PR #2**: https://github.com/8mahi8/trump-collection/pull/2 （Draft）
- 旧開発ブランチ: `dev/quality-and-ui-v1-5-20261024`、旧PR #1。
- **main・現在の学校Google Sites公開版・本番Firebase Auth/Rules/DB・Supabase本番サービスは勝手に変更禁止**。
- 学校の公開方法は**Google Sitesの「コードを埋め込む」にHTML全文を貼り付ける**。GitHub Pages URLを埋め込む方式ではない。無料運用必須。音声・リプレイ・操作ログ収集は不要。
- 「任した／任せた」は許可された開発ブランチで外部調査→設計→実装→自動テスト→GitHub保存まで主体的に進める意味。無意味な細部の確認は挟まない。

## 現在完了
1. `v2/core/game-registry.mjs` / `v2/games/definitions.mjs`：4ゲーム（ババ抜き、七並べ、神経衰弱、大富豪）を登録式プラグインへ。架空5本目の追加もテスト。
2. `v2/core/unified-view.mjs`：CPU・Firebaseの公開+自分専用状態を同一ViewModelに投影（対戦相手の非公開手札を流さない）。
3. `v2/ui/board-surfaces.mjs`, `v2/ui/table-renderer.mjs`, `v2/ui/table.css`：1 DOM・1カードテーブル。ゲームの操作方法はプラグイン定義`interaction`で指定。CPU/オンラインで独立UIを作らない。
4. `v2/session/cpu-session.mjs`とババ抜き`localMove/cpuChoose`：CPUババ抜き40試合完走テスト。
5. `v2/session/room-session.mjs`：既存Firebase guest `poll/act/receipt`を共通ViewModelへつなぐ薄いアダプター。**実際の4人オンライン画面統合は未完成**。
6. `v2/lab.html`, `v2/app.mjs`, `v2/build/build-lab.mjs`：単体ババ抜きCPU検証HTMLをビルド時に1ファイルへ。CIで生成されたHTMLは約24KB（全機能入り旧版との速度比較は不可）、iframe不要、CDN不要。
7. `dev/verify-v2-browser.mjs`：Chromium/WebKit × 800×450/667×375でカードを本当にタップし、更新とレイアウトとメニュー復帰を検証。
8. `v2/net/connectivity-check.html`：学校回線からFirebase HTTPSとSupabase WebSocketを切り分ける**読取・接続のみ**の診断。学校実機での結果は未取得。
9. **最新の確認済みフルCI**：[#40453199726](https://github.com/8mahi8/trump-collection/actions/runs/40453199726) Node126/126＋両エンジンブラウザテスト合格。最新コミットでは必ずCIを再確認。

## 未完了と最優先の次工程
- **最優先**：ババ抜きの既存Firebase 4人ルームと新`room-session.mjs`を同じ`v2/ui/table-renderer.mjs`へ接続。単一`GameShell`の部屋作成・入室・準備・開始・カード選択・退出を整える。CPU/対人で**同じDOM/CSS**を使用し、4端末Google Sites風・Chromium/WebKitで試合を最後まで検証。最初に旧画面を複製しない。
- **次**：通信計測（開始速度、実際のHTTP GET/PUT回数、操作～反映遅延、描画回数、停止・復帰）。旧版は650/900ms pollingで複数GET/回。Firebase購読SSE/onValueや学校で許されるHTTP fallbackを比較して最小化。**学校実機の重さの直接原因は未確定**。
- **次**：神経衰弱をSupabaseだけに依存しない学校で実用的なFirebase 2人用通信へ段階移行。匿名認証とSupabase WebSocketのどちらが原因か**断定しない**。共通UI・ゲームプラグインをそのまま使う。
- **次**：七並べ・大富豪・神経衰弱の`localMove/cpuChoose`など未実装プラグイン操作を追加。個別のHTML・通信系を増やさない。
- **合格条件**：新単一HTMLで4ゲーム、CPU＋友達対戦、学校Safariにおける低遅延・操作しやすさ。学校実機で試せるまでは「完全完成」と宣言しない。

## 技術／本番に関する注意
- 現行Firebase RTDBは `mygame-df915`。旧公開rootルールはユーザー申告では**2026-11-08 00:00 JST**に失効予定。既存サービスへ影響するため、ルールを勝手に変更・延長しない。
- 旧公開root環境では手札とチャットが外部から読み書き可能になりうる。開発用と安全な本番運用を混同しない。
- V2は今は**独立した開発試作**。Google Driveの旧貼り付けファイルを上書きしない。完成候補になったら新ファイルを別名で保存。


## 2026-10-27 夜｜新担当の引き継ぎ直後の修正
- **V2共通Room Sessionの接続安全性修正済み**。いったんreadyの後、host_unavailable/syncing/ネットワーク例外で古い盤面が有効なまま残り、未接続中に操作送信できたリスクを修正。再接続時は同じrevisionでもRendererへ通知する。
- **ACK前の二重送信防止**。部屋のrevisionが増えただけでは送信済み操作のpendingを解除しない。**その操作のreceiptが承認／拒否された時だけ解除**する。ルーム復帰・送信の単体テストを追加。
- Commit: [room session fix](https://github.com/8mahi8/trump-collection/commit/300ca98f9f63b1cd892f2f740e6eac3a589f56d9), [new tests](https://github.com/8mahi8/trump-collection/commit/7f6a96e709ff45d9f182a31300b7c5792fc98d9c)。
- **[CI #40505322043](https://github.com/8mahi8/trump-collection/actions/runs/40505322043) 成功**：旧ルール＋V2 Nodeテスト、Google Sites版不変確認、ブラウザ試作ビルド、Chromium/WebKit実タップの全工程成功。
- これは**通信アダプターの安全性修正**であり、**V2のオンライン部屋作成・参加・4人完走・学校iPad高速化・神経衰弱の接続不良解消が終わったという意味ではない**。次は旧online/firebase-room-controller.mjsのホストauthorityをV2共通GameShell/room-sessionへつなぎ、Firebase Emulatorで4画面完走すること。
- main、学校Google Sites版、本番Firebase/Supabase、既存Google Drive原本には一切触れていない。
