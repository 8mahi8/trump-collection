> **【2026-10-27 最優先・本人指示による修正】**：学校向けV2のオンラインは **Firebase匿名認証を使わない**。また **ホスト再読み込みからの対戦復帰は作らない**。友達だけで遊べるシンプルな共通ルームを優先する。過去の本引き継ぎやPhase文書の「匿名Auth必須」「reload復帰」は古い案であり、これに上書きされた。
>
> 実コード：`v2/online-app.mjs`からAuth signInを削除し、`v2/net/firebase-room-lobby-rest.mjs`に`friendOnlyNoAuth:true`を導入。4人・Chrome/WebKit Google Sites風UIで **Firebase Auth API呼出0回** の試験成功：[Actions #40522130962](https://github.com/8mahi8/trump-collection/actions/runs/40522130962)。[本人指示・技術的注意の詳細](V2_FRIENDS_NOAUTH_DECISION_2026-10-27.md)。**本番Firebase Rules/DB/Google Sites公開版は無変更**。
# トランプコレクション｜V2開発担当AI 引き継ぎ【2026-10-27 夜】

> **重要**：本書は新チャットで開発を直ちに継続するための最新版。GitHubのこの開発ブランチ、開発PR #2、既存の設計資料・テスト実績を自分で確認すること。過去の「V1.5学校試遊版」を完成・軽快と決めつけないこと。

## 最重要のユーザー要求
- 学校iPadのSafariで、**Google Sitesの「コードを埋め込む」にHTML全文を直接貼り付け**、友達だけで短時間遊ぶ無料のトランプゲーム集。GitHub Pages URL埋め込み方式に戻さない。
- **ババ抜き・七並べ・神経衰弱・大富豪**、COM対戦と友達オンライン対戦。部屋番号、準備、再戦、必要なチャットを維持する。
- 学校実機で**非常に重かった／神経衰弱がオンライン接続できなかった／COMと対人でUIが別ゲームのように違った**。これがV2再設計の起点。古い自動テストが成功しても学校で快適とは限らない。
- ゲームごとに別アプリを作る発想自体をやめたい。**ゲームはプラグイン登録、ゲームエンジン・通信・部屋・UIは共通基盤**。追加する5本目以降も個別のHTML/オンラインUIを複製しない。
- 外部の公式資料も調査する。調査済み：[boardgame.io](https://boardgame.io/)、[Colyseus](https://docs.colyseus.io/state)、[BGA Studio](https://en.doc.boardgamearena.com/Development)、[Firebase RTDB](https://firebase.google.com/docs/database/web/read-and-write)。新しい設計上の迷いがあれば必ず資料を再確認する。
- ユーザーの「任した」「任せた」は調査、実装、テスト、GitHubブランチへの保存まで自主的に進めてよいという意味。**学校Google Sites公開版、main、本番Firebase Auth/DB Rules、Supabase設定は勝手に変更しない**。

## 開発場所
- リポジトリ：[8mahi8/trump-collection](https://github.com/8mahi8/trump-collection)
- **現行V2開発ブランチ**：`refactor/unified-core-and-school-network-20261027`
- **開発PR #2（Draft）**：https://github.com/8mahi8/trump-collection/pull/2
- 以前のV1.5開発ブランチ：`dev/quality-and-ui-v1-5-20261024`、PR #1（変更禁止ではないが、旧版と混ぜずV2ブランチで進行）。
- 重要資料：[Foundation V2](FOUNDATION_V2_2026-10-27.md)、[外部フレームワーク比較](V2_EXTERNAL_FRAMEWORK_RESEARCH_AND_PLUGIN_PLAN_2026-10-27.md)、[旧版UXレビュー](PHASE28_HUMAN_UI_REVIEW_2026-10-27.md)、[旧版UX修正](PHASE29_SCHOOL_IPAD_UX_FIX_2026-10-27.md)。

## 現状：実際にGitHubへ保存済み
### 1. ゲーム共通基盤（実装・ユニットテスト合格）
- `v2/core/game-registry.mjs`：プラグイン登録／重複・欠落・ID検査。
- `v2/games/definitions.mjs`：4ゲームの `createLocal / localBoard / localLegal / remoteBoard / remoteLegal / actions / interaction` など。まだ実装の一部は`games.mjs`に共存。ゲームの増設はここや新規ゲーム定義に限定し、レンダラーにゲームIDの分岐を増やさない。
- `v2/core/unified-view.mjs`：CPUとFirebaseの公開/自分専用状態を、`{game,phase,seat,turn,players,hand,board,legal,connection,result}` の同じ契約へ変換。相手の隠し手札をUIへ流さない。
- `tests/v2-game-registry.test.mjs`で、架空の「5本目」をプラグイン登録だけで投影できることを確認。
### 2. CPU版の共通UIがブラウザで操作可能（**ババ抜きのみ**）
- `v2/session/cpu-session.mjs`：汎用CPUゲームセッション（登録済みゲームhookを実行）。
- `v2/ui/table-renderer.mjs`、`v2/ui/board-surfaces.mjs`、`v2/ui/table.css`：**CPU/オンライン共用のテーブル、手札、操作バー**。ゲーム固有盤面のみsurfaceを切り替える。単一DOM、二重iframeなし。
- `v2/lab.html`、`v2/app.mjs`：現状は**ババ抜きCPUのみ選択可能**。他3ゲームのボタンは未実装として無効。オンラインは未接続。
- `v2/build/build-lab.mjs`：`esbuild@0.25.12`をビルド時だけ使用。`node v2/build/build-lab.mjs`で`dist/v2-babanuki-cpu-lab.html`（**約24KB、外部SDK/CDN・ネストiframeなし**）を生成。生成済みのHTMLはGitHub Actionsの一時Artifactであり、学校Google Sites版として配布・公開したものではない。
- `tests/v2-cpu-session.test.mjs`でババ抜きCPU40試合完走。旧ゲームのテストも維持。
- `dev/verify-v2-browser.mjs`：Chromium/WebKit×800×450、667×375で実際のタップ→初手→画面更新→メニュー復帰、横幅・操作領域を検証。**CI #40452835822 成功、Node124/124**（当時）。
### 3. オンライン共通セッションの基礎（**まだブラウザ対人接続は未完**）
- `v2/session/room-session.mjs`：既存のFirebase 4人ゲスト controller が返す`publicView`/`privateView`を**同じ共通ViewModel**へ投影、合法操作を共通コマンドとして送信し、revision単位で通知を抑止。実際のFirebaseへの接続処理、room作成/参加/チャット/UI統合、2人神経衰弱は**まだ未実装**。
- `tests/v2-room-session.test.mjs`：偽のroom guestを注入し、revision更新通知、操作拒否、同期不一致、重複送信を検証。**エミュレーターで本当に複数端末接続できることを確認したわけではない**。
- `v2/net/connectivity-check.html`：Firebase HTTPS GETとSupabase WebSocket+公開チャンネル参加を別々に試す**読み取り/接続診断**（通信結果の実機測定は未実施、勝手に本番の書き込みはしない）。ユーザーは神経衰弱の接続失敗を報告したが、原因を匿名認証と断定しない（旧実装はSupabase匿名Authを使用していない）。
- **最新のV2主要CI**：[Actions #40453199726](https://github.com/8mahi8/trump-collection/actions/runs/40453199726) success。最新の個別commit・テスト総数はActionsを再確認すること。

## 次担当がまずやること（順番）
1. GitHub PR #2、最新commit、`docs/FOUNDATION_V2_2026-10-27.md`、本書、上記V2ファイルとテストを確認。**CIが通ることと実機快適を混同しない**。
2. **ババ抜きの共通UIに同じroom-sessionをつなぐ**。部屋作成→4人参加→Ready→start→タップして引く→全員へ同期→再戦/退出。UIを複製せずに実現。通信は従来のHost Authorityを原則再利用し、Firebase EmulatorでChrome/WebKit二重ではなくV2単一DOMの4画面動作検証。開発中にユーザーの実環境へ書き込まない。
3. **低負荷設計と実測**：V1.5はFirebase RESTを650〜900ms程度でpollし、各tickに複数GET。HTTP要求数・レスポンス・画面更新・初期ロードをログで数値化、Firebase onValue/SSEや低頻度pollingの相性を比較。学校ネットワークではWebSocket制限の可能性があるため、互換性を検証してから採用。通信方式の差し替えは`session/net`層に閉じ込める。
4. **神経衰弱**：学校でSupabaseが接続できなかった。通信診断の結果を踏まえ、2人用Firebaseアダプターを優先検討。隠したカードの正体や記憶情報を他人に送らず、神経衰弱も同じTable Rendererでプレイ可能にする。
5. 七並べと大富豪もCPU/対人共通セッションへ展開。ゲーム定義プラグイン以外へゲームIDごとの分岐を増やさない。最後に1つの軽量HTMLへまとめる。
6. 実画面を見てUI/UXをレビューし、学校iPadのSafari/Google Sitesへ**ユーザー本人が別試験ページで貼って確認**してからリリース判定。試遊HTMLやTXTを保存する場合はGoogle Driveに**個別ファイル（ZIP不要）**として保存。

## 禁止事項・重大な注意
- V1.5の`dist/trump-collection-open-root-trial.html`や既存Google Driveを「V2最新版」として配布しない。
- 旧版学校実機では非常に重いとの実測がある。古いChrome/WebKitテスト106合格でも重さを否定しない。
- COMと対人で別HTML/別画面を新設しない。**同一Renderer、同じデータ構造、同じカード操作**を維持。
- Firebaseの既存root-open Rulesは**2026-11-08 00:00 JSTに期限予定**（前チャットでユーザー報告）。本番ルールを許可なく変更しない。公開ルールが有効な間は第三者からルームや手札・チャットが見え得る点に注意。
- タイムラインや未来の成果を約束せず、現在のターン中に可能な範囲で実装・検証・GitHubに保存し、テスト根拠を報告する。

## 引き継ぎ時の開発状況まとめ
- **ゲームプラグイン登録方式＋CPU/オンライン共通ViewModel：実装済**
- **共通Renderer＋ババ抜きCPUの実操作・40試合自動検証：実装済**
- **4人オンラインの共通セッションアダプター：実装・単体試験済、実オンライン画面接続は未完**
- **4ゲームすべての新UI・神経衰弱Firebase移行・学校で軽快なV2試遊版：未完成**


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