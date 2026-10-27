# トランプV2｜Phase 2a 完了報告：共通ルームから実ババ抜き対戦へ（2026-10-27）

## 完了した実装
- `v2/session/four-player-match.mjs`：既存 `online/four-seat-authority.mjs` をV2のRoom Matchへ接続。参加UID→座席、実ババ抜きルール、公開盤面/UID固有手札、旧matchId/古いrevision拒否。既存の七並べ・大富豪でも同一橋渡しを単体テスト。
- `v2/session/room-match-host.mjs`：ホストが4人分の秘密手札→公開盤面の順で同期し、1手ごとの受信→ルール実行→スナップショット配信→ACK、最終ターンでRoom Coordinatorに対局終了を通知。
- `v2/session/room-match-guest.mjs`：`createRoomSession` の poll/act/receipt 契約に合わせたFirebaseゲスト。**CPUとオンラインのTable Renderer自体は複製しない**。公開/秘密revisionが一致しない通信途中の画面を操作可能にしない。
- `v2/net/firebase-room-lobby-rest.mjs`：マッチごとの `matches/{matchId}/public`、`private/{uid}`、`commands/{uid}/{requestId}`、`receipts/{uid}/{requestId}` を拡張。従来Lobbyデータと手札を完全分離。
- `firebase/trump-rooms-v2.rules.json`：上記マッチの公開盤面は参加者のみ、秘密手札は本人のみ、操作は本人UIDからのみ作成可能。ゲストによる盤面改変禁止、ホストによる処理済みコマンドの削除許可。これは**エミュレーター専用で本番には適用していない**。

## GitHub CIと再現性
- **[V2 Room-first Firebase Emulator #40516425639 成功](https://github.com/8mahi8/trump-collection/actions/runs/40516425639)**。実Firebase認証した別UID5人（4人が対戦＋部外者1人）。ルーム作成/同時入室/Ready→ババ抜き実対局を最後まで完走→結果処理→**同じルーム番号のままロビーに戻り七並べ選択**。
- テストでは各ターンで当該プレイヤーの共通Room Sessionが盤面・手札・合法操作を取得し、選んだ裏向きカードをFirebaseキューに送信。ホストがAuthorityで処理しスナップショットを更新し、本人がACKと更新Revisionを取得。
- 部外者の盤面・手札取得、他人の手札取得、ゲストによる公開盤面の改ざんが実Firebase Rulesで拒否されることも確認。
- `tests/v2-four-player-match.test.mjs`：4人ゲーム3種でBridge/既存ViewModel互換、ババ抜き1対局最後までの純粋エンジン検証。
- `tests/v2-room-match-emulator.e2e.mjs`：実Firebaseの4人ゲーム完走と同じRoomでのゲーム切替。
- `tests/v2-room-match-guest.test.mjs`：公開・自分専用のRevision不一致時は `syncing` として操作停止、観戦者や終了Roomの操作拒否。最後に追加したため、最新CIの結果は都度確認すること。

## 運用・未完成境界（重要）
1. **ゲーム本体の通信テスト完走**であり、Google Sites埋め込み上で4人が画面を実際にタップするGUI/E2Eはまだ未完成。学校iPadで軽く快適かも未測定。CPU/対人共通UIのTable Rendererは別途存在するが、オンラインLobbyからの画面遷移をこれから結合する。
2. ホストAuthorityは**ホストメモリー保持のみ**。ページリロード/ホスト強制終了時に実際の進行を復旧できない。ゲーム継続/復帰の仕様を次フェーズで決め、完成前の試遊を本番扱いにしない。
3. 対局中のデータ配信はREST複数PUT/GET。学校で以前重かった原因候補と通信回数を再計測し、必要なら購読SSEやバッチ化を検討。今回のエミュレーター2秒の実績は学校ネットワークの速度証明ではない。
4. 神経衰弱の実オンライン通信は未対応。4人ゲームから2人ゲームへ切り替えるLobby操作は実装済み。
5. Firebase匿名認証が学校の環境で使用可能とは未確認。現行本番Firebase Auth/Rules/DBを変更していない。
6. main、Google Sites公開版、既存Google Drive上の試遊HTML、Supabase本番は無変更。

## 次のPhase 2b：ブラウザUI・見た目と操作
- Room-first **単一のGameShell** を作り、ルーム番号入室/プレイヤー表示/ゲーム選択/Ready/結果・ロビー戻りを1画面で切替。
- CPUババ抜きと同じ `v2/ui/table-renderer.mjs` をオンラインでも使用。新しいゲーム専用Rendererや入れ子iframeを作らない。
- 本番接続前にデモFirebase Emulator上で4つのChromium/WebKitブラウザ、Google Sites風iframe内の実タップと操作同期を検証する。
- 当面はリロード復帰・2人神経衰弱の仕様と接続を計画し、本番Rules変更/公開版変更は本人承認後だけ。
