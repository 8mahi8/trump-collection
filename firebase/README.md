# トランプコレクション｜Firebase Auth + RTDB 開発・検証記録

**2026-10-25 更新：Firebase Local Emulator Suite の実際のAuth/RTDB Rulesを使う統合テストに成功。Firebase本番接続・学校Safari・Google Sitesは未実施。**

## 現在の成果
- [実エミュレーター成功ワークフロー](https://github.com/8mahi8/trump-collection/actions/runs/40158460489)：Node自動テスト **52/52**、Firebase Auth+RTDB Emulatorの4人オンライン構成で**ババ抜き28手、七並べ52手、大富豪97手**を完走、再戦成功。実エミュレーターテスト 1/1 合格。
- [GitHub Actionsの設定](../.github/workflows/firebase-emulator-ci.yml)。開発ブランチへの関連コード変更で自動実行。demoプロジェクト `demo-trumpcards` を使い、**Google Cloudの実プロジェクトや本番DBには接続しない**。
- `firebase.emulator.json`: 認証エミュレーター `127.0.0.1:9099`、Realtime Database エミュレーター `127.0.0.1:9000`。
- `tests/firebase-emulator.e2e.mjs`: 本物のエミュレーター上で匿名ユーザー5名を作成し、他人のprivate/commandキュー読み取り拒否、入室前の公開状態拒否、4人参加・READY・開始・プレイ・順位一致・再戦を確認。

## 実装ファイル
- `online/firebase-room-store.mjs`：外部SDK/CDNに依存しないFirebase Anonymous Auth + RTDB REST。トークン更新、`if-match: null_etag`による部屋の競合防止、入室申請、公開／本人用手札／コマンド／ACKの分離。
- `online/firebase-room-controller.mjs`：ホストが手番・合法手を検証して、各自のprivateスナップショットを書いてからpublicを更新。ゲストは両方のrevision一致まで操作禁止。配信エラーの再試行、重複コマンドの再ACK、入室要求の権限エラーの無条件握りつぶし防止。
- `firebase/trump-rooms.rules.json`：トランプ専用のAuth/RTDBルール。ルーム直下の公開読み取りは行わない。
- `online/four-seat-authority.mjs`：ババ抜き、七並べ、大富豪の4人対戦共通ロビーとゲーム処理。
- `tests/firebase-room-store.test.mjs`、`tests/firebase-room-controller.test.mjs`：モックによる単体／通信例外テスト。実エミュレーターテストと補完関係にある。

## 実エミュレーターで発覚し修正した問題
1. **条件付き操作の権限**：ゲストによる`if-match`書き込みが拒否された。自分の`commands/<uid>`キューのみ読む権限を追加し、他人のキューは引き続き拒否。実エミュレーターで確かめた。
2. **席順の思い込み**：入室を処理するUIDの並びと、テスト端末作成順が一致しないことがある。参加端末の正式席は、ホストが送った`privateView.seat`を正本とする。
3. **古いrevision**：READYやSTARTはその直前の公開／個人スナップショットを照合し、操作前に最新状態へ更新する。
4. **空手札の保存**：Firebaseは空配列を省略する場合があるため、privateのルールでは`hand`を必須キーにしない。表示側は存在しない場合に空手札として扱う必要がある。

## データ構造
```text
trumpRoomsV1/<5桁>/
  meta                 { hostUid, game, protocol }
  joinRequests/<uid>   true         ← uid本人が参加申請、hostのみ一覧取得
  seats/<uid>          true         ← hostが承認、本人が席を確認
  public               publicView   ← 承認された全員のみ閲覧
  private/<uid>        privateView  ← uid本人だけ閲覧、hostのみ配信
  commands/<uid>/<id>  操作命令     ← uid本人が作成・自分のキューのみ閲覧、hostは全件閲覧と削除
  receipts/<uid>/<id>  結果ACK      ← uid本人が閲覧、hostが配信
```
- **5桁の部屋番号は認証ではない。** 匿名Firebase `auth.uid` で本人と席を結びつける。個人用手札は公開パスに入れない。
- 厳密な競技不正対策ではなく**身内向けホスト権威方式**。ホスト端末のルールエンジンは全手札を見る。
- Firebase Realtime Databaseのルート、上位階層、他ゲームのパスを公開にしない。親の`.read: true`は子で取り消せない。

## 再実行
```bash
node --test tests/*.test.mjs
npx --yes firebase-tools@15.30.1 emulators:exec --project demo-trumpcards --config firebase.emulator.json --only auth,database "node --test tests/firebase-emulator.e2e.mjs"
```
CIにJava 21、Node 22を導入済み。ローカルのこの作業環境はCLIが入っていないため、実エミュレーターは**GitHub Actions上で稼働・合格確認**している。

## 注意：このRulesファイルを既存Firebaseへ適用しない
`trump-rooms.rules.json` はrootの`.read:false/.write:false`を含む**単体ファイル**。小国戦線・BRAWLなど既存ゲームが使うDBに丸ごと反映すると、現在のRulesを**上書きして壊すおそれ**がある。

本番では、独立Firebaseプロジェクト／DBを使うか、現在のRulesを安全に保ったままトランプ専用の子パスだけを合成して必要なテストをすること。他ゲームの本番データ、Rulesは変更していない。

## まだ終わっていないこと
- 実Firebase本番プロジェクトのURL/API key設定・接続。実エミュレーターの合格は本番接続の保証ではない。
- 切断・ページ再読込時のホスト権威状態の復元、ゲスト再参加、プレゼンス監視、部屋のTTL／掃除。
- 無音の横向き学校iPad SafariとGoogle Sites直接HTML埋め込みでのブラウザ検証。
- 通常v1.5.5の4ゲームGUIへの統合（COMモードは保護）。

参考にした他リポジトリは`8mahi8/shokoku-sensen/online-net.js`、`8mahi8/brawl-bot-playtest/network/FRIENDS_TRANSPORT_DECISIONS.md`、`8mahi8/brawl-bot-playtest/firebase.draft-staging-authz-e2e.json`。トランプ特有の**非公開情報**とサーバー判定を優先し、ゲーム全体の通信コードは流用せず責務だけ参考にした。
