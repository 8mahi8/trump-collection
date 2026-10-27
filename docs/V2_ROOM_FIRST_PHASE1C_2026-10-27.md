# Foundation V2｜Phase 1c：共通ルームの認証通信・ホスト権限（2026-10-27）

## 今回の実装
- `v2/session/room-coordinator.mjs`：ホスト権限のCoordinatorとゲスト共通RoomClient。部屋作成・ゲストの参加/Ready/選択リクエスト収集→検証→Lobby CAS更新→ACK返信→キュー削除。ゲストの本文に書かれたactorは信用せず、認証UIDのリクエストパスから本人を決定する。
- `v2/net/firebase-room-lobby-rest.mjs`：Firebase RTDBの専用 `trumpRoomsV2/{room}/lobby` と `requests/{uid}/{requestId}` / `receipts/{uid}/{requestId}` に対するRESTアダプター。トークン必須、条件付き更新(ETag/if-match)、Firebaseで欠落する空配列の正規化、UID別キュー送受信。
- `firebase/trump-rooms-v2.rules.json`：実エミュレーター専用の独立Rules。Lobbyの書込み権限はホスト、ゲストのリクエスト作成は本人のUIDパスだけ、他人のリクエスト・ACKの読取り禁止。旧V1ルールは一切変更しない。
- `firebase.room-v2-emulator.json` と `.github/workflows/room-v2-emulator.yml`：Firebase匿名AuthとRTDB Rulesの隔離されたdemo環境で実行するCI。
- `tests/v2-room-emulator.e2e.mjs`：実Firebaseの独立UID5名でルーム作成、3人同時参加、ゲストのゲーム選択拒否、4人のReady、ババ抜きMatch、結果、ロビー復帰、同じ部屋で神経衰弱2人戦へ切替、見学者2名、ゲストの他人への不正書込拒否、過去マッチID拒否、古いReady拒否。
- `v2/core/shared-room.mjs`：選択したゲームを同じゲームに選び直しても古いReadyが再利用されない `selectionEpoch` を追加。マッチID＋選択epochで旧操作を隔離する。

## 検証証拠
- [GitHub Actions #40510448708：成功](https://github.com/8mahi8/trump-collection/actions/runs/40510448708)。共有ルームユニットテスト、Firebase RESTユニットテスト、実Firebase Auth+RTDBエミュレーター4人操作・不正アクセス検証、すべて成功。
- 直前のCI失敗は実装途中のテスト期待値・epoch契約変更によるもので、最終コミット `25c428fc7a34b058b6fc7d4d787da141b88487c5` は成功。
- 実エミュレーターで確認したのは『ルーム・ロビー・ゲーム選択・参加者権限』まで。ゲームAuthorityでのカード配布・手札の秘密保持・画面描画・通信パフォーマンスは対象外。

## 主な設計・残る安全性
- ホストだけがRoom状態を更新でき、ゲストはUID固有パスへ操作リクエストを置く。Host Coordinatorが適正な行動のみ純粋なRoom Reducerへ渡す。Firebase REST条件付き更新は競合時に412を返す。公式：[Realtime Database REST ETag](https://firebase.google.com/docs/database/rest/save-data)。
- 同時Join/Readyなどは現在のGame+Match Sequence+Selection Epochに一致する場合のみ適切に再基準化する。ホストによるゲーム変更・試合終了など非可換操作は古いrevisionを拒否。
- CAS更新後にACK通信が失敗しても再適用されないよう最近80リクエストのIDをLobbyに保持。これは限定的な再送保護で、経過時間の長い再送まで完全保証するものではない。
- 現状ではFirebaseルームのゲーム状態は未接続。対戦中のゲームAuthorityの操作とLobby Matchの開始/終了を一貫して同期させる工程が必要。
- 校内の匿名認証成否・WebSocket・Safari上の回線品質は未検証。**エミュレーター成功だけで学校実機の成功を保証しない**。
- 旧本番Firebase Rules/DB、Supabase、main、学校Google Sites版、既存Driveファイルには触れていない。新Rulesも本番適用禁止。

## 次の作業｜Phase 2a
1. `v2/session/room-coordinator.mjs` のMatch開始通知から、`online/four-seat-authority.mjs` のババ抜きAuthorityを起動し、確定した matchId とUID→座席を対応付ける。
2. マッチ操作コマンドをルームコマンドと混ぜずMatch単位のチャネルに分離し、非公開手札/公開盤面/操作ACKをFirebase Rulesで検証。
3. ババ抜き1試合を4つの本物のFirebaseエミュレータークライアントで最後まで進行し、新共通Table Rendererに同期表示。
4. 同じルームで試合終了→ロビー→別ゲームを選択。通信回数/描画時間と操作遅延を測定。
5. Google Sites直接貼り付け用の1HTMLは開発用として生成し、学校公開版は勝手に変更しない。