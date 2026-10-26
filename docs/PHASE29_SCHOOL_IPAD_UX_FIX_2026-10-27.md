# Phase29｜学校横iPad向けUX修正・実画面レビュー（2026-10-27）

## 方針
前回の [Phase28 人間目線レビュー](PHASE28_HUMAN_UI_REVIEW_2026-10-27.md) を受け、「オンライン対戦中の画面で手札と行動ボタンが見えない」「大富豪設定の開始ボタンが見えない」を優先修正。学校のGoogle Sites公開版・本番Firebase Rules・mainには触れない。

## 修正したソース
- `online/four-seat-remote.html`
  - 試合開始時（`playing`/ `finished`）だけ `body.in-match` を付与。ルーム作成フォーム・長い注意書き・ページ大見出し・準備ボタンを収納し、部屋番号・人数・退出・チャットだけを上部の小さなバーへ残す。
  - 試合画面を高さ100dvhのflex構成へ切り替え、**盤面の残りスペース+手札+確定/パスのフッター**として見える位置に配置。手札が13枚以上の場合は手札行内だけを横スクロール可能にする。縦画面全体のスクロールを不要化。
  - 七並べの4スート13列は縦4行を維持して中央表示。画面幅に応じてコマの幅も縮小。
  - 外側のメニューからゲームを指定された場合、内側のゲームセレクタは隠し、二度選び直さなくてよくする。選択値自体は維持され、部屋参加処理も変わらない。
- `index.html`（COM対戦）：大富豪ルール設定モーダルを縦flexにし、ルールのチェックボックス部分のみスクロール、「スタート」「もどる」はフッターで常に表示。短い画面の余白や文字サイズを調整。
- `dev/verify-configured-sites-emulator.mjs`：Google Sites風の二重iframeで4人が初手をタップ→全員同期した後、**800×450と667×375**の画面をそれぞれ試す。すべての座席で接続フォーム非表示、盤面／手札／行動領域の順序、縦位置、横方向オーバーフローを検査。七並べは盤面全4行がスクロールなしで見えることも確認する。
- `dev/verify-collection-launcher.mjs`：COM大富豪設定のスタートボタンが小さな横画面でも最初から見えることを実ブラウザで検査。重複ゲームセレクタを隠す仕様に合わせて、子画面の読み込み検出を操作ボタンへ変更（初回CIは旧テストの隠しselect待機で止まったが、ゲーム側の異常ではない）。

## 実画面確認の結果
Google Sites相当の外側ヘッダーと内側HTML（Googleドライブへ保存した最新単一HTML）を Chromium 上にロードし、Firebaseには繋がず**ダミーの対戦状態**を注入してスクリーンショットの画像を比較。
- **667×375**：内側の有効高さ323pxで七並べ4行の盤面、13枚の手札（必要な枚数は手札内だけ横スクロール）、**「選択カードを出す」「パス」ボタンがいずれも初期表示範囲内**。内側の縦ページスクロール高さは**323px**で画面と一致。800×450・1024×768でも確認。
- COM大富豪の設定モーダルを667×375で表示し、全設定の下に「スタート」「もどる」が初期表示されることを画像で確認。画面に収まらない場合でも設定項目だけをスクロール。
- 初期メニュー、COMババ抜き、COM七並べ、COM神経衰弱、COM大富豪、友達モードのいずれもオフラインChromium画面表示で例外なし。
- **残課題**：オンライン対戦の友達UIはCOMほど装飾されていない。COM七並べの密集した手札はもう少し磨ける。学校実機Safari・本物Google Sites・実Firebase/Supabaseでの最終確認は必要。

## 結果と公開範囲
- 主要UI修正後のオンライン4人 Google Sites風二重iframe＋初手タップ＋横画面のレイアウト検査は通常Auth版Chromium/WebKitと試遊版3ゲーム×Chromium/WebKitともに**各CI工程合格**：[Actions #40356099055](https://github.com/8mahi8/trump-collection/actions/runs/40356099055)。このrun全体は旧ランチャーテストの隠しセレクタ待機で失敗したため、**`dev/verify-collection-launcher.mjs`で表示中の「部屋を作る」ボタン待機に修正**し、次のrunで再確認する。
- 修正後の総合CI：[Actions #40356906552](https://github.com/8mahi8/trump-collection/actions/runs/40356906552)。**最終結果が成功した場合のみリリース用として合格と呼ぶ**。
- 既存の `dist/trump-collection-online-lab.html`、`dist/trump-collection-integrated-lab.html`、`dist/trump-collection-open-root-trial.html` を再生成し、Nodeで厳密ビルド一致テストを行う。
- Googleドライブへ**元の試遊HTMLを上書きせず**、改善版 `トランプコレクション_学校試遊版_UI改善_20261027.html` および同名 `.txt` を別途保存。
  - HTML: https://drive.google.com/file/d/1NphKwaa1ldudQBBHHdjHEc5tictPpluF/view?usp=drivesdk
  - TXT: https://drive.google.com/file/d/1cnAS3iYanELZibR-uGA43fnz5Iz6claA/view?usp=drivesdk
- Firebaseの現行root許可ルールは**2026-11-08 00:00 JST**失効予定。ユーザーの決定どおり現時点では変更していない。試遊版ではRTDBへ接続する第三者にもルームや手札が読み書き可能で、個人情報は入れないこと。
