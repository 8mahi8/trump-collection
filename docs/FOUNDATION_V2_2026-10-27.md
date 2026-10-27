# Foundation V2｜学校の実機失敗を受けた全面再設計（2026-10-27）

## 0. 実際に起きたこと／前提
- 本人が学校のiPad / Google Sites直接HTML埋め込みを試し、**大幅な重さ・神経衰弱のオンライン接続不可・COMと友達対戦の極端なUI差**を報告。**実際の通信エラーコード・CPU消費・WebSocketブロック有無は未測定**。
- これまでのChromium/WebKit Playwright＋Firebaseエミュレーターの106/106合格は**実際の学校ネットワーク上での操作感や通信を保証しなかった**。V1.5系へ表面的なパッチを続けるのを中断。
- **学校で遊ぶのが目的の趣味ゲーム**。無料、Safari、Google Sitesの**埋め込みコードへHTML全文を直接貼る**、4ゲーム、短時間でタップ操作、COMあり、友達対戦あり、チャットあり。
- 現行 `main`／Google Sites公開版／Firebase本番DBとRules／Supabase別ゲームプロジェクトは**無変更**。旧V1.5開発版とGoogle Drive原本は保存してロールバック可能にする。

## 1. コードを読んで確認できた構造上の原因候補
### 重さ：アプリ丸ごと3つを一度に組み込んでいる
- `dev/build-collection-lab.mjs` が `buildCOM()`・`buildOnlineHtml()`・`buildMemory()` を別々に生成、`online/collection-launcher.template.html` で `const APP_HTML={com,friends4,memory}` の**巨大文字列**としてバンドル、`iframe.srcdoc` に丸ごと再ロード。
- **COMと友達で独立した画面・CSS・レンダラー**。共通のゲームルールは既に `games.mjs` で部分共有しているので、再設計で残すべき。最大の重複は**画面とセッション制御**。
- `dist/trump-collection-open-root-trial.html` は旧時点で約207千文字（前回GitHubソース）。JavaScript解析・DOM構築・iframes分離・毎手番DOM再作成のコストが学校iPadで重い可能性。**これだけで実機の重さの主原因と断定はできない**。

### 重さ：現在のオンラインはREST短周期ポーリング
- `online/firebase-poll-policy.mjs` はplaying時**ホスト650ms／自分の番650ms／それ以外900ms**を目安に定期取得。
- `online/firebase-room-controller.mjs` のホスト1 tickは最低**closed / leaveRequests / joinRequests / commands の4 GET**を順番に行い、ゲストpollでも**closed / public / private / heartbeat の4 GET**。ホスト端末はホストtickに加えて自分のゲストpollも実行する。状況でprivate/publicのPUTやreceiptのGET/PUT等が増える。静止時ですら4人合計で**概算25 GET/秒以上**の設計（4x4+4x3的な近似。通信遅延や各tickの所要時間により実レートは変化）。実機の実測値ではない。
- 複数GET・多数のDOM再構成・iPadブラウザにおける再描画が重い／手が反映されるまで長い等の候補。**通信時間と描画時間を分離計測**するまで「回線のせい／端末のせい」と決めつけない。

### 神経衰弱だけ繋がらない
- `online/realtime-wire.mjs` はSupabase Realtimeの`wss://.../realtime/v1/websocket`にPhoenixプロトコルで接続する。コードには`signInAnonymously`はない。**匿名認証失敗と断定する根拠はない**。
- 学校がWebSocketを制限した可能性、特定ドメインの制限、Supabase側設定・鍵・プロトコルの問題、端末のネットワーク事情などは**未切り分け**。専用の**読み取り／接続のみ診断**を別途導入する。
- このゲームだけ別通信基盤・別描画になっていること自体が保守の負担。**V2で4ゲームともFirebase RTDBを第一候補に統一**。ただし現行Rules/匿名認証期限・ゲーム相手の手札公開を放置せず、既存ルールとは独立した設計を後から検証・移行。

