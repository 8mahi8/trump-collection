# トランプコレクション｜Phase 9：4ゲーム共通のCOM／友達対戦メニュー（2026-10-25）

## 結論
**既存4ゲームを、1つの入口でゲーム選択→「COMと遊ぶ」または「友達と遊ぶ」を選ぶ開発版へ統合。** 旧COM版・旧Firebase4人版・Supabase神経衰弱版は、コードを無理に混ぜず独立iframeの`srcdoc`で起動する。画面／ゲーム状態／通信処理の衝突を避ける。学校のGoogle Sites版へは公開していない。

## 実装ファイル
- `online/collection-launcher.template.html`：横向きタッチに対応した4ゲーム共通メニュー。4つのゲーム、2つの遊び方、戻るボタン。
- `dev/build-collection-lab.mjs`：元の`index.html`＋`games.mjs`をCOMモード用にインライン化。神経衰弱の既存オンライン試作は`online/memory-authority.mjs`＋`online/realtime-wire.mjs`をまとめる。残り3ゲームのFirebase4人版は`dev/build-online-html.mjs`の成果を利用。**外部JS/CSS/CDNなしのHTML単体**を生成する。
- 生成される開発成果物：`dist/trump-collection-integrated-lab.html`（実際のCIで約182,884文字）。ソースリポジトリの既存`dist/trump-collection.html`は変更していない。
- `tests/collection-launcher.test.mjs`：4ゲーム×COM/友達、ソースの収録、未設定Firebase本番への安全なガード等を検証。
- `dev/verify-collection-launcher.mjs`：Chromium 800×450画面でCOM4ゲームすべての起動、神経衰弱と大富豪の設定ダイアログ経由での開始、友達対戦4ゲームの入口を操作して検証。
- `.github/workflows/firebase-emulator-ci.yml`：共通メニューのビルド・8モードのブラウザ確認を追加。テスト用単一HTMLを7日間GitHub Actionsのartifactとして保存する。

## どのゲームが実際に接続できるか
| ゲーム | COM | 友達対戦 |
|---|---|---|
| ババ抜き | 既存v1.5.5をインライン化して起動 | Firebase4人開発版。エミュレーター合格／**実Firebase本番は未接続** |
| 七並べ | 同上 | 同上 |
| 神経衰弱 | 既存COM難易度選択あり | 既存の2人Supabase Realtime公開Broadcast試作。本人のPC＋スマホ試遊成功済み／学校未確認。5桁は認証ではない |
| 大富豪 | 既存COMローカルルール選択あり | Firebase4人開発版。エミュレーター合格／本番未接続 |

Firebase用メニューでは実接続先が未設定の場合にそのことを画面で説明し、**部屋作成できない**。本番接続に必要なFirebase Anonymous Auth/RTDB Rulesを勝手に既存プロジェクトへ適用しない。

## CI検証（実行済み）
**[成功したGitHub Actions #40175410131](https://github.com/8mahi8/trump-collection/actions/runs/40175410131)**

- Node **67/67件合格、失敗0**
- 統合HTML生成：182,884文字。GitHub Actions artifact `trump-collection-integrated-lab`に保存（7日で期限切れ）。
- Chromium: **COM4ゲームの起動＋設定／友達対戦4ゲームの入口**＝計8経路すべて合格。未設定Firebaseでは正常にガード表示。
- 別系統の実Firebase Local Emulator E2E：ババ抜き28手・七並べ52手・大富豪97手で4人対戦完走、再戦／退出と権限テスト成功。Chromium4クライアントで最初の手の全画面同期、ホスト心拍遮断→復帰、ホスト／友達退出→全員ロビー戻りまで合格。

## 誤解しないこと／未対応
- **COMと友達対戦の共通UI自体は動くが、3ゲームのFirebase本番はまだ未設定。** ブラウザテストは「メニューから開けること」であり、本番ネット越しの4人対戦を検証したものではない。
- 神経衰弱は別のSupabase公開Broadcast試作なので、Firebaseで認証付きprivate手札を扱う3ゲームと同等のセキュリティ保証はない。厳格な対人競技や不特定多数への公開用ではない。
- 学校iPad SafariとGoogle Sites埋込は未検証。現在のActionsはChromiumエミュレーターテスト。
- ユーザーとの確定方針通り、**再読み込みで前の試合に復帰する機能は作らない**。一時通信断のheartbeat復旧と明示的な退出・新ルーム作成を優先。
- **既存GitHub Pages main v1.4.0、開発COM index v1.5.5、学校Google Sites版は一切変更していない。**

## 次の開発
1. Firebase本番は他ゲームのDB／Rulesから切り離せる接続先を選び、無料枠とAnonymous Auth/RTDB権限をエミュレーターと比較検証する。別ゲームの本番Rules全体を上書きしない。
2. 友達対戦4ゲームの通信方式やUI共通性を少しずつ改善。特に神経衰弱のSupabase公開チャンネルは正式版として扱わない。
3. 完成度が高くなった段階で学校Safari実機の最終確認を1回にまとめる。普段はAI自身が自動テストを継続。
4. 新しい定番カードゲームを追加できるよう、ゲームを追加してもメニューとCOM／オンラインを流用できる構成を維持。

再実行：`node --test tests/*.test.mjs`、`node dev/build-collection-lab.mjs`、`node dev/verify-collection-launcher.mjs`（後者はPlaywright Chromium必要）。
