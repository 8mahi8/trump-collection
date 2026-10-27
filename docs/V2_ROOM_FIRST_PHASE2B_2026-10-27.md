# トランプコレクション V2｜Phase 2b 共通ルームGUI統合と通信耐障害テスト（2026-10-27）

## ユーザーの確認済みUX
友達とゲーム別に部屋を作らず、**共通ルームを先に作成→4人が集合→ゲーム選択→対局→同じ部屋に戻る**。Google SitesではHTML/CSS/JS全文を「コードを埋め込む」に直接貼り付ける方式。身内・iPad Safari・無料優先。

## 今回新規実装（V2開発ブランチのみ）
- `v2/online-app.mjs`：CPUか友達かの選択から、5桁の共通ルームの作成/参加、4人表示、ゲーム選択、準備、試合開始、結果、同じ部屋への復帰、退出まで**単一のGameShell**で管理。友達対戦では既存`createRoomCoordinator`、`createRoomMatchHost`、`createRoomMatchGuest`、`createRoomSession`に接続。
- `v2/online-lab.html` / `v2/ui/online-shell.css`：横向き800×450、667×375を想定した省タップのロビー。**CPUも対人も`v2/ui/table-renderer.mjs`の同じカード盤面、カードタップ、操作バーを再利用**。別ゲームのiframeや独立した対人レンダラーを作らない。
- `v2/build/build-online-lab.mjs`：`esbuild@0.25.12`をビルド時のみ使用し、JavaScriptとCSSをインライン化。**ランタイムCDN・script src・ネストiframeなしの単一HTML** `dist/v2-room-first-online-lab.html` を生成。初回ビルドの実測63,065文字。旧本番のGoogle Sitesにまだ貼っていない。
- `dev/verify-v2-online-ui.mjs`：Google Sites風 `iframe sandbox="allow-scripts allow-forms"` の中に上のHTMLを`srcdoc`配置。Firebase Auth/Realtime Databaseリクエストを**隔離されたローカルエミュレーターのみ**へ転送。4人の別UID、ホストの部屋作成、ゲスト3人の入室、ゲーム選択/Ready、実際の画面でのカードタップ→4画面同期、他人の手札をrendererへ渡さないこと、iPad向けレイアウトをChromium+WebKitで実行。
- `.github/workflows/room-v2-ui-emulator.yml`：V2オンライン実験用CI。ビルドと両ブラウザの統合テストを毎回実行し、研究用HTML＋スクリーンショットを一時Artifactに保存。学校公開版には自動反映しない。
- `v2/session/room-match-host.mjs`：受理した手の実行後に非公開/公開スナップショット配信やACKが一時失敗した場合、未完了の段階から再開するよう改善（`pending.stage`）。同じ操作を二重適用せず、途中の公開データを再送して次のターンを復旧。
- `tests/v2-room-match-emulator.e2e.mjs`：Firebase実エミュレーターで公開盤面のPUTが1度だけ失敗する故障を注入し、再試行後に旧カード操作が二重処理されないことを検証。

## 検証実績
- **[Actions #40519496034 成功](https://github.com/8mahi8/trump-collection/actions/runs/40519496034)**：63,065文字の単体HTMLビルド、Chromium/WebKitの両方で**4人がGoogle Sites風sandbox内で実カードをタップし、4画面の盤面revisionが同期**。800×450 / 667×375で横スクロールや盤面/手札/アクションの重複・画面外配置なし。
- **[Actions #40520247609 成功](https://github.com/8mahi8/trump-collection/actions/runs/40520247609)**：認証済み4人の実Firebaseエミュレーターでババ抜き1試合完走、ロビーに戻り同じ部屋で七並べ選択、他人の手札/公開データ改ざん拒否、故障注入からの再送テスト成功。
- **[Actions #40516774104 成功](https://github.com/8mahi8/trump-collection/actions/runs/40516774104)**：既存のCPUババ抜き、共有テーブル、旧ゲームの回帰テスト。最新版の再チェックはActionsの最新RUNを確認する。

## 誤解しないこと：学校公開はまだ不可
1. V2友達戦のFirebase匿名認証は**学校iPadで成功するか未確認**。匿名ログイン不可だった旧学校環境の報告がある。今回の成功はローカルFirebase Auth Emulatorで、現行学校ネットワークへの接続保証ではない。
2. ホストのエンジンは現時点ではページのメモリー上のみ保持。ホストが更新/再読み込みすると途中の対局復旧は未実装。**既存スナップショットがあるのに勝手に再配札しないチェック**はGameShellに入れたが、完全復帰ではない。
3. 4画面ブラウザGUIテストは**最初の1手のタップと同期**。全ターン試合完走はFirebase通信レベルの別テストであり、GUIで最終画面を最後まで確認した実績ではない。
4. 神経衰弱2人オンラインは未実装。ゲーム選択欄には表示しても使用不可と明示。七並べ/大富豪は共通Matchエンジンに対応するが、この新オンラインGUIでの完走は未テスト。
5. チャットUIは未接続。旧版にあった最低限の会話機能が戻るまで本番相当の完成扱いにしない。
6. 今の通信はREST GET/PUTを繰り返す。旧版で学校iPadが重かった問題に対する**通信回数・遅延・描画回数の実測評価**が必要。GitHub CIのエミュレーター速度は学校の速度を代表しない。
7. 本番Firebase Rules/DB/Authは一切変更していない。学校Google Sites版、main、旧Drive原本も変更していない。

## 次工程（Phase 2c〜）
- エミュレーターのHTTP要求数、初手・平常時の同期遅延を計測し、バックグラウンド時の不要なポーリング/多重描画を減らす。Google Sites埋め込みの学校ネットワーク条件を最優先。
- ホストリロードで試合が壊れないようにAuthorityのスナップショット復旧と参加者の認証状態の保持を独立したゲートとして実装/テスト。
- ババ抜きの実ブラウザ全ターン完走・ロビー復帰と、七並べ/大富豪の初手・復帰をChromium/WebKitで確認。
- 共通ルーム内のチャットを追加し、2人神経衰弱に通信UIを拡張。
- 最後に学校iPadでHTML直接埋め込み・認証・操作性・通信を実機試験。**main・本番Rules・学校Google Sitesはオーナー承認があるまでは更新しない。**
