# Foundation V2｜Room-first 実装 Phase 1b（2026-10-27）

## 今回GitHubへ保存したコード
- `v2/core/shared-room.mjs`：永続ルームと試合を分離する純粋な状態遷移。部屋作成、参加、ゲーム選択、2/4人参加者の選定、準備、開始、終了、ロビー復帰、離脱、マッチ識別子による旧操作拒否。
- `tests/v2-shared-room.test.mjs`：共通ルームで4人がババ抜き→同じ部屋で七並べ、4人部屋で2人神経衰弱、人数/Ready、不正ホスト、期限切れのrevisionやmatchId、退出と中断、現行4ゲームのRegistry統合を検証。
- `v2/net/firebase-room-lobby-rest.mjs`：旧 `trumpRoomsV1` と混同しない `trumpRoomsV2/{code}/lobby` を対象に、Firebase REST ETag取得→条件付きPUT。認証トークンを必須とし、read/create/commitを分離。旧ルールを自動変更しない。
- `tests/v2-firebase-lobby-rest.test.mjs`：ローカル模擬HTTPで予約の重複、ETag競合、古いwriteの拒否、匿名open-rootモードを要求しない設計を検証。

## 今回の決定
- **Room先行**。ルーム作成時にゲームを指定しない。Roomはルーム番号/メンバー/選択ゲーム/準備/進行中MatchIDだけを保持し、手札やゲーム内部状態は置かない。
- **ゲームの切替**は、現在Match終了→同じRoomのロビー→次ゲーム選択→新Match。旧Match IDの操作は拒否。
- 4人ゲームを選んだ後でメンバーが揃ったとき、自動的に参加者が全員になる。手動操作を減らす。
- 4人Roomの2人ゲームでは、ホストが2人を明示的に選択してからそれぞれReadyする。非参加者はMatchへの行動を許可しない。
- ゲーム中に参加者が退出するとそのMatchは中断（results）し、ルームは維持。見学メンバーの退出だけなら試合は継続。ホストが退出するとルームは閉じる。
- メンバー/ロビー状態はJSONだけで表現し、クライアント・ネットワーク・UIとは切り離す。

## 外部根拠
- Firebase公式：RESTのETag `X-Firebase-ETag` を取得し `if-match` 条件付きPUT。412なら競合しており上書きせず再読込する。https://firebase.google.com/docs/database/rest/save-data
- Firebase公式：通常のread-writeにはトランザクションがあり、同時更新時に再試行がある。https://firebase.google.com/docs/database/web/read-and-write
- boardgame.io公式 Lobby：ロビーとゲームのインスタンスを別のライフサイクルとして扱う例。https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/api/Lobby.md
- 既存コードを全面移植せず、学校環境で検証できる最小限の構造とする。

## 注意：未完成の境界
1. **共通ルームは実際のオンラインUIとはまだ接続していない**。ブラウザ4端末のRoom-first試合完走は未検証。
2. `firebase-room-lobby-rest.mjs` は**通信データ層の試験実装**。現在の本番RTDB Rulesに新パスのアクセス権限があるか未確認であり、本番利用していない。**ホストのみ書き込めるRulesとゲスト用操作キュー/権限検査**を新規に設計し、エミュレーターで検証するまで接続してはいけない。Reducerの `actor` フィールドを信用してクライアントから任意に書き込ませない。
3. LobbyのCAS成功とMatchのゲームルール処理が同期される方式、マッチ終了判定の権限、ホスト再接続、ルーム番号の再利用防止は次工程。
4. 神経衰弱の2人オンライン実装、学校の通信不良解消、全ゲームCPU共通UI統合は未完了。
5. Google Sites公開版、`main`、本番Firebase/Supabase、旧Drive試遊ファイルには触れていない。

## 次工程
- **Phase 1c**：ホスト権限を持つ共通 `RoomCoordinator` とゲスト操作キューを用意し、ルーム内メンバーとMatchの原子的切替を設計。RTDBエミュレーターで4人入室/ゲーム選択/Readyを実測。
- **Phase 2**：ババ抜き4人の既存AuthorityをMatch処理へ接続。Room-firstの同一 Rendererで4ブラウザの試合完走とロビー復帰を確認。
- **Phase 3以降**：通信回数・遅延・描画を改善。神経衰弱の学校での接続不可を別途診断しFirebase移行。残りのゲームをプラグインで統合。

## テスト証拠
- ローカル：共有Roomの状態遷移11項目、CASストア模擬2項目成功。GitHub CIは最新headの結果を別途確認。
