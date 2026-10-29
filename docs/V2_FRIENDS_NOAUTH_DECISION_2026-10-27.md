# トランプV2｜本人指示で設計修正：認証・リロード復帰は不要（2026-10-27）

## 今後絶対に守るユーザーの指示

本人は「友達としか遊ばないから、ホストのページ再読み込みからの対戦復帰は不要」「Firebase匿名認証は不要、学校iPadで接続不可となる要因が増える」と明確に指摘した。**これをV2の確定要件とする。**

1. **Firebase匿名認証を使わない**。signIn、token取得、Authサービス接続、Firebase Auth API Keyの必須化はオンライン学校用V2の起動・通信経路から外す。IDはページ内の短命なランダムプレイヤーIDのみ。
2. **ホストの対戦再読み込み復帰は作らない。** リロードで試合は中断して構わない。既存の試合を勝手に再配札しない最低限の停止ガードのみ残す。復元エンジンや再ログイン導線を作り込まない。
3. 目的は学校iPad Safariで**すぐ遊べること**。5桁の共通ルーム→ゲーム選択→準備→対戦→同じルームに戻る。それ以外の複雑な機能を先回りで追加しない。
4. main / 学校Google Sites実公開版 / 本番Firebase Rules/DB に無断変更なし。新コードはV2開発ブランチのみ。

## 実際に反映したコード

- `v2/online-app.mjs`: `createFirebaseAnonymousAuth` import・`signIn`処理・`apiKey`必須条件を削除。Web CryptoランダムID(`tc...`)をローカルで生成し、ブラウザセッションごとに保持する。再読み込みからの復帰はしない。
- `v2/net/firebase-room-lobby-rest.mjs`: `friendOnlyNoAuth:true` と `identity:{uid}`を追加。学校想定経路では `auth=` トークン付きURLを送信せず、Identity Toolkit/securetokenにアクセスしない。旧認証モードは以前のエミュレーター回帰テスト用に残るが、**V2の実際のアプリから使わない**。
- `firebase/trump-rooms-v2-friends-emulator.rules.json` / `firebase.room-v2-friends-emulator.json`: **開発エミュレーター専用**のfriend-only無認証RTDBルールと設定。本番適用禁止（管理者確認・範囲調整が必要）。
- `dev/verify-v2-online-ui.mjs`: Firebase認証系HTTPリクエストが1件でも発生したら失敗。4人のWebKit/Chromium Google Sites風iframe試験を認証なしで実行。
- `.github/workflows/room-v2-ui-emulator.yml`: **認証エミュレーターを起動しない**（Realtime Databaseのみ）。
- `tests/v2-firebase-lobby-rest.test.mjs`: Authトークンが付与されない専用ユニットテストを追加。

## 認証なし運用の性質（ごまかさない）

- ネットワーク上で本人確認をしないため、5桁の番号を知っている第三者の不正入室・操作改ざん・他人のカード情報の読取りをサーバー側で厳密に防ぐことはできない。
- UIには他人の手札を渡さないが、**認証なしRTDBは秘密手札のサーバー側閲覧制限を保証しない**。友達用の試験データ以外を格納しない。
- 開発用ルールは `trumpRoomsV2` 以下だけを開放し、Firebase全体の `.read/.write` は `false` にしている。本番ルールへこのJSONをそのまま上書きしてはいけない。
- 本番RTDBにおける `trumpRoomsV2` の許可設定は本人承認を得て別途統合する。今は本番設定は一切触らない。

## 実証

- [GitHub Actions #40522130962](https://github.com/8mahi8/trump-collection/actions/runs/40522130962) は `success`。Chromium/WebKit両方で4人共通ルーム・ゲーム選択・Ready・カードタップ後の4画面同期成功。記録ログに **`auth:0`**。
- 旧基盤のAuth込み成功は学校での利用可能性を意味しない。
- **学校iPad実機はまだ確認していない**。次は通信負荷、学校Safariの接続性、短い操作で快適に遊べるかを優先する。再読み込み復帰機能や匿名認証を再度「必須」として提案しない。

## 探索すべき次の簡潔な工程

1. 認証なし4人ブラウザ試験と単体テストの緑を維持。
2. ババ抜き・七並べ・大富豪の共通ロビーとゲーム切替・操作感を改善し、無駄なHTTP読取を削減。
3. 2人神経衰弱は同じロビーに追加。通信方式を不必要に混在させない。
4. 友達と学校iPadで実際に試した結果から、本当に必要な修正だけを追加。
