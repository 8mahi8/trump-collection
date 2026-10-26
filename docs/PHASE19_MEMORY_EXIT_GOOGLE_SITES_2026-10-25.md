# Phase19｜神経衰弱の途中退出・相手への終了通知を統合

**日付：2026-10-25。対象は開発ブランチのみ。学校Google Sites版、main、本番Firebase・Supabaseの設定／データ／Rulesには変更なし。**

## 動機
既存3ゲーム（Firebase）は統合ランチャーの「← ゲーム一覧」で事前に部屋の退出を通知するが、神経衰弱は別のSupabase Broadcast試作なので即座にiframeを閉じていた。途中で片方が抜けると、残った友達は通信断と区別しづらかった。身内用の軽い対策で十分で、専用アカウントや完全な接続復元は作らない。

## 実装
- `online/memory-remote.html`：神経衰弱のルーム内に **「退出・部屋を作り直す」** を追加。
- 同画面で親からの`tc:leave-room`を受付。Firebaseゲームと同じ`tc:leave-ack`を返し、ランチャーが画面を破棄する前に退出処理を終えられるようにする。
- ホストの退出は`{kind:'room_closed',protocol:1,roomCode,actor}`、参加者の退出は`{kind:'player_left',...}`を**既存Supabase Broadcastチャンネル**から送信。送信後160msを置いてWebSocket・ローカルタイマーを終了。これは**到達確認ではなくベストエフォート通知**であり、急な回線断では届かない可能性がある。
- ホスト退出通知を受信したゲストは対戦を閉じ「ホストが部屋を終了しました」を表示。ホストが既存の参加席IDと一致するゲストの退出通知を受信したときは「相手が退出した」を表示。どちらも再びルームを作れる。対戦のカードルールやSupabaseプロジェクトは変更しない。
- `online/collection-launcher.template.html`：すべての「友達と遊ぶ」（神経衰弱を含む）で既存の`askFriendsToLeave`を使用。子画面が応答しなくても**最大1.8秒でメニューに戻る**。
- `dev/verify-collection-launcher.mjs`：学校Google Sitesに近いsandbox付き二重iframeで、Chromium／WebKitを使い、SupabaseのWebSocketだけを**Playwright内部の模擬サーバーへ差し替えて**ホストの`room_closed`とゲストの`player_left`が送信されること、親に退出ACKが届くこと、ホストからの`room_closed`受信でゲストがゲームを閉じることをテスト。**本番Supabaseへテスト用ルームを作らない**。

## 検証結果（確定）

**[GitHub Actions #40201651323](https://github.com/8mahi8/trump-collection/actions/runs/40201651323) 成功**。
- Node **93/93 件成功**、失敗0。
- Chromium・WebKitとも4ゲームのCOM／友達8入口、Google Sites風二重iframeの画面選択・戻るを合格。
- 模擬Supabase WebSocketで神経衰弱ホストの`room_closed`、ゲストの`player_left`の送信、ゲストの`room_closed`受信でルームを終了する動作を両エンジンで確認。
- 既存Firebase Auth/RTDB Emulatorの3ゲーム×4独立ページ入室→READY→初手同期、ホスト一時回線断→復帰、ホスト／友人退出→新ルームが両エンジンで合格。
- 共有Rules Emulator・ルート局所化Rules Emulatorともに成功。学校Safariと実Supabase、本番Firebaseは未試験。

## 検証・制約
- Firebase3ゲームの既存Chrome／WebKit・4画面同期と退出の回帰テストも同じCIで継続。
- Supabase Broadcastは公開チャンネルの既存身内試作で、短い部屋番号を参加認証とは見なさない。故意の不正操作のための高度な対策を追加しない。
- WebSocketのベストエフォート通知を送れても**相手端末での受信を現実の学校環境で保証するものではない**。回線断の検知、Google Sites実機、Supabase実サービスでの互換性は学校試遊が必要。
- COM版、学校のGoogle Sites版と既存の公開GitHub Pages、Firebase Rules、主なオンラインコードの接続先は未変更。
