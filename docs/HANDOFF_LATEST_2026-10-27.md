> **【2026-10-27 本人追加要望：人数不足はCPUで埋める】** 大富豪・七並べ・ババ抜きの4席は人間1〜4人＋空席CPUで自動補完。準備は人間のみ、途中入室した人間は対戦開始前ならCPU席を置換。ホスト側CPUが既存ゲームBOTを使い、追加認証・別Firebase接続は不要。[仕様と検証](V2_CPU_AUTOFILL_2026-10-27.md)。
>
> [Foundation V2 #40525433775 success](https://github.com/8mahi8/trump-collection/actions/runs/40525433775)：1人＋CPU3人で3ゲームを完走。[V2 WebKit/Chromium #40525838166 success](https://github.com/8mahi8/trump-collection/actions/runs/40525838166)：友達2人＋CPU2人大富豪が共通ロビーから対戦画面へ移行、CPU席表示。Firebase Auth呼出0。**学校版、main、本番Firebase Rulesは変更しない**。オンライン神経衰弱はまだ未実装。
> **【2026-10-27 最優先・本人指示による修正】**：学校向けV2のオンラインは **Firebase匿名認証を使わない**。また **ホスト再読み込みからの対戦復帰は作らない**。友達だけで遊べるシンプルな共通ルームを優先する。過去の本引き継ぎやPhase文書の「匿名Auth必須」「reload復帰」は古い案であり、これに上書きされた。
>
> 実コード：`v2/online-app.mjs`からAuth signInを削除し、`v2/net/firebase-room-lobby-rest.mjs`に`friendOnlyNoAuth:true`を導入。4人・Chrome/WebKit Google Sites風UIで **Firebase Auth API呼出0回** の試験成功：[Actions #40522130962](https://github.com/8mahi8/trump-collection/actions/runs/40522130962)。[本人指示・技術的注意の詳細](V2_FRIENDS_NOAUTH_DECISION_2026-10-27.md)。**本番Firebase Rules/DB/Google Sites公開版は無変更**。
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

## 2026-10-27｜確定した新UX要望：ゲーム別ルーム廃止・共通ルーム先行
- **本人確認済み**：最初に友達と1つのルームへ集合し、そのロビー内でゲームを選択。1戦後も同じ部屋へ戻り、別のゲームを始められるようにする。
- 設計詳細：[V2_ROOM_FIRST_LOBBY_2026-10-27.md](V2_ROOM_FIRST_LOBBY_2026-10-27.md)。Roomのメンバー/ルーム番号/チャットと、個別Matchのゲーム/参加者/状態を切り分ける。
- **これが今後の最優先前提**。旧Firebaseはゲーム別roomCode/game固定のため、そのまま移植せずRoom/Match契約と状態遷移の再設計を先行させる。
- COMモードはルーム不要。4人ルームから2人用神経衰弱を選択する場合の残りの人の扱いは未決定。
- まだ設計文書を追加した段階。Room-first UI/通信が完成したわけではない。main・学校公開版・本番サービスは変更しない。
## 2026-10-27｜Room-first Phase 1bの実装と成功したCI
- **共通ルームの純粋な状態管理を実装済**：`v2/core/shared-room.mjs`。部屋はゲームを固定せず、参加・選択・Ready・マッチ開始/終了・同じ部屋に戻る・旧Matchコマンド拒否に対応。
- **2人/4人ゲームを分離**：4人部屋から2人用神経衰弱の参加者を指定し、他の人は操作できない。4人ゲームは全員が揃うと自動選択する。
- **Firebase用の新パス/条件付き更新アダプター**：`v2/net/firebase-room-lobby-rest.mjs`。既存のV1データは使わず、認証必須・ETag/if-matchの競合拒否をモック検証。
- **詳細報告**：[V2_ROOM_FIRST_PHASE1B_2026-10-27.md](V2_ROOM_FIRST_PHASE1B_2026-10-27.md)。`tests/v2-shared-room.test.mjs` と `tests/v2-firebase-lobby-rest.test.mjs` を追加。
- **[Actions #40508290755](https://github.com/8mahi8/trump-collection/actions/runs/40508290755) success**：旧ゲームの回帰テストを含むNodeテスト、学校版ソース不変チェック、Chromium/WebKitタップとビルドの全工程成功。
- **まだ本物のルームオンライン4人対戦は未接続**。Firebase本番Rules/DBの新パスも適用していない。次はRoomCoordinator+ゲスト操作キューをホスト権限・エミュレーターで検証し、ババ抜きMatchの共通UIに接続する。
## Phase 1c｜共通ルームの実Firebaseエミュレーター接続まで成功（2026-10-27）
- **実装済**：`v2/session/room-coordinator.mjs` と `v2/net/firebase-room-lobby-rest.mjs`。認証UIDに紐づくリクエストキュー、ホストだけがCASで書き換えるRoom、結果ACK、競合・過去操作拒否。
- **実装済**：`firebase/trump-rooms-v2.rules.json`（隔離されたエミュレーター専用）。旧本番Rulesには適用していない。
- **実機Firebase Emulator成功**：[Actions #40510448708](https://github.com/8mahi8/trump-collection/actions/runs/40510448708)。4人同時入室/Ready→ババ抜きMatch→同ルームに戻る→2人神経衰弱Match、他人書込み拒否、古いReady拒否までテスト。
- [Phase 1c詳細・残作業](V2_ROOM_FIRST_PHASE1C_2026-10-27.md) を参照。次のPhase 2aでは**ババ抜きの実カード配布/操作・秘密手札・オンライン4画面Renderer**を共通Room Matchに接続する。
- **まだ4人ババ抜きのオンライン対戦完走・学校Safari/Google Sites V2実機確認は未完了**。エミュレーターでLobbyが動いたことをゲーム完成と混同しない。
## Phase 2a｜実Firebase通信で4人ババ抜き1試合完走（2026-10-27）
- **[Phase2aの実装と証拠](V2_ROOM_FIRST_PHASE2A_2026-10-27.md)** を確認。`v2/session/four-player-match.mjs`（既存4席Authority再利用）、`room-match-host.mjs`、`room-match-guest.mjs`、Firebase Match専用REST APIとUID本人だけ読める手札のRulesを実装。
- **[Actions #40516425639](https://github.com/8mahi8/trump-collection/actions/runs/40516425639) 成功**：認証UID4人が共通Roomでババ抜きを全ターン通して完走。各ターンで手札/盤面/合法操作取得→カード引く→Firebaseキュー→ホストAuthority更新→本人ACK、結果→**同じ部屋に戻り七並べ選択**。部外者・他人の手札を実Rulesで拒否。
- **この成功は通信・ゲーム進行のCI**。4画面のUIをSafariで実際にタップして遊ぶ完成テストではない。オンラインLobby→共通Table Rendererの画面結合、学校ネットワーク上の重さの計測はPhase 2b以降。
- **重要**：ホストAuthorityは現在メモリーのみ。ホストがリロード・離脱した時の復帰手段を未実装。学校Google Sites版/main/本番Firebase/Supabase/旧Drive原本は一切変更しない。
- 次担当：Phase 2bとして**単一GameShellにRoom作成/参加/Ready/選択/結果とオンラインRoomSessionをつなぐ**。4ブラウザ＋Chromium/WebKit Google Sites風iframeで画面を見て操作と描画を検証。ゲーム別ページ/iframeを増やさない。