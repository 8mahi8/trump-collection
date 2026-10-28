> **【2026-10-28 検証確定】** **[UI #40643315973 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40643315973)**：Chromium/WebKit両方で**2方向チャット送受信、HTML文字列のテキスト扱い、大富豪3→…→K→A→2→Jokerの強さ順・マーク順切り替え、4ゲーム連続完走**が全て成功。**[Foundation #40643408957 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40643408957)**：168/168合格。[Realtime Database Emulator #40643408930 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40643408930)も成功。
> 学校iPad実機でUIの体感評価は未了。新しい試遊HTMLはCI Artifactに生成済みだが、学校公開Google Sites、本番Firebase Rules/DB、main、Google Driveは**まだ変更していない**。
# トランプコレクション V2｜学校実機フィードバック：大富豪の手札順とチャット復元（2026-10-28）

## ユーザーの指摘
- 学校iPad上のFirebase対戦接続は実際に成功。
- カード選択後の重さは前回対処済み。今回、**大富豪のカードの並び順がおかしく、他ゲームに比べてUI/完成度が低い**、**以前あったチャットがなくなった**と再報告。
- 旧版 `index.html` / `docs/PHASE21_ROOM_CHAT_2026-10-25.md` と V2 コードを直接比較。通信共通化の際の機能退行と確認した。

## 今回直したこと
1. `v2/ui/card-order.mjs`：大富豪の本来の強さに合わせ、**3→4→5→6→7→8→9→10→J→Q→K→A→2→ジョーカー**で並ぶよう変更。V2従来の単純なA→2→3順が誤りだった。カードデータ自体は並べ替えない。
2. `v2/ui/table-renderer.mjs`：強さ順/マーク順の切り替えを1タップで可能にした。七並べ・ババ抜きは従来のマーク順を初期表示、必要に応じて強さ順へ変更。選択時のDOM高速パス・選択カードは保持。
3. `v2/ui/room-chat.mjs`：旧版の小さな開閉パネルを復元。ルーム在籍中はロビー・対戦中・結果画面・待機画面から利用できる。閉じている間はGET/ポーリングなし。開いている間だけ約2.5秒ごとに受信。120文字まで、1人直近10件＝部屋最大40件。HTMLとして解釈しないテキスト表示。チャットはゲーム操作/手札同期revisionと独立。
4. `v2/net/firebase-room-lobby-rest.mjs`：共通の無認証Firebase RESTで `trumpRoomsV2/$room/chat/$uid/$slot` を送受信。認証サービス・Supabase・ログイン・無制限履歴なし。
5. `firebase/trump-rooms-v2-friends-emulator.rules.json`：開発用Firebase emulatorに新しいチャットパスを限定追加。**本番Firebase Rulesは一切変更しない**。身内向け・認証なしでは第三者を厳密に除外できないため、個人情報を入力しない。
6. `v2/online-app.mjs`：試合結果に順位/神経衰弱のペア数を表示する簡易一覧を追加。結果はFirebaseの公開情報のみを参照し、失敗時もロビーに戻れる。
7. `tests/v2-ui-card-order-chat.test.mjs` / `tests/v2-firebase-lobby-rest.test.mjs` / `dev/verify-v2-chat-emulator.mjs` / `dev/verify-v2-online-ui.mjs`：カード順・切り替え・チャット40件上限/不正長文・2台での往復とXSSテキスト化を確認。検査中に誤った制御文字Regexで数字まで弾くバグが見つかったため修正した。

## 検証条件
- 最新の`Foundation V2` と `V2 Room-first UI Safari and Chromium Emulator` で、**2台でのチャット往復＋HTMLエスケープ＋4ゲーム全対局完走＋カード並び替え**を確認してからGoogle Sites貼り替え版を採用する。
- 既存の学校実Google Sites、本番Firebase Rules/DB、main、Google Driveには変更を加えていない。本人の依頼があれば、テストに合格した単一HTMLとTXTをGoogle Driveに別々に保存する。
- 残りのUI完成度：画面構成、手札タップ領域の大きさ、対戦情報の分かりやすさと演出。実機での体感改善はまだ未確認。
