# Phase26｜学校向け・現行Firebase公開ルールの友達試遊候補

2026-10-26。身内向けのGoogle Sites「コードを埋め込む」での試遊を最優先。**本番Firebase Rules／DB設定、学校で使用中のGoogle Sites、mainは一切変更していない。**

## 現行版と試遊候補の違い
- 通常版 `dist/trump-collection-integrated-lab.html`：Firebase匿名Auth＋適切なRulesが必要な構成。現在の共有本番Rulesのまま動くとは限らない。今回も未設定の安全な開発版として保つ。
- 試遊候補 `dist/trump-collection-open-root-trial.html`：学校で実績のある既存Realtime Database `mygame-df915`へ接続する選択式の「試遊専用モード」。匿名Auth不要、使い捨ての端末内UIDを発行、既存の公開ルールの期限内でのみ読み書きできる。**Rulesは一切変更しない**。
- 試遊版HTMLの生成は `dev/build-configured-sites.mjs` の `buildOpenRootTrialSitesHtml({databaseURL,acknowledgePublicData:true})`。明示的な認識フラグなし、既知DB以外は拒否。誰でも読書きできるリスクをUIに表示する。
- `tests/open-root-trial.test.mjs` で試遊版ファイルと最新版ビルドの完全一致、固定プロジェクト・認証なし、ランダムUID、危険な設定の拒否を確認する。
- `firebase.open-trial-emulator.json`は本人報告の公開ルールを模した**合成フィクスチャ**のみ。 `dev/verify-configured-sites-emulator.mjs`で `TC_OPEN_ROOT_TRIAL=1`としてChromium＋WebKitのGoogle Sites風2重iframeに4人が入る試験を実施。ホスト入室→ゲスト3人参加→4人準備→開始→チャット→退出。Firebase Authへ接続しない。
- これまでのCOM4ゲーム、Firebaseの通常認証版3ゲーム、Supabase神経衰弱2人戦のCIを維持する。

## 本人が学校で試す時の操作
1. [GitHub上の試遊候補HTML](../dist/trump-collection-open-root-trial.html)の**コード全文**を取得する。GitHub Pagesやraw URLをiframeとして埋め込むのではない。
2. Google Sitesで「埋め込む」→「コードを埋め込む」を選び、HTML/CSS/JavaScriptの**全文を貼る**。既存の学校公開版をいきなり置き換えず、別の試験ページで確認する。
3. 友達全員が同じ試験ページを開く。「友達と遊ぶ」→ホストが5桁の部屋を作成→他3人が番号を入力→4人で準備→開始。チャットと「ゲーム一覧へ戻る」も確認する。
4. 神経衰弱は既存Supabase方式の2人対戦であり、4人ルームとは異なる。

## 重要な制限
- **公開ルールのもとでは、URLやルーム番号を知る第三者に限らず、Firebaseデータベースへアクセス可能な人が手札やチャットを読んだり改ざんしたりできる。** ゲームUI上で隠していてもデータ自体は秘密ではない。個人情報・秘密情報を入力しない。身内向けの短期試遊に限る。
- ルールがユーザー報告のままなら、**2026-11-08 00:00 JSTで読み書きが止まる**。期限延長は別途対応し、放置しない。
- 本番DBへはCIから接続していない。Google Sitesの実物での埋め込み上限／学校iPad Safari性能／ネットワーク制限は未検証。現実の試遊で問題が出たらその範囲だけ修正する。
- GitHubに置く試遊HTMLに含まれるDB URLはFirebase既知のWeb接続先であり管理者秘密鍵ではない。ただし公開ルールなので**誰でも使えるデータベースとなっている点には注意**。
- この試遊は本番向けのセキュリティ強化や長期運用を意味しない。

## 検証ステータス
- 最後まで成功した通常版総合CI：[Actions #40208972686](https://github.com/8mahi8/trump-collection/actions/runs/40208972686)（Node103/103、Chrome/WebKit・Firebase Emulators、既存ゲーム回帰）。
- 試遊モード専用のChromium＋WebKit 4人通信試験：[Actions #40210391171](https://github.com/8mahi8/trump-collection/actions/runs/40210391171)（両エンジンの試遊工程成功。各runは最終ステータスを確認して記入）。
