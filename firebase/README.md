# トランプコレクション｜Firebase試験専用の認証・権限設計

**注意：これはFirebase実接続前の開発資料。実FirebaseエミュレーターでのSecurity Rules評価は未実施。公開・本番導入不可。**

## 何を作ったか（2026-10-25）
- `online/firebase-room-store.mjs`: Firebase Auth匿名ログイン（REST）、ID token更新、RTDBへの認証付きGET/PUT/DELETE、5桁の部屋の条件付き作成、手札と公開状態の分離。
- `online/firebase-room-controller.mjs`: ホストが4人のjoin要求を受理し、READY・出す・パス・引く等のコマンドを既存エンジンで検証。個別private状態を配信してからpublicリビジョンを公開する。ゲストは両リビジョンが一致しなければ操作停止。
- `firebase/trump-rooms.rules.json`: Firebase RTDBの**専用エミュレーター／専用DB用の、単独で完結したRules文書**。
- `tests/firebase-room-store.test.mjs`: HTTP/Authモック7件。匿名認証、URLエスケープ、条件付き作成、UIDの違いによる個別手札アクセス、二重送信を検証。
- `tests/firebase-room-controller.test.mjs`: 通信模擬5件。3ゲームの4人対戦完走、再戦、古いコマンド拒否、通信途中エラー・ロビー配信失敗からの復帰、private/publicのリビジョン不一致時の操作禁止。

`node --test tests/*.mjs` は**48件全件合格（実行済み）**。これはJavaScriptエンジンと**模擬Firebase**の検証であって、Firebase本番・実エミュレーター上の権限テストではない。

## 重要：既存FirebaseにこのRulesをそのまま適用しない

**`trump-rooms.rules.json` はルートが `.read: false`, `.write: false` の完全なRulesファイル。** 既存小国戦線/BRAWL等と共有するFirebase RTDBへファイル全体を上書き適用すると、他ゲームのアクセスを壊す可能性がある。

隔離したデータベースの**エミュレーターで検証**してから、既存Rulesと差分を確認したうえでトランプ専用の子パスだけを合成するか、完全に独立したFirebaseプロジェクト／データベースで使う。既存Rulesに無断変更を加えない。

## 想定するデータ構造

```text
trumpRoomsV1/<5桁>/
  meta                 { hostUid, game, protocol: 2 }
  joinRequests/<uid>   true            ← 参加希望者だけ書ける
  seats/<uid>          true            ← hostのみ承認・変更
  public               publicView      ← 承認された全員が読める
  private/<uid>        privateView     ← 本人だけ読める・hostだけ書ける
  commands/<uid>/<id>  操作命令        ← 本人だけ作成・hostだけ一覧読取と削除
  receipts/<uid>/<id>  結果ACK         ← 本人だけ読める・hostだけ書ける
```

- `auth.uid` と各パスの `$uid` を比較。ルーム番号や自称 `actor` 文字列を本人証明には使わない。
- ルーム直下に `.read:true` を置かない。Firebase RTDBの祖先read権限はprivate下層でも取り消せない。
- 未承認者は`public`を読めない。`meta`は匿名認証済みの人がルーム参加時に参照できる。
- 利用するのはFirebaseの公開Web API key（秘密キーやService Accountではない）。本番のAPI keyとDatabase URLは接続先の許可・設定が完了してから画面へ注入する。

## 次に必須の検証（Firebase Local Emulator Suite）

Google公式参照：
- https://firebase.google.com/docs/rules/unit-tests
- https://firebase.google.com/docs/database/security/rules-conditions
- https://firebase.google.com/docs/database/security/core-syntax
- https://firebase.google.com/docs/reference/rest/auth
- https://firebase.google.com/docs/reference/rest/database

実エミュレーターで少なくとも以下を検証する：

1. 匿名認証なしではいかなるデータも読めない／書けない。
2. hostだけが`meta`初回作成、席の承認、public/private配信、コマンド読取と削除、receipt配信をできる。
3. 未承認ユーザーはprivate/publicを読めず、他人の`private/$uid`のGETは拒否される。
4. guestは`commands/<自分のuid>/<id>`のみ作成でき、他人のUIDを`actor`に書くことも、既存のIDを上書きすることも拒否される。
5. 不正なパス、親ノード一括GET、ルーム番号衝突、UID入れ替え、他人のreceipt取得が拒否される。
6. 4人で入室→全ゲーム対戦→再戦／端末切断→復帰を実Firebaseエミュレーター上で完走。
7. トランプ専用のRulesを**他ゲームの既存Rulesと統合した場合も、他ゲームの権限が変化しない**こと。

**環境内にFirebase CLIと `@firebase/rules-unit-testing` がないため、現時点ではこの実エミュレーターテストは実行できていない。** その検証なしで独立チャンネル以外の外部公開はしない。

## 未対応
- Firebase本番への実接続（まだURL/Web API Keyがトランプ側へ設定されていない）
- 実Firebase Rulesによる権限検証
- ホストページ更新後の対戦復元、端末切断中の席再参加、ルーム自動削除
- iPad Safari / Google Sites直接埋め込み
- 4人版の通常コレクションUIへの統合

これらを解決してから初めて、オーナーへ新しい試遊版を渡す。
