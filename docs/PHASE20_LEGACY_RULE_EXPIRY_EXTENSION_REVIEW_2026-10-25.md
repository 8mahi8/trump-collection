# Phase20｜11月8日Firebase旧ルール失効への30日延長レビュー案

2026-10-25。**実際の `mygame-df915` Realtime Database、Auth、Rules、旧ゲームのデータ、学校Google Sites版、mainには一切変更していない。** この文書は**本番への適用指示ではなく、事前レビュー用**。

## 問題と選択した最小方針
本人が、現在のルート全体の期限付きRulesは以前と変わっていないと確認した。報告されたread/write条件はいずれも `now < 1794063600000`。**2026-11-08 00:00 JST** で失効する。何もしなければ旧ゲームの匿名読み書きもできなくなる可能性が高い。現行の親ルート公開権限のままでは、トランプの手札を非公開にできない（[Firebase公式](https://firebase.google.com/docs/database/security/core-syntax)）。

身内で遊ぶだけなので、旧ゲームの挙動を再設計せず、**30日だけ期限を延長するレビュー案**を追加。期限は **2026-12-08 00:00 JST**（Unixミリ秒値は `1796655600000`）。これは長期的な解決ではなく、学校テストまでの暫定候補。**11月8日の自動停止を放置しない一方、無期限の全公開もしない**方針。

## 2つのオフライン候補
- **従来案**：ルートread/writeを`false`にし、確認済み4旧領域`/rooms`、`/rooms2v2`、`/shokokuRooms1v1`、`/lemonClashRoomsV1`に**元の11月8日期限**の匿名読み書き許可を局所化。`/trumpRoomsV1`に既存の本人別手札アクセス制限。**旧ゲームは11月8日に停止し得る**。
- **今回の延長案**：ルートread/writeを`false`にし、同じ4旧領域だけ**12月8日期限**へ延長。トランプ領域の権限は既存のものを複製（独自の期限を追加しない）。未知の別領域は不許可。**旧領域は引き続き認証なしで読書き可能**なので、これは強固な防御ではなく身内向け暫定案。

## プログラムと拒否条件
既存 `dev/plan-open-root-migration.mjs` に任意引数 `--legacy-expiry-date 2026-12-08` を追加。指定時だけ、日付を**日本時間0時**として厳密に検証してからルートごとの期限を変更。

- YYYY-MM-DD以外、無効日付、元の期限以下の短縮・据え置き、**元の期限から90日を超える延長**は拒否。
- 想定していないRoot Rules、元のread/write条件の不一致、非公開でないトランプ用ルール、古い未知ルート名、重複パスは**従来どおり拒否**。
- 変更対象は**確認済み旧ルートのread/write条件だけ**。ルートはdeny、トランプ権限は改変しない。
- 元のRules JSONを変えず、別名の新規ファイルにのみ出力。同名への上書きは拒否。**deploy／管理者API接続／本番変更機能は存在しない**。
- 関数の結果は `productionApproved:false`、`liveRulesVerified:false`、`allLegacyRootsVerified:false` のまま。

### 完全にローカルでの再現（例のJSONは本番から取得したものではない）
```bash
node dev/plan-open-root-migration.mjs \
  --existing tests/fixtures/owner-reported-open-root.example.rules.json \
  --legacy-roots rooms,rooms2v2,shokokuRooms1v1,lemonClashRoomsV1 \
  --legacy-expiry-date 2026-12-08 \
  --out dist/review-scoped-open-root-extended.rules.json
```

`owner-reported-open-root.example.rules.json`は本人の報告と同じ**ルール形状と期限のテスト用合成データ**。Firebase Consoleの現行本番Rulesをダウンロードしたものではない。検証用`firebase.extended-emulator.json`と既存`firebase-scoped-emulator.e2e.mjs`、4人ゲーム全体をFirebase Auth/RTDB Emulatorで走らせるCIを追加。

## 実適用までの未解決条件
1. Firebase Consoleで対象プロジェクトと現行Rulesを**本人管理下で改めて特定**し、旧Rulesのバックアップを用意する。本チャットでは再度同じスクリーンショットを要求しない。
2. **実際のGoogle Sites版**や他ゲームのDB書き込みルートが4つで網羅されるか確かめる。もし追加ルートがあればこの候補をそのまま適用するとそのゲームが停止する。
3. トランプで必要なFirebase Authentication匿名ログインが利用できるか確認する。既存のBRAWL/小国/LEMONは認証なしで動く領域を保つ。
4. 日付延長・権限局所化の副作用、誤配置のリスクを理解した上で、**本人が本番ルール変更を明示的に承認する**。本番適用と学校での検証、巻き戻し方法の確認はその後。

CI合格・本稿の存在は本番接続完了もリリース承認も意味しない。
