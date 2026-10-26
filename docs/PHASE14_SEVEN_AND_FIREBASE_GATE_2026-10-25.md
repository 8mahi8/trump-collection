# Phase 14｜七並べの誤タップ対策・共有Firebaseゲート（2026-10-25）

## 今回確認した範囲
- 正本: `docs/HANDOFF_CURRENT_2026-10-25.md`、`HANDOFF.md`、PR #1、主要実装。
- 公開版: `main/index.html` v1.4.0 は変更しない。学校Google Sites貼付けコード、Firebase本番データ・Rules・Authも変更しない。
- 開発版: `dev/quality-and-ui-v1-5-20261024` のみ変更。既存Firebase共有候補は `mygame-df915`、専用パスは `/trumpRoomsV1`。
- Firebase Emulatorで3種類（ババ抜き・七並べ・大富豪）の4人戦完走実績と、神経衰弱Supabase試作の実端末試遊実績は以前のCI／引き継ぎに基づく。今回の本番検証ではない。

## 変更点
1. `online/four-seat-remote.html`: 七並べの合法カードをタップしても即送信せず、選択状態を表示して「選択カードを出す」で確定。パス時は選択を解除。COM版ですでに合意した「選択→確定」にそろえる。
2. `dev/verify-online-browser.mjs`: Firebase Emulatorの4人ブラウザ試験で、七並べの選択のみではrevisionが増えず、確定後に進むことを確認する。
3. `dist/trump-collection-online-lab.html`: `dev/build-online-html.mjs` と等価の処理で再生成してソースと同期。
4. `tests/firebase-shared-rules-merge.test.mjs`: 2026-10-22の過去記録に現れた期限付きルート公開Rulesの例も安全な共有候補として拒否する回帰試験を追加。

## Firebase本番ゲート（未解決）
- 実際に現在デプロイ済みの `mygame-df915` Realtime Database Security Rules全文は未取得。GitHubにあるサンプル、エミュレーター結果、Web APIキー、DB URLからは現Rulesを確定できない。
- 過去の別ゲームチャットにあった2026-10-22頃のスクリーンショット記録: `{"rules":{".read":"now < 1794063600000",".write":"now < 1794063600000"}}`。期限は2026-11-08 00:00 JST。**当時の対象プロジェクト／現在の適用状況は未確認**。
- この種のルート許可が現在有効な場合、子パスに限定した `private/$uid` の拒否ルールではアクセスを覆せない。トランプの非公開手札を安全に配置できない。
- Firebaseプラグインは登録されているが、この開発環境では管理者権限によるRules読み取り操作が利用できない。Rulesの取得・バックアップ・本番変更は実施していない。

## 次のゲート
1. オーナーがFirebase Consoleの **mygame-df915 → Realtime Database → Rules** で、現在のルール全文を確認・共有する（APIキー・管理者資格情報の共有は不要）。
2. 受け取った実Rulesをオフラインの `dev/merge-existing-firebase-rules.mjs` に渡す。親許可／ワイルドカードを拒否し、既存ゲームの権限を維持する差分だけ作る。
3. Auth/RTDB Emulatorで既存ゲーム権限・トランプの手札分離・4人対戦を検証し、既存ゲームへの影響をレビューする。
4. 安全確認とオーナーの承認までは、公開HTMLへの既存Firebase設定埋込み、現Rulesの本番デプロイ、既存ゲームの更新をしない。

## 検証
- 過去の成功記録: [Actions #40183559945](https://github.com/8mahi8/trump-collection/actions/runs/40183559945)（Node 88/88）。
- 今回の最新CI: [Actions #40196219631](https://github.com/8mahi8/trump-collection/actions/runs/40196219631) **成功**。Node **89/89**、Chromium COM/友達8入口、Firebase4画面のババ抜き・七並べ・大富豪初手同期、ホスト通信断・復旧、共有Rules Emulatorすべて合格。
- 全ブラウザ試験はChromium。学校iPad/Safari実機、実Firebaseは未検証。
