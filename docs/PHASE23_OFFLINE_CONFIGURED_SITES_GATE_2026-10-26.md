# Phase23｜設定を入れたGoogle Sites単一HTMLの安全な生成と4台実験

**対象：2026-10-26／トランプコレクションの開発ブランチのみ。実Firebase・Supabase本番、既存校内Google Sites・mainには変更を加えていない。**

## 背景
`dist/trump-collection-integrated-lab.html`は4ゲーム入りの単一HTMLとして完成していたが、Firebase Web設定を意図的に未投入にしている。そのまま学校のGoogle Sitesへ貼っても、4人オンラインの3種（ババ抜き・七並べ・大富豪）はルームを作れない。

Google Sitesの二重iframeは親子で`contentDocument`参照が使えない場合があり、各子ゲームの`srcdoc`に初期ゲームと接続設定を渡す必要がある。親UIの`configureFriendsGame`には仕組みがあるが、設定込みの単一HTMLを間違いなく作るためのオフライン道具が必要だった。

## 新しい道具
**`dev/build-configured-sites.mjs`** を開発。実サーバーへのログインや通信・デプロイ機能は一切ない。ローカルで利用する公開Web設定とレビュー済みFirebase Rulesファイルを読み、形式の事前検査後にGoogle Sitesへ貼り付け可能な単一HTMLを生成する。

- 入力Web設定は `projectId`／`apiKey`／`databaseURL`のみ。共有Firebase`mygame-df915`または形式が一致する専用Firebaseのみ許可。**Web APIキーは公開されるタイプの設定値であり、管理者秘密鍵を絶対に含めない。**
- レビュー用のRules JSONはRootの`.read`／`.write`が両方`false`であること。Rootにワイルドカードや`.validate`があれば停止。
- `trumpRoomsV1`配下の全Rulesが、このリポジトリの本人別手札＋チャット権限用 `firebase/trump-rooms.rules.json` と厳密に一致すること。共有Firebaseの場合は既存4領域（`rooms`、`rooms2v2`、`shokokuRooms1v1`、`lemonClashRoomsV1`）が候補に残っていること。
- **今のようにRootが広く公開のままだと必ず拒否する。** この検証は「入力されたファイルの静的な検査」であり、**それと同じRulesが実Firebaseに配備済みと証明するものではない**。
- `dist/local-configured-*.html`という別名のファイルに**新規作成のみ**（上書き不可）。`.gitignore`でGitHub誤コミットを避ける。基準の`dist/trump-collection-integrated-lab.html`は常にFirebase接続先未設定のまま保存し続ける。

### 本番Rules承認後に使うローカル操作例
```bash
node dev/build-configured-sites.mjs \
  --config firebase/local-web-config.json \
  --reviewed-rules firebase/local-reviewed.rules.json \
  --out dist/local-configured-trump.html
```
事前にローカルJSONを準備する。**本番にデプロイした最新Rulesの完全一致を、人間がFirebase Consoleで確認してから使う**（本ツールは本番ルールを自動取得しない）。RulesのコピーをGitHubへ公開しない。

Google Sitesでは、できあがった**HTMLのソース全文**を「埋め込みコード」へ貼り、GitHub Pagesへのリンクiframeとはしない。貼り付け実行は本人が担当し、学校公開版の勝手な差し替えをしない。

## 完了／未完了
- `tests/configured-sites-package.test.mjs`：公開Web設定の形式、旧領域の保持、Root公開やprivate手札／チャットの欠落時の拒否、専用Firebaseの許可をNode単体テスト。
- `dev/verify-configured-sites-emulator.mjs`：**生成した「設定付き」統合HTMLを実際にGoogle Sites風二重sandboxで開き、4独立ページのFirebase4人入室→READY→開始→チャット→退出**を試す。Google API/RTDB宛の通信をPlaywrightで遮断・ローカルAuth/RTDB Emulatorへ転送するため、**本番プロジェクトに触らない**。
- Chromium／WebKitで同じ試験。結果はGitHub Actionsで検証し、ここへCIのURLを追記する。
- **未完了**：本番RTDBの最新版Rulesの管理者確認、旧ゲームの実利用パス網羅、Anonymous Auth確認、本人の本番変更許可、学校iPad Safari＋Google Sites実機での対戦。

通信方式の統一・大規模設計変更・プレイヤーアカウント管理は行わない。公開までの最短経路を優先する。
