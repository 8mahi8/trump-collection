# トランプコレクション｜Phase 11：Firebase RESTポーリング軽量化（2026-10-25）

## 実装した変更

本番Firebaseへは接続せず、開発ブランチの通信頻度を見直した。現行の4人版はFirebase Anonymous Auth＋Realtime Database RESTを利用するため、繰り返しGETの回数削減が学校iPadの通信負荷と無料Spark枠の両面で重要。

1. **認証済みの席をキャッシュ**：`online/firebase-room-controller.mjs`のゲストは、自分のUIDで`seats/<uid>`を実際に一度確認した後、同一対戦中は毎回GETしない。待機中は引き続き確認し、終了通知でキャッシュを破棄する。private/public/heartbeat取得はFirebase Security Rulesで毎回本人を検証するので、**承認前に他人の手札を読める状態にはならない**。
2. **ゲーム状態に応じたポーリング頻度**：新しい`online/firebase-poll-policy.mjs`で待機・対戦中・終了後・通信失敗・ACK待ちを分離。`online/four-seat-remote.html`へ統合し、`dev/build-online-html.mjs`と配布候補`dist/trump-collection-online-lab.html`にも反映。
3. **単体テスト6件追加**：`tests/firebase-poll-policy.test.mjs`が状況別の間隔を、`tests/firebase-room-controller.test.mjs`の追加テストが同じ席での連続8回pollで**席GETが1回だけ**で済むことを確認。

## 変更後のポーリング方針

| 場面 | 間隔（ms） |
|---|---:|
| 対戦中：ホスト／自分の番 | 650 |
| 対戦中：自分以外の番 | 900 |
| ロビー：ホスト | 1,000 |
| ロビー：参加者 | 1,500 |
| 対戦終了：ホスト | 1,600 |
| 対戦終了：参加者 | 2,000 |
| 操作ACK待ち | 250 |
| ホスト不在を検知した後 | 2,300 |
| 状態同期ずれ | 700 |
| ネットワークエラー | 1,900msから最大6,000msで増加 |

以前はロビー／対戦中／終了後の通常状態で一律650msだった。**頻度を変えただけで通信量の実測削減率を保証するものではない**。実環境のHTTP転送量・通信遅延・学校Safariの安定性を測ったわけではなく、定量的な無料枠使用量は専用本番DBを確保してから測定する。

### 実測値と異なることに注意
仮にゲストがロビーで20秒待機する場合、従来650ms間隔の確認が約30回、今回1,500ms間隔なら約13回になる（ネットワーク処理時間を除く単純な理論値）。承認後は各回の席GETを省略できる。ただし実際の転送量にはpublic/privateの大きさ、Firebaseの応答、操作・入室の回数が関係する。

## 実行済み自動検証

[GitHub Actions成功 #40178100590](https://github.com/8mahi8/trump-collection/actions/runs/40178100590)

- Node **79件全件合格**、失敗0。内訳は従来73件＋今回6件。
- Firebase Local Emulator Suite（Auth＋RTDB）で、4人ババ抜き28手・七並べ52手・大富豪97手、決着・再戦・退出・権限チェックを維持。
- Chromium独立4画面でも各ゲーム入室→READY→開始→カード操作→退出→新部屋を確認。
- ホストのネットワーク遮断→ゲストの操作停止→通信復帰も確認。
- 4ゲーム統合ランチャーのCOM×4・友達対戦×4の起動を維持し、外部JS不要の単一HTMLを再ビルド・構文検証済み。

## 保護した範囲・残る作業

- **Firebase実本番プロジェクトはまだ作成・接続していない**。料金が発生する作業やBlaze契約、他ゲームのFirebase Rulesへの変更は行っていない。
- 通常版`main/index.html`と開発COM版`index.html`、学校Google Sites直接貼付け版は未変更。
- 無駄なRESTのGETを削減しただけで、保存データの放置掃除／ルームTTL、実ダウンロード量の測定、RTDBのイベント購読によるさらなる改善は残る。
- ページ再読み込み後の対局復元はオーナー合意により対象外。一時的な通信断復帰だけ維持。
- 次の実質ゲートは**無料のトランプ専用Firebase Sparkプロジェクト**の新規準備と、実Auth・RTDB接続の検証。安全な手順は[DEDICATED_SPARK_SETUP](../firebase/DEDICATED_SPARK_SETUP.md)。

再実行：`node --test tests/*.test.mjs`、`node dev/build-online-html.mjs`、`node dev/build-collection-lab.mjs`。ブラウザ4面は`.github/workflows/firebase-emulator-ci.yml`内のPlaywright＋エミュレーターを使用。
