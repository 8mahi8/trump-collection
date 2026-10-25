# Phase 18｜統合メニューに戻るときのオンラインルーム退出を改善

2026-10-25。作業ブランチ：`dev/quality-and-ui-v1-5-20261024`。学校版・本番Firebase・Rules・Auth・`main`は変更していない。

## 問題

統合ランチャーの「← ゲーム一覧」は、従来は内側`iframe`を直ちに`about:blank`へ移していた。この動作だけではオンラインの部屋へ終了が伝わらず、残った友達がホストの接続断を待ち続ける場合がある。通常のゲーム画面内にある「退出・部屋を作り直す」は、ルーム閉鎖を記録する機能を持っているため、統合ランチャーから戻る操作も同じ経路を呼び出すのが望ましい。

## 修正

- `online/collection-launcher.template.html`：Firebase3ゲームの「友達と遊ぶ」から一覧へ戻る際、直接のDOMアクセスではなく `postMessage({type:'tc:leave-room',requestId})` を子`iframe`へ送る。`tc:leave-ack` を受け取ってから画面を破棄。待機中は「退出中…」と表示。
- `online/four-seat-remote.html`：親からの同メッセージを検証し、既存の`leaveRoom()`を呼ぶ。ホストは`closeRoom('host_left')`、参加者は`leaveRoom()`の既存経路を維持。成功・失敗いずれも応答を返す。
- **通信が詰まったときにもメニューから出られることが最優先**。子から応答がない場合、親は最大1,800msで画面破棄へフォールバックし、無期限にブロックしない。この場合、他端末に終了通知を届けた保証はない。ログインやルーム復元は増やさない。
- COMや神経衰弱Supabase試作は今回のFirebase退出ハンドシェイクを適用しない。
- `dist/trump-collection-online-lab.html`は新しい退出メッセージ処理を含むよう再生成。
- `dev/verify-collection-launcher.mjs`：Chromium／WebKitのGoogle Sites風二重サンドボックスで友達ゲームから戻る際のACK件数と、子が応答しないケースの時間制限を確認。
- `dev/verify-online-browser.mjs`：Firebase Emulator4端末試験で、ホストとゲストのいずれも`tc:leave-room`経由で退出し、残りのクライアントが新しいルーム作成メニューに戻れることを確認する試験を追加。

## 引き続き対象外

- 不正対策、アカウント管理、厳格な再接続・席復元、リプレイ保存。
- 実端末Google Sitesでの実測、本番Firebaseの書き込み、学校公開版の上書き。
- ブラウザタブ強制終了・回線の完全断絶では終了通知は保証できない。これは通信が回復しなければ避けられないため、既存の心拍・タイムアウトで対応する。

## リリースゲート

**[Actions #40200557612](https://github.com/8mahi8/trump-collection/actions/runs/40200557612)：成功**。Node 93/93件合格。Chromium／WebKit両方で4ゲーム×COM/友達8入口、Google Sites風二重iframeの切替・オンライン退出ACK・子無応答の時間制限、Firebase Emulator4端末×3ゲームの同期とホスト／ゲスト退出＋通信断復帰、合成した既存ゲーム共用Rulesのアクセス制御をすべて確認。

**残る未検証：** 実Firebaseサービス、実Google Sites埋込、旧学校iPad Safari。実際のGoogle Sites版更新には本人の試遊・承認が必要。
