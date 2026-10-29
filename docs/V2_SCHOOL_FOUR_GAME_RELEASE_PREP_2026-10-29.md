# トランプコレクション V2｜学校試遊版（4ゲーム）公開準備

更新日：2026-10-29 ｜ 開発専用の Draft PR #2

## 位置付け

これは学校の友達だけで使う **Google Sites 試遊用** の準備物。既存の公開 Google Sites/main/本番 Firebase Rules・DB は更新しない。実際に学校へ貼り付けるかどうかの判断は、ファイルを試してから行う。

## 収録するゲーム

- **大富豪**
- **ババ抜き**
- **七並べ**
- **神経衰弱**

開発検証で増やした第5作 **「ハイカード（試験）」は学校版に表示しない**。開発版の5作はそのまま残し、ゲーム定義の `schoolReady:true` がある4本だけを公開対象にする。新作は単に `onlineReady:true` にしただけで学校に出ない。

## 試遊用単一HTMLの作り方

`v2/build/build-online-lab.mjs` のビルドは、CSS・JavaScriptをインライン化した単一HTMLを生成する。`--school` オプションを指定したときのみ4本表示に切り替わる。CSS/JS/CDNの別ファイルは不要。Firebaseアカウントのサインインも使わず、従来のREST型部屋番号で接続する。

```sh
npm install --no-save esbuild@0.25.12
node v2/build/build-online-lab.mjs \
  --database-url https://mygame-df915-default-rtdb.firebaseio.com \
  --out dist/v2-room-first-sites-school-trial.html \
  --school
```

**URLは既存プロジェクトの公開Firebase RTDB接続先であり、管理者トークンや秘密鍵ではない。** ビルド自体はローカルの文字列埋め込みのみで、オンライン送受信・Rules更新・データ書き込みは発生しない。上記のFirebase URLに本物のiPadから接続できるかは未確認。

## 開発担当の品質ゲート

- [x] 既存4ゲームのルール・CPU/2人対戦・チャット/観戦・複数回のゲーム変更がChromium/WebKitのFirebase emulator上で完走（第5作も含む開発版最終 #40837166163）。
- [x] 学校公開用の4ゲーム限定ビルドを追加し、開発版の第5作は残したまま表示対象を切替。
- [x] `schoolReady` の明示フラグと不完全な公開指定の拒否。
- [x] 学校版単一HTMLのオフライン検証とChromium/WebKit iframe実画面確認が合格。
- [x] 学校版HTMLのChromium/WebKit実スクリーンショットを取得（画面目視確認）。
- [ ] 友達2人分の実iPad Safari + Google Sitesで、入室→対戦開始→1ゲーム完走を試す。
- [ ] 本番Firebase Rules/接続設定に期限がないか、また学校ネットワークで通信できるかを実機で確認。

## 実機で確認すること

1. 学校のGoogle Sitesの**非公開または限定ページ**で「挿入→埋め込む→埋め込みコード」にこのHTML全体を貼り付ける。画面は広く設定し、可能なら**ページ→全ページ埋め込み**も検討。Google Sites公式ヘルプ：https://support.google.com/sites/answer/90569?hl=ja 。GitHub Pagesを学校で使う必要はない。
2. iPad A：新しいルーム作成。iPad B：同じ5桁番号で参加。
3. ロビーには4ゲームのみ表示され、試験ゲームが無いことを確認。
4. 大富豪を選び双方で「準備完了」、CPU2人補充の状態で最後まで遊ぶ。戻ってババ抜き等に切替。
5. チャット、手札の並べ替え、神経衰弱の相手選択と観戦、表示の見切れやカード選択の重さもチェック。
6. 失敗したらブラウザ/端末/ゲーム/タイミングとエラー表示を記録。オンラインルームはホストが閉じると終了する設計で、リロード後の同一ルーム復元は保証しない。

## 公開しない・変更しないもの

- 第5作「ハイカード（試験）」、開発版専用のテスト機構。
- GitHub main、Google Sites現行ページ、本番Firebase Rules/DB、Google Drive。
- ユーザー自身の実機確認を経ていない段階では「学校で動作確認済み」と宣言しない。

## 最終CI確認結果（2026-10-29）

- **[オンライン統合 #40842083566](https://github.com/8mahi8/trump-collection/actions/runs/40842083566)：SUCCESS**。学内用4ゲーム限定HTMLを生成。Google Sites型sandboxで、**Chromium / WebKit の両方**が4本だけ表示・2人入室・神経衰弱開始を確認（`SCHOOL_FOUR_GAME_GOOGLE_SITES_EMBED_PASS`）。**Firebase全要求はローカル emulator に転送**、本番DBへの実送受信は0、Firebase Authentication呼出しも0。
- 既存4ゲームのフル対戦・2人＋CPU補充・4人ロビー観戦・チャット・iPad幅の表示テストは同じrunでChromium/WebKitとも成功。開発専用の第5ゲームも開発版では完走。
- ビルドした学校版HTMLは `v2-room-first-sites-school-trial.html`（130,196 bytes）。CSS/JavaScript内包、Firebase RTDB URLは既知の公開接続先。管理キーは含まない。
- ブラウザCIで合格したことと、**学校端末から実Firebaseへアクセスできることは別**。学校内ネットワーク/iPadの現物試遊はまだ必要。

## CI成果物

[GitHub V2 Room-first UI Emulator workflow](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-ui-emulator.yml) で `dist/v2-room-first-sites-school-trial.html` を生成する。CI artifact内のHTMLが配布候補。実験用 `dist/v2-room-first-online-lab.html` とは**別ファイル**として扱う。

実際の試遊版ファイルを配布する前に、対象のCI runが全テストをPASSしたか確認する。
