# トランプV2｜Google Sites直接貼付けの学校試遊前チェック（2026-10-28）

## 対象
身内専用・学校iPad Safari。共通5桁ルームからババ抜き／七並べ／大富豪／神経衰弱を遊ぶ。人数不足はCPU補充。Firebase匿名Authは使わない。ホスト再読み込みからの対戦復帰も作らない。

## 今回作成したオフラインビルド
- `v2/build/build-online-lab.mjs` に、明示した Firebase Realtime Database URL をJavaScript初期化より先にHTMLへ書き込む機能を追加。Safari 15対応・CSS/JSすべて単一ファイル・CDN/入れ子iframeなし。
- 公開される接続先URLは秘密キーではない。**Authトークン、Web APIキー、Firebase管理者資格情報は一切不要・埋め込まない**。
- 接続先がHTTPSのFirebase RTDBドメイン以外、クエリ・パス・ポート・ユーザー名付きであればビルドを拒否。既存の生成物への上書きも禁止。
- `dev/verify-v2-configured-sites-build.mjs` はURL拒否・外部スクリプトなし・設定の注入順を**一切通信せず**検査。
- `.github/workflows/room-v2-ui-emulator.yml` で無設定のエミュレーター試遊HTMLと別に、**既に学校ゲームで使ったことがあるRTDBアドレス**を組み込んだオフライン候補 `dist/v2-room-first-sites-school-trial.html` を作成し、GitHub ActionsのプレビューArtifactに保管する。生成で実Firebaseへ一切通信しない。

## 将来の学校試遊用手順（本人が実機試験すると決めた場合）
1. 最新のGitHub Actions `V2 Room-first UI Safari and Chromium Emulator` が成功していることを確認。Artifacts のプレビューから `v2-room-first-sites-school-trial.html` を取得。**通常の無設定オンラインラボとは別ファイル**。
2. Google Sitesの既存公開ページは変えず、別の非公開下書きで「挿入 → 埋め込む → 埋め込みコード」に単体HTMLの全文を貼る。JavaScript/CSSはビルド時点で`script`/`style`タグに包含済み。Google Sitesの公式手順：https://support.google.com/sites/answer/90569?hl=ja
3. 埋込領域をiPad横画面に合わせて十分広く確保。ホーム→CPU戦で最初の描画と操作を確認。続いてホスト＋友達1人で5桁ルーム、Ready、神経衰弱/大富豪のCPU補充を試す。
4. この候補が**そのまま学校で動くことは未確認**。失敗したら、画面のエラーメッセージ・ホスト/ゲストどちらか・何人・使用ゲームと操作だけ伝えれば十分。追跡ログ収集やアカウント連携は必要ない。

## 重要な制限と公開しないもの
- **このHTMLは本番の学校Google Sitesに自動掲載されていない**。GitHub上の開発Draft PRの成果物のみ。main・既存公開版・Driveは無変更。
- 旧Google Sites向けFirebaseとして既存資料に記載された `https://mygame-df915-default-rtdb.firebaseio.com` を使用。**これは接続先の文字列が既知というだけであり、現在のルールを読み取った・RTDBへ接続できたという意味ではない**。
- ユーザーが最後に確認した旧共有Firebaseルールは、2026年11月8日までの時限的な公開ルート許可だった。今回の候補が11月8日以降も動くとは保証できない。期限変更やRules上書きを無断で行わない。
- 認証なし通信では第三者の入室・手札のサーバー側アクセス制限を厳密に保証できない。個人情報を入れず、身内だけの試遊用として扱う。
- Google Sites埋め込みsandbox＋ローカルFirebase EmulatorでChromium/WebKitテストは成功しているが、**学校iPadでの実際の公開済みGoogle Sites接続・通信速度・本番RTDB接続はまだ未検証**。
- Firebase Rulesの全面デプロイは旧ゲームを壊す可能性があるため、本人の指示前に変更しない。
