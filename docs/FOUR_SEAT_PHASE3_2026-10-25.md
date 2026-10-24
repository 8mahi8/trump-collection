# トランプコレクション｜共通4人対戦コアとFirebase移行設計（2026-10-25）

## 決定事項・ユーザー希望
- オーナーは試作の別端末Supabase神経衰弱を「普通に遊べた」と報告。**学校iPadでの既存のオンライン動作実績はFirebase**との補足もある。したがって今後の4人版はFirebase RTDBを第一候補とする。
- オーナーは開発・検証をAI側に委任し、本人による頻繁な試遊は望まない。**自動ルールテスト＋多クライアント操作テストを先に実施**し、実機確認は最後に絞る。
- 無料運用、Google Sites HTMLの直接埋め込み、既存4ゲームCOMモードの維持は変えない。

## 実装したファイル
- `online/four-seat-authority.mjs`: ババ抜き・七並べ・大富豪の共通4席ロビー・READY・START・再戦、手番検証、リビジョン、重複アクション拒否、公開情報と個別手札情報の分離。
- `tests/four-seat.test.mjs`: 自動テスト7項目。3ゲーム各30シード、**合計90試合のロジック完走**。全員の順位、カード数、手番、再戦、非公開情報の境界を確認。
- `online/four-seat-lab.html`: 4人のローカル対戦を同じブラウザの4タブで試すためのGUI。**BroadcastChannelは同一originのテスト用途のみ**。
- `dev/verify_four_seat_browser.py`: Chromium/Playwrightで4個の独立ブラウザフレームを起動し、全員が入室→READY→ゲーム開始→各席が合法手を選ぶ→結果の一致→再戦ロビーを検証。srcdoc内でゲームロジックをインライン化するのでFirebaseや外部ネット接続を必要としない。実行例：
  ```bash
  node --test tests/*.mjs
  python dev/verify_four_seat_browser.py
  ```
- `online/oldmaid-authority.mjs`は先行の単体ババ抜き試作。**新たな修正と横展開の正本はfour-seat-authorityへ一本化**。古いコードは比較資料として保持。

## テスト結果（実行済み）
- Node.js `node --test tests/*.mjs`: **36件合格、失敗0**。
- ブラウザ検証（初回、4フレーム）: ババ抜き46手、七並べ49手、大富豪90手。各試合の順位が4画面で一致、再戦ロビーへ遷移、例外0。
- 新設した**再実行可能なGitHub収録スクリプト**から再実行（4フレーム）: ババ抜き38手、七並べ53手、大富豪95手、**全3ゲーム完走・JavaScript例外0**。乱数による配札差があるので操作数は試行で変わる。
- 一般的な800幅タッチ相当の画面も初回確認したが、これはChromiumであり、**学校iPad SafariやGoogle Sites本番を検証したものではない**。
- 90試合のストレステストで一度「常に左端しか引かない」ババ抜きが循環する事象に遭遇。乱数で引く通常のCOM操作に変えた90試合では決着した。固定位置引きは理論上の循環があり、対人戦の不正状態や無限ループと即断しない。必要なら局面制限を別途議論する。

## Firebase RTDB移植に必須のデータ分離
Firebase RTDBのアクセス権は**ユーザー単位の `auth.uid` とパス単位のSecurity Rules**で制御できる。浅い親パスで `.read: true` を付けると下層のprivateにもアクセス権が伝播するため、**ルーム直下を公開読み取りにしてはいけない**。

提案するトランプ専用の独立階層（既存の小国戦線/BRAWLとは混ぜない）：

```text
trumpRoomsV1/<code>/
  meta             { game, protocol, hostUid, phase, round, seats }
  public           publicView() のみ（全参加者閲覧）
  commands/<uid>/  そのuidの操作キュー（本人だけ追記、hostのみ読取）
  private/<uid>/   privateView(uid)（本人だけ読取、hostのみ更新）
  presence/<uid>/  接続・切断時刻
```

### 必須の認証と書込チェック
1. Firebase Anonymous Authenticationなど、学校で**ログイン操作なし**にUIDを発行できる認証方式を確認（匿名認証の有効化設定が必要）。
2. RTDB Rulesで**private/`$uid`は `auth.uid === $uid` の本人だけが読める**ようにする。コマンドは本人UIDでしか書けないようにし、ホストが送信UID・既存席・手番・リビジョンを照合する。
3. 他人の部屋コード、他人の手札、他人のコマンド、状態巻き戻し、2重入室、ホスト変更、途中離脱へのテストをFirebase Emulatorで実施してから実接続する。
4. 5桁の部屋番号は入室識別子であり**本人認証・秘密キーではない**。試作の `actor` 文字列は任意変更可能なので、これだけを根拠に手札や操作を許可しない。
5. 直接Firebaseの既存本番DB Rulesを書き換えない。まず隔離したemulatorまたは新しい名前空間でRulesの許可／拒否を検査し、他ゲームの稼働に影響しないことを確かめる。
6. publicに全手札・乱数seed・山札・秘密のペアを送らない。ホストはロジックを持つので身内用ホスト権威方式にはホスト側の不正対策の限界がある。厳格な公平性が必要ならサーバー側判定を別途検討。

参照（2026-10-25閲覧）：[Firebase RTDB rules conditions](https://firebase.google.com/docs/database/security/rules-conditions)、[Firebase Authと所有者ルール](https://firebase.google.com/docs/rules/basics)、[Firebase Security Rulesの継承動作](https://firebase.google.com/docs/rules/rules-behavior)。

## 現時点の未実装・未確認
- **Firebaseへの実接続、Rules/Authの設定、別端末4人対戦は未実装**。Node/Chromiumの4フレーム成功を「Firebase4人対戦成功」と表現しない。
- 4人用GUIは開発検証向けの簡易表示。通常のv1.5.5ゲームUIとは未統合。
- 現行の神経衰弱の別端末版はSupabase試作として別途動作。既存4ゲームのCOM版、GitHub Pages通常版、学校Google Sites版は変更していない。

## 次の開発順序
1. Firebase専用隔離名前空間と匿名認証・セキュリティRulesのエミュレータ検証を作る。
2. ゲストの個人手札の読み取り・ホスト操作受理を、複数クライアントで模擬する。通信断・逆順・古いコマンド・二重押しも試す。
3. 4人用UIを現行トランプコレクションUIへ段階的に統合し、各ゲームのCOMモードは残す。
4. 自己検証が通って初めて試遊URLを作成し、本人の実機検証は最終ゲートにする。

## Phase 4進捗（2026-10-25、追記）

- 学校実績からFirebase RTDBを第一候補に選定。外部CDN不要のFirebase Anonymous Auth/RESTアダプター `online/firebase-room-store.mjs` と4席のホスト・ゲスト進行制御 `online/firebase-room-controller.mjs` を開発。
- Firebase専用のアクセス制御案 `firebase/trump-rooms.rules.json` を作成し、模擬環境で手札の本人制限・public/privateのリビジョン同期・入力重複・接続中断復旧等を検証。
- Node全**48テスト合格（失敗0）**。Firebaseの追加テストはREST/Authモックと4人通信の疑似実装であり、**実Firebase EmulatorでRulesが正常に働くことは未確認**。
- **警告：Rulesは完全な単体JSON。既存Firebaseへファイル全体を適用すると、他ゲームのRulesを消す危険がある。上書き禁止。** 検証方法は [Firebase README](../firebase/README.md) に記載。
- 本人による頻繁な試遊を求めず、AIの自動テストを先行する。完成版の学校Safari検証以外で実機依頼を繰り返さない。
