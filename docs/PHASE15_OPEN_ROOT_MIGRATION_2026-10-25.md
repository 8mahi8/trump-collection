# Phase 15｜既存Firebaseルート公開Rulesから安全に共用するための準備

日付：2026-10-25。**作業対象は開発ブランチとローカルFirebase Emulatorのみ。実サービスには接続・書込み・デプロイしていない。**

## 現行ルールの扱い
- 2026-10-22の別ゲーム開発時に確認した全ルート期限付き `.read` / `.write` 設定が、**現在も変更されていない**とオーナーが2026-10-25に再確認。
- 期限は **2026-11-08 00:00 JST**。期間中にルートで許可されたread/writeは配下の子階層でも取り消せない。よって `/trumpRoomsV1/$room/private/$uid` のアクセス制御は、今の親Rulesを維持する限り成立しない（[Firebase公式](https://firebase.google.com/docs/database/security/core-syntax)）。
- この確認は**オーナーの証言と過去スクショ／記録**による。本チャットの管理者トークンを使った最新Rulesの再取得はしていない。追加スクショは要求しない。
- 現Rulesのまま本番トランプを開始しないこと。Web APIキー検査はRulesの安全性を保証しない。

## 他のゲームの参照パス（静的コード調査、網羅性未確認）
| ゲーム | 調査できたRTDBルート | 根拠 |
| --- | --- | --- |
| BRAWL 1vs1 | `/rooms` | `brawl-bot-playtest/online/ipad-duel-v2-lab.html` |
| BRAWL 2vs2 | `/rooms2v2` | `brawl-bot-playtest/online/ipad-squad-v2-lab.html` |
| 小国戦線III | `/shokokuRooms1v1` | `shokoku-sensen/online-net.js` |
| LEMON CLASH | `/lemonClashRoomsV1` | `lemon-clash` 開発ブランチ `dev/ipad-hand-ui` の `src/online-app.js` 定数 `ROOM_ROOT`、`src/firebase-config.js`、Google Sites向け候補。**shared-rtdb モードは匿名Authなしで通信するため、旧領域を auth 必須に変更すると壊れる** |
| トランプコレクション | `/trumpRoomsV1` | `online/firebase-room-store.mjs` |

**使用領域の参照を更新（2026-10-25）:** BRAWLの `sites/BRAWL_FRIENDS_1vs1.html` / `sites/BRAWL_FRIENDS_2vs2.html`、小国戦線IIIの `online-net.js`、LEMON CLASHの開発 `src/online-app.js` でルート名を実際に確認。LEMONの `firebase/lemon-clash-lab.rules.json` は匿名Authを要求する**隔離検証用**であり、既存共用モードの設定とは異なる。これを本番共用Rulesに無断投入しない。

**未確認の別ゲーム／別ブランチ／Google Sites実稼働版が追加パスを使う可能性あり。表を本番ルートの完全な目録と見なさない。**

## オフラインで実装した移行候補と拒否条件
- `dev/plan-open-root-migration.mjs`：期限付きで同一条件のルート `.read` / `.write` のみを入力として受け入れる。既知ルートを明示して、全ルートの許可を `false` に変更し、旧ゲームのルートだけ**元と同じ有効期限・元と同じread/write条件**を配る。トランプは既存の `firebase/trump-rooms.rules.json` のprivate/command分離を配置。
- 元ルールの構造が異なる、見知らぬルートキーがある、独立したread/write条件、重複・未知形式のルート名、トランプが公開状態のRulesなら**生成を拒否**。入力の元JSONは一切更新しない。
- 新規サンプル `tests/fixtures/open-root.example.rules.json` は**架空データ**で、本番のルールをコピーしたものではない。
- `--out` は**別の新規レビュー用ファイルの生成のみ**、上書き拒否。Firebaseの管理API呼出もdeploy処理もなく、本番Rules変更機能は存在しない。
- 出力の `productionApproved=false` は固定。追加されたパス以外を変更しないことと、既存の実稼働ゲームからルート読み書きがないことは、さらに調べる必要がある。

## 模擬検証の実行
```bash
node --test tests/plan-open-root-migration.test.mjs
node dev/plan-open-root-migration.mjs \
  --existing tests/fixtures/open-root.example.rules.json \
  --legacy-roots rooms,rooms2v2,shokokuRooms1v1,lemonClashRoomsV1 \
  --out dist/review-scoped-open-root.rules.json
npx --yes firebase-tools@15.30.1 emulators:exec \
  --project demo-trumpcards --config firebase.scoped-emulator.json --only auth,database \
  "node --test tests/firebase-scoped-emulator.e2e.mjs && node --test tests/firebase-emulator.e2e.mjs"
```
CI `.github/workflows/firebase-emulator-ci.yml`にも同じ新しい検証工程を追加。

**CI [#40197234549](https://github.com/8mahi8/trump-collection/actions/runs/40197234549) 成功**：Node **93/93**（失敗0）。架空ルート公開のスコープ移行Rulesで4つの旧ルートの匿名読み書き成功、ルート読み込み拒否、未知ルート書き込み拒否、他人のトランプprivate手札読み取り拒否。既存3ゲーム4人戦のFirebase Emulatorテストも完走、ブラウザ4画面の同期試験と8入口試験も合格。**本番のアクセス権が切り替わったという意味ではない。**

## 本番への未解決条件
1. 稼働中のGoogle Sites埋め込みコードと既存ゲームの使用パスを**全て**照合する（未知パスは許可しない候補のため、未網羅ならゲーム停止の危険）。
2. レビュー候補で既存ゲームの権限・挙動が維持されることをエミュレーター及び必要な実機で確認。
3. 旧ルートの期限はコピーするため **11月8日以降のアクセス停止リスクは残る**。別途、有効期限／アクセス設計をオーナーと決める。
4. Firebase Authentication匿名認証が既存プロジェクトで利用できるか、本番で確認（未確認）。
5. 旧Rulesバックアップ、差分レビュー、本人の明示承認までは**本番デプロイ禁止**。自動切替、ユーザーへの秘密鍵要求も行わない。
