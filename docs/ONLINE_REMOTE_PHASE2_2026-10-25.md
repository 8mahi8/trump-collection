# トランプコレクション｜別端末オンライン試作 Phase 2 / 2026-10-25

## 背景・ユーザー評価
- オーナーは先行Phase 1の「神経衰弱・同じブラウザの別タブ」のルーム作成・参加・対戦を実際に試遊し「普通に部屋作って入るとこまでできてた。神経衰弱もできた」と報告。
- 次の目標は友達との**別端末間**ルーム対戦。オーナーは他のゲームのリポジトリを参考にしてよいと承認。
- 既存のCOM4ゲームはv1.5.5のまま維持。学校のGoogle Sites版は変更しない。

## 他リポジトリから参照した実装
- `8mahi8/shokoku-sensen/online-net.js`: Firebase Realtime Databaseのルーム作成、READY、ホスト正本、接続復帰、古いスナップショット排除。こちらはカードゲーム向けに高速位置同期は不要と判断。
- `8mahi8/brawl-bot-playtest/network/FRIENDS_TRANSPORT_DECISIONS.md`: ルームとゲーム処理の共通化、人数による通信要件差、接続時のイベント世代と既存モード隔離。
- `8mahi8/3d-soccer-online/network-raw.html`: 外部CDNを不要にする標準WebSocketによるSupabase Phoenixプロトコルv1接続、`phx_join`、`broadcast`、PING/PONGの実装と段階別診断。
- Supabase公式の[Realtime Protocol](https://supabase.com/docs/guides/realtime/protocol)と[Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)を確認。

## 実装したもの
- `online/realtime-wire.mjs`: `WebSocket`標準APIだけでSupabase Realtimeへ接続。接続・join ACK・別クライアントのBroadcast受信・heartbeat・最大5回の限定リトライ・ルーム別topic・切断時クリーンアップ。
- `online/memory-remote.html`: Phase 1 `online/memory-lab.html`のロビー／カード盤面を継承し、通信方式をRealtimeに変更。ホストの見える状態だけを送信、ゲストはホストの手番とリビジョンに従い操作を送信。作成・5桁参加・READY・開始・札公開・勝敗・再戦。
- 横向きの低い画面で対戦中にロビーパネルを畳み、神経衰弱の24枚が700×320/844×390に収まるようにレイアウトを調整。
- GitHub Pages専用単体HTML `preview-online-memory-remote.html` を`main`へ**新ファイルとして**追加。通常`index.html`（v1.4.0）、既存COM試遊版（v1.5.5）、従来の2タブ研究室は変更なし。
- 外部JavaScript CDN/画像/ライブラリ不要。WebSocketはオンライン通信のため必要。
- 接続先は `3d-soccer-online`で公開済みのSupabase Freeプロジェクトを**通信実験の間だけ共用**（公開可能なpublishable keyのみ）。独立topic接頭辞 `realtime:trump-memory-friends-v1-` を使用。サッカー側コード、DB、SQL、RLS、Realtime設定は変更していない。

## 検証
- `node --test tests/*.mjs`: **29件合格（既存26件＋Realtime新規3件）**。
- 新規 `tests/realtime-wire.test.mjs`: 同ルーム間Broadcast、異なるルーム間の隔離、Socket切断→再join成功、無効な参加情報と停止後の送信拒否。
- 模擬ブラウザ上で **ホスト・ゲスト2ページ** を操作。ルーム作成→番号参加→両者READY→開始→札1枚・2枚公開の両側反映→ゲストSocket切断→自動再接続／状態再取得を実演し、JavaScript例外0。
- 小画面 **844×390、700×320** の両方で横方向・縦方向の盤面はみ出しがないことを確認。
- **未検証**: 実Supabase WebSocketを経由した2端末相互接続（ブラウザテストは模擬サーバー）、学校iPad Safari、Google SitesのHTML直接貼り付け環境。GitHub Pagesの公開ワークフロー成功のみでは通信の成功を意味しない。

## セキュリティ・運用上の制約
- 本試作は**公開Broadcastチャンネル**。短い5桁番号は認証ではなく、同じtopicが分かれば部外者も購読・投稿し得る。ホストの役割・参加者IDを暗号的に保証する仕組みはまだない。身内での短い試験以外に利用しない。
- 神経衰弱の伏せ札の答え・初期seedは公開スナップショットに含めない（`online/memory-authority.mjs`で検証済み）。ただし**ホストは配札の全体を知る**ため、ホスト不正防止まで実装したわけではない。
- サービスロールキー、secret key、ユーザーの個人情報はクライアントへ含めない。
- ホストがページをリロードするとローカル権威状態が失われ、同ルームの対戦復元は現時点でできない。一時的なSocket切断だけは再接続を試す。
- 接続が不安定な学校回線での動作は未確認。無理な高頻度同期をせず、3秒ごとに軽い同期状態を送っている。
- 既存Freeプロジェクトの無料枠を超えないかは継続監視が必要。実DBを書き換えず、公開ゲームの本番通信と混線しない別topicを使うが、クォータは共有する。
- 本番へ向けた次段階は**トランプ専用Supabaseプロジェクトまたは専用隔離環境**、匿名認証＋Private Broadcast/RLS/ルーム参加権限、ホスト交代・再入室、2端末実測など。現行試作をこのまま正式運用扱いにしない。

## 次のテスト（オーナー担当）
1. PCで https://8mahi8.github.io/trump-collection/preview-online-memory-remote.html を開き、「ルームを作る」を押す。
2. スマホ（または別PC）で同じURLを開き、5桁コードを入力して「ルームに参加」。**同じブラウザの別タブではなく、別端末で試す**。
3. 両方「準備OK」→ホスト「対戦開始」。それぞれカードをめくり、両端末で札・ターン・得点が一致するか確認。
4. 失敗したら両端末の`#status`メッセージと発生段階（ルーム作成／番号入力／READY／プレイ中）を共有してもらう。学校SafariとGoogle Sites埋め込みテストはその後。

**main の既存ゲームとGoogle Sitesを勝手に置き換えない。**
