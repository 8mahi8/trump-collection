# Phase22｜神経衰弱の実2画面テスト＋4ゲーム統合HTMLをGitHubに保存

日付：2026-10-26。作業は `dev/quality-and-ui-v1-5-20261024` のみ。`main`、本番Firebase／Supabase設定、Google Sitesの学校公開版は変更しない。

## 目的
- チャット／途中退出の改修後に、2人の神経衰弱が**別々の画面から、同じ部屋で実際にゲームを始められるか**を調べる。
- 完成した4ゲームの現行開発版HTMLがCI内だけの一時生成物では、次回作業で古い版と取り違えやすい。**Google Sites「埋め込みコード」に貼れる単一HTMLを開発ブランチに保存**し、ビルドとの一致を継続チェックする。

## 実装したブラウザテスト
`dev/verify-memory-peers.mjs`を追加。外側を `sandbox="allow-scripts allow-forms"` 付きのGoogle Sites風iframe、その内側でゲームを `srcdoc` iframe起動する。

- **完全に独立したブラウザページ2枚**で「神経衰弱→友達と遊ぶ」を起動
- ホストが5桁のルームを作成、ゲストが番号を入力して参加。双方の準備完了後にホストが開始
- 24枚の盤面が両端末に表示され、ホストが1枚めくるとゲスト側のカードも表向きになる
- ホストが送信した、HTML記法を含むチャット文字列がゲストへ届き、**HTMLとして実行されずそのまま表示される**
- ホストが統合メニューへ戻るとゲストも終了通知を受けて対戦画面から抜ける

**通信はテスト内のPlaywright WebSocket relayを使用。** 同じroom topicの相手だけへPhoenix/Supabase風のBroadcastを転送。`supabase.co`実サービスへは接続しない。Chromium／WebKitの両エンジンで動作させる。

## 配布候補をGitHubに保存
- `dist/trump-collection-integrated-lab.html`（約201KB）を開発ブランチに**新規作成**。COM4種類、Firebase4人×3種類、Supabase神経衰弱、チャット、退出を含む1ファイル。
- `dev/build-collection-lab.mjs`から作られるHTMLの完全一致を、`tests/collection-launcher.test.mjs`で検査する。次のコード更新で保存版が古くなったらNodeテストが失敗する。
- **本番Firebase設定はあえて未設定**。3つの4人対戦は、本番Rulesが権限分離されていない状態で実DBへ接続すると手札が漏れるおそれがあるため、無断で接続・公開しない。神経衰弱は以前から身内向け公開Broadcast試作。
- Google Sitesの貼り付け上限や学校実機でのパフォーマンス、公開版差し替えは**まだ検証していない**。このファイルが作れたことをもって「学校公開済み」としない。

## 最終CI実績

**[GitHub Actions #40205548624：全工程成功](https://github.com/8mahi8/trump-collection/actions/runs/40205548624)**

- Node **98/98件合格**。保存済みの`dist/trump-collection-integrated-lab.html`と最新ビルドが**完全一致**する追加テストも通過。
- **Google Sites風の神経衰弱2端末テスト**はChromium・WebKitの両方で成功（同ルーム入室→双方READY→開始→カード同期→HTML安全表示のチャット→終了通知）。
- Firebase Auth/RTDB Emulatorのババ抜き・七並べ・大富豪の**4端末×3ゲーム**の参加／初手同期／退出とホスト通信復帰は両エンジンで成功。チャットの本人／部外者権限検査も従来どおり通過。
- 既存共有Rules Emulator、4ルート局所化Rules Emulator、12月8日期限延長の仮案のRules Emulatorを全て成功。
- これはGitHub Actionsでのテスト成果であり、本番Firebase・Supabase、学校Google Sites実体やiPad実機の検証ではない。

## 開発の次のゲート
1. 旧4ゲームの実ルーム領域（現在コードで確認した4パス以外が無いか）をチェック。
2. 既存のルート全体に対する期限付きFirebase Rules（2026-11-08）について、バックアップ／本人承認のうえで本番変更。現在は移行案のエミュレーター合格のみ。
3. 匿名Firebase AuthとRTDBに実接続した後、実学校iPad Safari×複数端末で4ゲームとチャットを試遊。そこで発覚した問題だけ優先修正。

本人の別ゲーム（BRAWL、小国戦線III、LEMON CLASH）はFirebaseで学校iPadの対戦実績がある。ただし本作のFirebase実装が学校iPadで成功したという意味ではない。