## 2. V2原則（絶対に曲げない）
1. **ルール／状態遷移は1本**：既存`games.mjs`のロジックを再利用。完全なルール同一性・非公開手札を試験で保証。
2. **UIレンダラーは1本**：`render(viewModel)`。COMと対人で画面を分岐しない。差が出ていいのは相手の表示名／席数／接続状態・チャットなど必要最小限のみ。
3. **モードを差し替える**：`SessionController` に `localCpu` と `firebaseRoom`、将来のbot充足。両者が同じ`viewModel`と`action`を扱う。
4. **HTMLは1ページ／単一DOM**：3アプリ全部を文字列化して別の `srcdoc` に再展開する方式をやめる。Google Sitesが提供する外側の1 iframeは残るが、ゲーム内の入れ子iframeは廃止。ビルドされたHTMLにJS/CSSをインラインで同梱し、CDN不要。
5. **通信は実測で最小化**：接続・対戦・終了・スリープの各状態で必要最小限の取得。基本はイベント駆動の購読方式を比較し、学校でWebSocket等が使えない場合はHTTPベースの代替策を検証。Firebase公式の`onValue`やREST SSEは選択肢だが、学校環境で成立を確認するまでは採用確定しない。
6. **表示更新は状態変化時のみ**：描画に関係するrevision／座席／選択が不変ならDOM全再生成しない。CSSはカード・盤面の共通コンポーネントを再利用。UI 60fpsを目指すが実測優先。
7. **学校での使用をリリース条件にする**：Playwright 800×450／667×375、iPad実機Safariのタップ／入力／画面回転、別端末接続、遅延時の復帰。学校で試すまで「完成」と宣言しない。
8. **身内でもアカウント機密情報を埋めない**：現在のopen-rootルールでは第三者に手札やチャットが見える。今すぐ本番変更は行わないが、正規版では非公開状態の権限制御を検証する。既存のroot許可は2026-11-08 00:00 JSTで期限を迎える。

## 3. 独立した層と境界
```
v2/
  core/
    unified-view.mjs        // Local Engine と online Authority の状態を同じViewModelへ正規化
    actions.mjs             // 共通Command: draw/play/pass/flip/ready/rematch など
  session/
    cpu-session.mjs         // 既存ゲームエンジン + BOT/速度
    room-session.mjs        // 2/4席、認証/接続、再接続、host authority
  net/
    firebase-rest.mjs       // 学校で動作する通信とリクエスト計測
    connectivity-check.html // 学校でも開ける読取専用のHTTP/WSS接続確認
  ui/
    table-renderer.mjs      // CPUでも友達でも同じHTML
    table.css
    lobby.mjs               // 対戦開始前だけ必要な入力UI
  build/
    build-single-html.mjs   // 本番候補は毎回1つのGoogle Sites用HTMLへ再現可能ビルド
```
実装前からコードをこの通りに100%新設することが目的ではない。各機能の責務を分けて**テストと差し替えの境界を明確にする**ことが目的。

### 共有ViewModelの契約
`{game,phase,seat,turn,players,hand,board,legal,connection,result}`
- `players`には公開人数・手札枚数・得点のみ。対人でほかのプレイヤーの手札を混入させない。
- `hand`は自分の手札のみ。`board`は公開情報。`legal`は自分の合法手のみ。
- `mode`はUI装飾を切り替える条件にしない。友達・COMの画面差は状態表示だけで表現。

## 4. 段階と終了条件
1. **Phase V2-0（今回）**：根本原因候補とビルド構造を文書化し、新しい**独立開発ブランチ**で`unified-view`の純粋関数＋CPU／対人の同一表示契約テストを先に実装。旧版に即時の差し替えをしない。学校向けHTTPとWSSの接続診断も後続に備える。
2. **V2-1**：ババ抜きから**1画面/1ルール/CPUと友達の共通UI**で1試合を最後まで。プレイヤー選択で同じコンポーネントが動くことをスクリーンショット比較。古いUIは混ぜない。
3. **V2-2**：神経衰弱2人も同じ画面と通信基盤へ。学校での通信診断結果を踏まえFirebase-onlyの実装可否を決める。局所メッセージで隠したカード内容を相手に漏らさない。
4. **V2-3**：七並べ→大富豪（ルール設定・革命・献上の回帰）へ展開。UIや接続コードの新たな複製は禁止。
5. **V2-4**：ローカル端末と学校ネットワークで性能確認（初期表示速度、操作→画面更新、秒間HTTP要求数・平均/p95遅延、描画負荷、通信断復帰）。合格後だけGoogle Sites用コードを生成→別のGoogle Driveファイルに保存→本人が試す。既存Google Sitesは変更しない。

## 5. やらないこと
- 旧版のページへ場当たり的なCSSだけを追加して「軽くなった」と断言する。
- Supabaseログイン追加で無理やり直そうとする、あるいは匿名認証が原因と決めつける。
- 学校のGoogle SitesにGitHub PagesのURLを埋め込む。
- 本番Firebase Rulesを実機結果なしに一括上書きする。
- 4ゲーム同時に基盤を載せ替え、どこが壊れたか分からなくする。

## 外部資料（設計根拠）
- Firebase 公式 Web listener: https://firebase.google.com/docs/database/web/read-and-write
- Firebase REST SSE: https://firebase.google.com/docs/database/rest/retrieve-data
- Supabase Realtime Broadcast: https://supabase.com/docs/guides/realtime/broadcast
