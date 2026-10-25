# トランプコレクション｜4人用FirebaseオンラインUI実装・Chromium検証（2026-10-25）

## 今回の成果
- **4人用オンライン研究画面を実装**：[`online/four-seat-remote.html`](../online/four-seat-remote.html)。
- 既存の`createFirebaseRoomHost`／`createFirebaseRoomGuest`＋`createFirebaseRoomStore`を使い、ルーム番号作成・参加・READY・開始・カード操作・再戦をUIから扱う。対応ゲームは**ババ抜き、七並べ、大富豪**。
- ババ抜き：伏せ札の位置をタップして引き、本人だけ引いたカードを確認。七並べ：各スートの場と手札の合法カード選択。大富豪：手札から複数カードを選択し、合法組み合わせのみ出せる。横向きiPadを想定した小画面CSS。
- 通信が止まったときは操作を無効化し、定期的な同期・再読込を試す。**ページ再読み込み後に元の席へ戻る機能はまだ実装していない**。

## Google Sites向け単一HTML
- `dev/build-online-html.mjs`が`games.mjs`、4人対戦エンジン、Firebase認証／通信コントローラ、HTML UIを**1ファイル**へインライン化する。
- 出力：[`dist/trump-collection-online-lab.html`](../dist/trump-collection-online-lab.html)（約54KB）。外部JS/CSS/CDN不要。**ただしオンライン機能にはFirebaseへの通信が必要**。
- GitHub上のソースと単体HTMLの内容が一致することを`tests/online-html-build.test.mjs`で検査。
- **単体HTMLはFirebase接続先未設定の開発用。Firebase Web API key/DB URLを専用環境で設定・権限確認するまで外部端末のオンライン対戦には利用できない。** 本番Firebase、学校Google Sites版、v1.5.5 COM版は未変更。

## 実行した検証
成功した [GitHub Actions](https://github.com/8mahi8/trump-collection/actions/runs/40166268484)（Ubuntu 24.04、Node 22、Java 21、Playwright Chromium）で：
1. **Node 56/56テスト合格、失敗0**。
2. `node dev/build-online-html.mjs`で単体HTMLを生成、JavaScript構文検査成功。
3. Chromium 800×450のUI起動・Firebase未設定時のエラー表示テスト成功。
4. Firebase Local Emulator Suite（認証＋Realtime Database）上で、**4人が匿名認証で入室→READY→対戦→決着→再戦**の3ゲームを完走（ババ抜き28手／七並べ52手／大富豪97手）。
5. Playwright Chromiumの**独立4画面**でも、**ババ抜き・七並べ・大富豪の全3ゲーム**について各席入室→READY→対戦開始→最初の合法カード操作の全画面同期に成功。参加端末順ではなくサーバーが返す`privateView.seat`を使用。

## 制限・次の作業
- Firebase実サービス接続は未実施。Rulesは**隔離したdemo Firebase Emulatorでのみ評価**。既存Firebaseルールを一括上書きしない。
- 4人用UIは現行ゲームメニューv1.5.5へ未統合。神経衰弱は既存のSupabaseオンライン試作として別管理。
- ブラウザの自動試験はChromium。学校iPad Safari、Google Sites直接埋め込みの実動作は未確認。
- **ホストページ更新で状態を失うこと、ゲストの更新で匿名UIDが変わること、離席・ルームTTL・プレゼンス監視**が残る。次は復帰・切断耐性を強化した上で、トランプ専用Firebase実サービス接続環境を用意する。
- 本人は繰り返し試遊するのを好まないので、自動検証を先行し、学校の最終確認のみに絞る。

### 再実行
```bash
node --test tests/*.test.mjs
node dev/build-online-html.mjs
node dev/verify-online-browser.mjs
npx --yes firebase-tools@15.30.1 emulators:exec --project demo-trumpcards --config firebase.emulator.json --only auth,database "node --test tests/firebase-emulator.e2e.mjs && TC_BROWSER_EMULATOR=1 node dev/verify-online-browser.mjs"
```
※`dev/verify-online-browser.mjs`は`playwright`とChromiumのインストールが必要。Actionsで自動準備する。
