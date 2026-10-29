# V2 Phase1｜単一カードUI・CPU／オンライン共通セッションの実装（2026-10-27）

## 学校で問題が起きたため方針を変えた
学校iPadで報告された「非常に重い」「神経衰弱の接続失敗」「CPUと友達のUIが別物」は未解決のまま。そこでV1の別HTMLアプリを統合する方向をやめ、`v2/`へ**新しい共通テーブルUI**を実装した。既存の校内公開版、Firebase本番Rules/DB、Supabase、`main`、従来の試遊HTMLは変更していない。

## 今回の実装（実物）
- `v2/games/definitions.mjs`：ババ抜きプラグインに`localMove`/`cpuChoose`を実装。新しい共通SessionやUIは**ゲーム名の条件分岐を持たない**。ほか3ゲームの本物のCPU操作プラグインは順次追加。
- `v2/session/cpu-session.mjs`：プラグイン依存注入でローカル1人＋BOT、`getView/subscribe/dispatch/stepCpu/dispose`を実装。合法手はViewModelでチェックしてからルールエンジンに委譲。
- `v2/session/room-session.mjs`：既存`createFirebaseRoomGuest`相当の`poll/act/receipt`を注入し、**同じViewModelを供給**する薄いアダプター。公開/秘密revisionが一致しない場合は表示しない。同一revisionなら再通知しない。不正な操作を送信しない。**実Firebase本番との接続試験・ロビー統合は未実施**。
- `v2/ui/board-surfaces.mjs`：盤面表示だけの`draw/seven/field/memory`拡張登録。カード表裏は共通。
- `v2/ui/table-renderer.mjs`＋`v2/ui/table.css`：画面1つに手番／対戦人数／盤面／手札／出す・パス／カード選択を配置。ローカルかオンラインかでDOMを作り直す分岐を持たない。ゲームごとの選択操作はプラグイン宣言`interaction`に従う。ViewModelが不変なら再描画しない。
- `v2/lab.html`＋`v2/app.mjs`：本当に操作できる**ババ抜きCPU戦**のブラウザラボ。ほか3ゲームは「次の開発段階」と明示。online modeも未搭載と明示。100ms間隔のBOT操作とカードタップは試験済み。
- `v2/build/build-lab.mjs`：ビルド時のみバンドラー（esbuild **0.25.12で固定**）を使い、CSS＋JSを1枚のHTMLへインライン化する。Google Sitesが直接埋め込める技術形式だが、**まだ学校試遊完成品ではない**。
- `dev/verify-v2-browser.mjs`：Playwright **Chromium＋WebKit**で横800×450・667×375、touch`.tap()`による「CPUババ抜き→実カードを引く→View更新→ゲーム選択へ戻る」。単一HTML・iframeゼロ・手札/盤面/操作の表示範囲を検査してスクリーンショット保存。
- `.github/workflows/foundation-v2.yml`：単体テスト＋ブラウザUIを継続検証。**学校のGoogle Sites版やFirebaseルールを自動変更しない**。CI Artifactに開発用HTMLと実画面スクリーンショットを7日間保持。

## 証拠／限界
**[GitHub Actions #40453199726 成功](https://github.com/8mahi8/trump-collection/actions/runs/40453199726)**：
- **Node126/126合格**（旧ゲームロジック、共通Registry/状態、CPUババ抜き40試合の完走、Room adapterの不正操作拒否・revision重複抑制含む）。
- Playwright Chromium：800×450、667×375 **実タップと画面検査成功**。
- Playwright WebKit：800×450、667×375 **実タップと画面検査成功**。
- 新ババ抜きCPUだけを含む試験HTMLは**24,370文字**。旧約20万文字の全ゲーム試遊版と機能・ルール・通信が異なるため、**ファイルサイズを根拠に「本番が何倍軽くなった」とは言えない**。
- **オンライン接続も学校iPad実機もまだ未検証**。特にFirebase RTDB RESTの頻繁なGET問題は**未改善**。Supabase接続障害も未解決。神経衰弱のFirebase移行も未着手。
- CPU／オンラインで**同じRendererを使える契約とコードはできた**が、オンラインSessionは旧Firebase通信に接続された完走テストを未実施。初めてこの新UIにオンライン接続を組み込んで初めて本当のUI統一が検証される。

## 次工程（この順で）
1. オンライン入室・準備・スタート・退出を共通`GameShell`へ集約する。ババ抜き4端末から始め、**同じDOM/CSS**でCPU対戦とオンライン対戦ができることをスクリーンショット＋操作テストで確認。
2. 通信計測：ステージごとの実HTTP GET/PUT数、手番変更遅延、UI描画回数と時間を計る。Firebaseの購読機構（onValue/SSE）と学校回線で使えるHTTP代替の比較から必要最小限を選ぶ。規則を勝手に変更しない。
3. 神経衰弱を同一`GameShell`＋学校で使えるFirebase 2人部屋へ段階移行（匿名認証・WebSocket失敗と断定しない）。
4. 七並べ→大富豪のPluginに`localMove/cpuChoose`と一貫した操作を足し、共通UIで全4ゲームを試せるようにする。
5. 学校iPadでのロード時間・タップ遅延・接続結果を測ったうえで新試遊版をGoogle Sites直接コード埋め込み用単一HTMLとして発行。旧版は上書きしない。

参考：[外部資料に基づくプラグイン設計](V2_EXTERNAL_FRAMEWORK_RESEARCH_AND_PLUGIN_PLAN_2026-10-27.md)
