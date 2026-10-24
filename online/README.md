# トランプコレクション｜オンライン基盤 Phase 1（2026-10-25）

## 目的
学校iPadのSafariで友達とカードゲームを遊ぶ。既存4ゲームはCOM版として守りながら、まず神経衰弱の**2人用ルーム・手番同期・非公開のカード情報を区別する仕組み**を独立ラボとして実装。将来的に4人用のババ抜き・七並べ・大富豪および新規カードゲームにも展開する。

## 現在の実装
- `memory-authority.mjs`：神経衰弱の唯一のゲーム正本。5桁ルームコード、席(ホスト/ゲスト)、双方READY、ホストSTART、カードめくり、1秒の2枚公開、上がり/再戦、ラウンド番号、revision、重複actionId・旧revision・手番違い拒否。
- `memory-lab.html`：**BroadcastChannelを使った同一オリジンの別タブ2つ**のローカル通信ラボ。ルーム番号を入力して入室し、2人で対戦可能。学校Safariの正式ゲームではない。
- `supabase-transport.mjs`：ホスト/ゲストの通信を**Supabase Realtime Broadcastのprivate channel**へ置き換えるためのアダプター。現在はSDK/APIキー/実Supabaseプロジェクトと**未接続**。無効な通信・ACK失敗・加入失敗は明示エラーとし、権限がないときpublic channelへ勝手にフォールバックしない。
- `tests/online-memory.test.mjs`：6件。ルーム参加、ホストのみ開始、第三者拒否、非公開札の秘匿、旧revision/二重コマンド、ミスマッチ後の手番、12組完走・再戦。
- `tests/online-transport.test.mjs`：4件。private channel・ACK・不正パケット・接続エラー後の解除。
- 既存のCOM版20件＋新規10件＝**30件のNodeロジックテスト成功**（`node --test tests/*.mjs`）。

## 実際のブラウザ検査（2026-10-25）
Chromium+Playwright、同一originを継承する2タブで手動DOM操作を自動化：
1. ホストが5桁ルーム作成→ゲストが番号参加（2/2表示）
2. ホストREADY、ゲストREADY、ホストのみSTART可能
3. 最初の24枚は双方伏せ札（ゲスト側のカードfaceは0枚）
4. ホストが1枚めくると両方に1枚だけ表が見える
5. 2枚目で両方に2枚公開され、1秒後に再び伏せる（ミスマッチ）
6. コード例外なし、同期したターンが一致
7. 700×320の小さな横画面では初版が縦にはみ出したため、12列×2段へ修正。**24枚全て画面内、スクロール高さ320px＝画面高320px、カード幅約50px**を確認。
これは**同一ブラウザorigin内の検証**であり、別端末・学校ネットワーク・Supabase本番通信の実測ではない。

## 他プロジェクトからの学び
- `8mahi8/shokoku-sensen/online-net.js`：Firebase RTDBの5桁ルーム、ホスト確定、通信停止・ゲスト表示の診断を参考にした。実コードはコピーせず、今回はターン制に絞る。
- `8mahi8/brawl-bot-playtest/network/FRIENDS_TRANSPORT_DECISIONS.md`：責務の等しい通信処理だけ共通化する。カードゲーム別の秘密情報・人数・ルール判定は画一化しない。
- `8mahi8/3d-soccer-online/README.md`：Supabase Realtime Broadcast/Presence、5桁番号と接続確認。学校でのPresence登録に関する失敗報告があるため、接続ACKの成否、タイムアウト、切断復帰を区別する。
- 公式: [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)、[Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)、[Realtime Settings](https://supabase.com/docs/guides/realtime/settings)。

## セキュリティと機能上の未完了（重要）
- **同一ブラウザの別タブ間だけの模擬通信**。別のiPad・PCとインターネット越しに対戦できる状態ではない。
- Authorityは伏せカードの`rank/suit`やseedを公開viewに含めない。これはデータ最小化であり、**ルームへの参加権限や本人確認の代わりにはならない**。
- BroadcastChannelはローカルorigin共有であり、別タブ間で本物の認証/秘密通信を提供しない。ホスト・ゲストの「actor」はまだサーバー検証されたIDではない。
- private Supabase channelを使うには、別途**Auth（できれば匿名サインイン）＋realtime.messagesのroom membership付きRLS**、部屋/席の確保の原子的処理、切断復帰、IDのバインド、適切な無料枠管理が必要。ルーム番号だけでRLSを迂回させない。
- Realtime公式ガイドによるとpublic channel許可時はpublishable keyを持つクライアントに広く購読・送信可能。したがって**public channelを本番で使わない**。`service_role`/secret keyをHTML・GitHubへ埋め込まない。
- 既存の3Dサッカーや小国戦線のSupabase/Firebaseの**実プロジェクト設定・Rules・DBを変更していない**。料金発生やサービス設定変更もなし。
- ホストが正解ボードを持つ身内対戦方式は、ホストが裏面を開発者ツール等で見る不正まで防ぐものではない。公正性が必須ならサーバー側判定にする。
- 学校iPad Safari実機、Google Sites単体HTML埋め込み、離れた端末間のWebSocket通信は未検証。
- 既存4ゲームのオンライン化と、大富豪のローカルルール/他のゲーム追加はまだ実装前。

## 次の実装作業
1. Supabaseの接続先・Free枠・RLS/Authをトランプ専用に隔離して設計。現在の他プロジェクトの本番設定を流用せず、権限レビュー完了まで実書込はしない。
2. サーバーによる入室席制限・ホスト/ゲストID照合・復帰トークン・配札情報の秘匿を実装。通信障害時の旧イベント棄却と再取得に対応。
3. `memory-lab.html` のTransportをローカルBroadcastChannelと実Realtimeで切り替え可能にし、**実際に2台の端末**で最初から最後まで遊べることを確認する。
4. 検証済み通信機能をカードゲーム選択UIに接続。ババ抜き→七並べ→大富豪の手札非公開同期へ横展開。対戦先がいないときのCOMモードは維持。

## 既存公開への影響
作業は開発ブランチ `dev/quality-and-ui-v1-5-20261024` の新規ファイルのみ。既存`main/index.html`＝v1.4.0、`preview-v1.5.5.html`と現行Google Sitesコード、既存のSupabase/Firebaseは未変更。
