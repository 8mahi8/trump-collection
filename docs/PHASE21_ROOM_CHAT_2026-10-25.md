# Phase21｜同じ部屋の友達と使うテキストチャット

2026-10-25。**開発ブランチだけに実装**。本番Firebase／Supabaseの設定、Google Sitesの学校公開版、`main`は変更していない。

## ユーザーからの要望
同じルーム内の人間同士でチャットしたい。学内の旧iPad Safari・Google Sites直接HTML埋め込みに対応し、4ゲームのオンライン対戦を邪魔しないシンプルなテキスト入力を実装する。

## UI・仕様
- 対戦ルームの「💬 チャット」で**開閉できる小さなパネル**。通常は閉じておき、対戦中のカード表示を圧迫しない。
- 1メッセージ**120文字まで**。送信ボタンまたはEnterで送信。ユーザーからの文字列は`textContent`で表示し、HTMLとして実行しない。
- ログイン名や画像は不要。送信者を「自分」か「友達＋識別用短縮文字」で表示。
- **COM戦はチャット不要**。ルームに所属する友達とのオンライン戦のみ。
- ゲーム進行のrevisionや手札データとは独立し、チャットによってカード処理の操作を止めない。

## Firebase 4人対戦（ババ抜き・七並べ・大富豪）
- `online/firebase-room-store.mjs`：`chat(room)`で`/trumpRoomsV1/$room/chat`を読取り、`sendChat(room,text,seq)`で送信者自身の `chat/$uid/$slot` へメッセージを書込む。スロットは`seq % 10`で循環。
- 参加者4人×各10スロット＝**最大40件の固定履歴**。チャットを開いた時だけ取得し、その後も開いている間だけ約2.5秒ごとに更新。これによりルームの無制限蓄積と常時ポーリングを避ける。
- `firebase/trump-rooms.rules.json`：ルームのseatを持つ認証UIDだけチャットルートを読める。他人のUID名義での書込み、ルーム外部からの読書き、120文字超過、履歴への無制限追加を拒否。同じ本人の固定スロット上書きだけ許可。
- **本番Rulesはまだ変更していない**。チャットは新しいRulesが適用されるまで実Firebaseでは使えない。既存親ルートの広い公開権限のまま利用しない。
- `online/four-seat-remote.html` と `dist/trump-collection-online-lab.html`を更新。Firebase Local Emulatorで同じ部屋の別プレイヤーへの到達、部外者の拒否、最大件数、長文制限を検査する。

## Supabase 2人対戦（神経衰弱）
- 既存`online/realtime-wire.mjs`のチャンネル`trump-memory-friends-v1-$room`を再利用し、新規SDK・DBテーブル・課金サービスは追加しない。
- `kind:'chat'`、`protocol:1`、`roomCode`、`actor`、`id`、`text`を既存Broadcastへ送信。**テキストだけ**の一時的な履歴（最大40件）をその画面内に表示。前回ページのチャットは復元しない。
- 神経衰弱の現在のSupabaseは**公開Broadcastの身内試作**。5桁の部屋番号を知る第三者をシステム的に排除する認証はない。厳密なプライベートチャットではないことを認識し、個人情報や秘密情報は送らない。
- 模擬WebSocketで送受信とHTML文字列をテキスト扱いすることを検査。実Supabaseサービスや学校iPadでの通信完了を意味しない。

## 最終CI確認

**[GitHub Actions #40204364048：成功](https://github.com/8mahi8/trump-collection/actions/runs/40204364048)**

- Node **97/97件成功、失敗0**。ChromiumとWebKitのGoogle Sites風二重iframe、4ゲームのCOM／友達入口も合格。
- Firebase Auth/RTDB Emulatorでは、実際にルームの別4人ブラウザへチャットが届き、文字列`<img ...>`がHTML実行されずテキスト表示されることを**Chromium・WebKit両方**で確認。
- Firebase Security Rules Emulatorでは**参加UIDの読み書き成功、部外者／別UID書込み拒否、120文字超の拒否、10スロット上限**を確認。共有旧ゲームのルール局所化案・期限延長案のEmulator試験も合格。
- 神経衰弱は本番Supabaseに接続せず、Playwrightの**模擬WebSocket**でチャットの送信と受信テキスト表示を検証。
- **学校iPad Safariと実Supabase・本番Firebaseへの接続は未検証**。本番Rules・Google Sites版は変更していない。

## 動作確認・残るゲート
- ビルドで単体HTMLと開発ソースの一致を確認する。
- ChromiumとWebKitの画面テスト、Firebase Auth/RTDB Emulatorで複数プレイヤー間の同期・ルール制御、神経衰弱の模擬WebSocketを検証する。
- 結果が合格しても、実Google Sites/iPad Safari、Firebase本番Auth/Rulesおよび実Supabaseの通信は本人の試遊が必要。**学校Google Sites版を独断で差し替えない。**
