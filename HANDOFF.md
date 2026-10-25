# 引き継ぎ資料 — トランプコレクション

## 2026-10-25｜Phase 13：共有Firebase接続先の対応（最新）

オーナーが既存Firebaseの再利用を希望。**以前の『別プロジェクト必須』ガードは撤回し、既存の `mygame-df915` の正しいデフォルトRTDB URLも設定形式として受け付ける実装へ更新**。`online/firebase-dedicated-guard.mjs` は互換ファイル名のまま `validateFirebaseConfig` を公開（旧名はエイリアス）。`dev/check-firebase-config.mjs` と単一HTML／統合ランチャーも対応。別DBへの向け間違い・偽装URLを拒否。

**重要：現行Firebase本番Rulesは未取得であり、共有を安全と承認したわけではない。** Firebaseのプラグインは登録されているが、このチャットから現在のRulesを取得する操作は利用できなかった。Firebase公式のRules REST取得には認証済みの管理権限が必要。現Rulesの現物レビュー、既存Rulesの保持、Emulator検証を経てから本番を接続する。Web UIへAPIキーや接続先を埋め込んだり、本番Rulesを変更したりはしていない。


## Phase 12｜既存Firebase共有のオフライン合成・実エミュレーター検証（2026-10-25）

**君の方針に合わせ、新規Firebaseプロジェクト必須案は撤回。既存Firebase再利用を第一候補にする。** [共有手順](firebase/SHARED_DATABASE_RULES.md) / [実行成功したActions](https://github.com/8mahi8/trump-collection/actions/runs/40180826430)。Node**84/84**、共有合成したサンプルRulesで**旧ゲームの権限維持＋トランプのprivate手札隔離＋3ゲーム4人対戦完走**をFirebase Auth/RTDB Emulatorで確認。合成ツール`dev/merge-existing-firebase-rules.mjs`は本番のルート許可・ワイルドカード・既存トランプパスを拒否し、旧Rulesを消さない。**最重要未完了：本当に使っているFirebaseの現行Rulesを取得していない。サンプルテストの合格では本番を保証できない。** `online/firebase-dedicated-guard.mjs`は従来の専用Firebase限定のまま。ライブRules監査後に共有用へ変更。現行BRAWL・小国戦線のRules／DB／Google Sitesと、main／COM版は一切未変更。



## 2026-10-25｜Firebase運用方針の見直し（最新）

**オーナー意向：新規Firebaseを作るより、他の学校ゲームで既に使っているFirebaseの再利用を優先する。** 新規Sparkプロジェクトを作ることは必須条件ではない。トランプ用データは`trumpRoomsV1`という独立パスで管理する。既存ゲームの本番データとアクセス権は変更しない。

**実行前の重要ゲート**：既存Firebaseの現在適用されているRealtime Database Security Rulesを読み取ってバックアップする（GitHubのテスト用Rulesを本番ルールと混同しない）。ルートまたは祖先に広い`.read`/`.write`許可がある場合、子パスで非公開手札を守れないため、そのまま共用してはいけない。安全な場合のみRulesを合成してFirebase Emulatorで旧ゲームへの影響を検証する。Rulesは既存全文を一括上書きしない。現在の実Rulesをまだ確認できていないので本番接続／デプロイは未実施。

**過去のPhase 10『別プロジェクト必須』は撤回。** `online/firebase-dedicated-guard.mjs`は現時点で別プロジェクトを要求する旧設計のままなので、実Rules検証を経て共有運用に対応させる。ユーザーへの不要な新プロジェクト作成依頼をしない。


**最新Phase 11（2026-10-25）：Firebase REST通信の無駄を減らす改善を完了。** [詳細](docs/ONLINE_TRAFFIC_PHASE11_2026-10-25.md) / [CI成功](https://github.com/8mahi8/trump-collection/actions/runs/40178100590)。Node**79/79合格**。承認済み席GETのキャッシュ、ロビー／終了後の低頻度ポーリング、通信失敗のバックオフを追加。対戦中のホスト／手番の650ms間隔は維持。Firebase実エミュレーターのババ抜き・七並べ・大富豪4人対戦、Chromium4画面の同期・通信断復帰・退出もすべて成功。**実Firebase本番は未接続／学校Google Sites版は未変更**。通信量の実測削減率は未計測。再読み込み復元不要の方針を維持。


**最新Phase 10（2026-10-25）：他ゲームのFirebaseへの誤接続を防ぐ事前検査を実装・テスト成功。** [専用Sparkプロジェクト手順](firebase/DEDICATED_SPARK_SETUP.md) / [成功したGitHub Actions](https://github.com/8mahi8/trump-collection/actions/runs/40176489466)。Node**73/73**、Chromiumで4ゲーム×COM/友達8入口成功、実Auth+RTDBエミュレーターで4人対戦3ゲーム完走・切断復旧・退出も再確認。新規`online/firebase-dedicated-guard.mjs`で`trump-collection-...`専用プロジェクトIDとdefault RTDBのURL整合性を確認し、接続不一致ならFirebaseへの匿名ログイン前に拒否。設定確認CLIは`dev/check-firebase-config.mjs`（ローカル文字列のみ、ネットワーク・デプロイなし）。**本番Firebaseの新プロジェクト作成も接続もまだ行っていない**。学校版・既存FirebaseのRules・公開COM版は未変更。


**最新Phase 9（2026-10-25）：COM4ゲーム＋友達対戦4ゲームの入口を1つに統合した開発用単一HTMLを実装。** [Phase 9詳細](docs/ONLINE_COLLECTION_PHASE9_2026-10-25.md) / [GitHub Actions検証成功](https://github.com/8mahi8/trump-collection/actions/runs/40175410131)：Node67/67、Chromium4ゲーム×2モード計8入口合格。Firebase実エミュレーターで4人ゲーム3種の完走テストも継続合格。生成器`dev/build-collection-lab.mjs`、開発用単一HTML`dist/trump-collection-integrated-lab.html`（CI artifactとして保存）。**Firebase本番3ゲームはまだ未接続**、神経衰弱は既存Supabase公開Broadcast試作。学校Safari／Google Sitesは変更・実機検証していない。再読み込み後の復元は不要とのオーナー確定方針を維持。


**最新Phase 8（2026-10-25）：身内用の退出・部屋作り直し機能を実装／実Firebase Emulator＋4画面Chromiumで検証成功。** [引き継ぎ資料](docs/ONLINE_EXIT_PHASE8_2026-10-25.md) / [成功したGitHub Actions](https://github.com/8mahi8/trump-collection/actions/runs/40173923212)。Node64/64。ホストの終了・参加者の退出要求を正しいUIDで処理し、全員がメニューへ戻って新しい部屋を作れる。**再読み込み後の対局復元はしない**。Firebase本番接続・学校Google Sites版は未実装／未変更。


## 2026-10-25 オーナー確定：再読み込み復元は不要

**友達同士で学校の短時間に遊ぶため、ページ再読み込み／タブ終了後に同じ対戦・同じ席へ復元する機能は開発しない。** 以前の「未対応」「次の候補」といった記述よりこの確定方針を優先。ホストの秘密状態バックアップ、匿名UIDの永続化、複雑なホスト引継ぎも対象外。

- ページが開いている間の一時通信断：既存のheartbeat停止／安全な再同期を維持。
- ページを更新・終了した場合：新しく部屋を作って遊び直す。
- ホスト終了時：固まらずに分かりやすい案内と新しい部屋を作る導線を優先（導線は未実装）。
- 開発優先：Firebase本番接続の安全な準備 → 4ゲームのオンライン統合 → UI・操作性 → ゲーム追加。テストは基本的にAI担当。
- 通常版と学校Google Sites版は明示的な了承なく変更しない。


**最新Phase 7（2026-10-25）：ホストUIDのheartbeatによる一時通信断検知＋復帰を開発ブランチへ実装**。約15秒止まればゲストの操作を禁止し、復帰したら同期再開。[詳細](docs/ONLINE_RECOVERY_PHASE7_2026-10-25.md) / [実Firebase Emulator＋Chromium4画面の成功記録](https://github.com/8mahi8/trump-collection/actions/runs/40170975967)。Node60/60。**ページ更新後のUID/ホスト秘密状態復旧は未実装**。本番Firebase、学校Safari/Google Sites、通常版COMは未変更。


このファイルは、開発を引き継ぐ人（AI・人間を問わない）のための正本です。
まずこのファイルと `README.md` を読み、`docs/` の調査メモが設計判断の背景になります。

- リポジトリ: `8mahi8/trump-collection`
- 通常版URL（GitHub Pages、main の index.html）: https://8mahi8.github.io/trump-collection/
- v1.5.5 専用試遊URL（main に **個別HTMLのみ**追加、通常版は不変）: https://8mahi8.github.io/trump-collection/preview-v1.5.5.html
- Phase 2の別端末オンライン試作URL（同様にmainの別ファイルのみ追加）: https://8mahi8.github.io/trump-collection/preview-online-memory-remote.html
- 詳細な通信構成・テスト・限界: [ONLINE_REMOTE_PHASE2_2026-10-25.md](docs/ONLINE_REMOTE_PHASE2_2026-10-25.md)
- **4人用の最新コード・テスト・Firebase移行方針**: [FOUR_SEAT_PHASE3_2026-10-25.md](docs/FOUR_SEAT_PHASE3_2026-10-25.md)。再実行 `python dev/verify_four_seat_browser.py`。
- **Phase 6：4人オンラインGUI＋単体HTML＋Chromium4画面検証**：[docs/ONLINE_UI_PHASE6_2026-10-25.md](docs/ONLINE_UI_PHASE6_2026-10-25.md)。[成功CI](https://github.com/8mahi8/trump-collection/actions/runs/40166268484)、Node56/56合格、ババ抜き・七並べ・大富豪の4画面で入室・READY・開始・1手同期成功。独立したHTMLでGoogle Sites貼付けに向けた単体構成を生成済み。**Firebase本番設定は未実施、学校版は未変更。**
- **Firebase Auth・RTDB実エミュレーター検証（Phase 5）**: [firebase/README.md](firebase/README.md)。[GitHub Actions成功](https://github.com/8mahi8/trump-collection/actions/runs/40158460489)。Node52/52合格、Firebase Local Emulator SuiteのAuth+RTDBで4人対戦3ゲーム完走（ババ抜き28手・七並べ52手・大富豪97手）。**本番Firebaseと学校Safariは未検証**。


- 開発ブランチの版: **v1.5.5**（main の公開版は v1.4.0）（`index.html` 内の `TC_VERSION` が版の正本。メニュー下部にも表示）
- 状態（2026-10-25更新）: v1.5.5のCOM4ゲームは試遊済み。**神経衰弱2人版は本人がPCとスマホの別端末でSupabase実通信試遊に成功**。**4人版（ババ抜き・七並べ・大富豪）はFirebase実エミュレーターでロジック全試合完走・Chromium4画面のUI同期検証成功。本番Firebaseは未接続**。
- **今後の計画の正本**: [オンライン・カードゲーム拡張ロードマップ](docs/ROADMAP_ONLINE_AND_CARD_GAMES_2026-10-25.md)。この方針はユーザーが2026-10-25に明示した。

## このプロジェクトの前提（変えないこと）

- 学校の iPad（Safari）で、友達と休み時間に遊ぶためのブラウザゲーム集。
- インストール・ログイン不要。横向き・タッチ操作中心。1ゲーム短時間で終わる。
- **既存カードゲームをここへ継続追加**する。現在の4つで完結しない。既存4ゲームも最終的に友達同士のオンライン対戦へ対応する。
- オンラインの操作は従来の開発ゲームと同様に「ルーム番号を作る→友達が参加→開始」。ゲーム選択と人数（2人／4人）はルーム内で共通化。
- **現段階**: 神経衰弱はSupabase実端末試遊済み。4人用Firebase Auth/RTDBアダプター、プライベート・パブリック分離とホスト/ゲスト操作制御を実装してモック試験済み。**Firebase実エミュレーター上のRules検証は成功、本番Firebaseへの実接続は未完了**。学校Safari・Google Sitesは未検証。通常COM版・Google Sites版は変更しない。
- 正式な配布経路は **Google Sites への単体HTML貼り付け**（`dist/trump-collection.html` の中身を貼る）。GitHub Pages は試遊用。
- 素材はすべて自作のみ。既存ゲームの名称・デザインの流用は不可（例: UNO は名称・デザインが使えないため不採用という判断済み）。

## ハード制約（Google Sites 埋め込みのため）

- `dist/trump-collection.html` は **外部読み込みゼロ**（フォント・ライブラリ・画像すべて埋め込み or CSS/SVG描画）。
- 上の「外部読み込みゼロ」は**現行オフラインCOM版の要件**。オンライン対戦にはFirebase等のバックエンド通信が必須であり、外部サービスへの通信を禁止する意味ではない。外部JSライブラリへの依存は可能な限り避け、オンライン試作でGoogle Sites/Safariの動作を検証する。
- **localStorage / sessionStorage を使用しない**（Sites の埋め込み iframe では保存が効かない前提で設計）。
- 音に依存しない（学校で無音プレイが前提）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | UI のすべて（CSS・画面描画・操作・BOT進行・アニメーション）。`games.mjs` を `import * as G` で読み込む |
| `games.mjs` | ゲームロジックの正本。状態生成・合法手の列挙・手の適用・COM思考。DOM に一切触れない純粋なモジュールで、Node でテスト可能。乱数は生成関数の引数（rng）で注入する設計 |
| `tests/games.test.mjs` | ロジックの単体テスト（8件）。`node --test "tests/*.mjs"`（当時は既存29件＋4席共通7件＝36件、現在は追加テスト込み計60件） |
| `build-embed.mjs` | `games.mjs` を `index.html` にインライン化し、`const G = {...}` の shim を生成して `dist/trump-collection.html` を出力する |
| `dist/trump-collection.html` | Sites 貼り付け用の単体ファイル。**直接編集しない**（`index.html` と `games.mjs` から生成する） |
| `dev/verify.mjs` | 検証パイプライン（後述）。前任環境のツールを同梱したもの |
| `docs/research-*.md` | ルール・カード選択UI・カード品質の外部調査メモ（設計判断の根拠） |
| `verify-shots/` | 検証時のスクリーンショットと基準画像（`.gitignore` 対象、リポジトリには入らない場合がある） |

## 開発の基本手順

```bash
node --test "tests/*.mjs"   # 1. ロジックのテスト
node build-embed.mjs        # 2. 単体ファイルを再生成（index.html / games.mjs を触ったら必須）
node dev/verify.mjs         # 3. 総合検証（テスト→ビルド→通しプレイ→スクショ→基準差分）
```

- `index.html` だけ直して `dist` を作り直し忘れるのが一番多い事故。push 前に必ずビルドする。
- 変更は小さく分けず、**1周分の変更をまとめて1回の push** にするのがオーナーとの約束（push の承認負担を減らすため）。

## 検証用フック `window.TC`（index.html 内に常設）

画面の見た目に依存せず、状態と操作を直接扱うための窓口。自動プレイ・回帰確認はこれ経由で行うこと（DOM スクレイピングは表示変更のたびに壊れた実績あり）。

| API | 内容 |
|---|---|
| `TC.version` | 版文字列（= `TC_VERSION`） |
| `TC.state` | 現在のゲーム状態オブジェクト（`games.mjs` の状態そのもの） |
| `TC.game` | 現在のゲームID（`babanuki` / `shichinarabe` / `shinkei` / `daifugo`） |
| `TC.start(gameId)` | ゲーム開始（設定モーダルがあるゲームは自動で開始ボタンを押す） |
| `TC.legal()` | プレイヤーの合法手をカードIDの配列の配列で返す（大富豪は組み合わせ単位） |
| `TC.act(action)` | 手を打つ。`{type:'play', ids:[...]}` / `{type:'pass'}` / `{type:'draw', index}` / `{type:'flip', pos}` |
| `TC.setFast(bool)` | BOT の待ち時間を 780ms ↔ 110ms に切り替える（検証用） |

`dev/verify.mjs` はこのフックで全4ゲームを結果画面まで通しプレイし、ページエラー 0 を確認する。実行には Node 20+ と puppeteer-core + Chrome が必要（前任環境では環境変数 `VERIFY_TOOLS_DIR` と `CHROME_PATH` で解決していた。無い環境ではスクショ/通しプレイ工程を外して単体テスト＋ビルドだけでも回すこと）。

## 収録ゲームの仕様（実装済みの確定事項）

### ババ抜き（4人: プレイヤー＋COM×3、53枚）
- ペアは自動で捨てる。隣のCOMの裏向き扇からタップ（または指なぞりウェーブ）で1枚引く。
- ジョーカーを最後まで持っていた人が負け。

### 七並べ（4人、53枚）
- 7は最初から場に配置。先手は ♦3 の保持者。
- パスは3回まで。4回目で脱落し、手札は保留プールに入り、場に隣接したら自動配置される。
- 操作は「選ぶ→『出す』ボタンで確定」の2段階（下記 UI 仕様参照）。

### 神経衰弱（2人: プレイヤー vs COM、24枚 = 数字1–6 × 4スート、6×4 配置）
- COM の記憶力は3段階（よわい／ふつう／つよい）。記憶容量＋忘却で調整。

### 大富豪（4人、53枚）
- ローカルルールは設定モーダルで個別 ON/OFF、**デフォルトは全部 ON**: 8切り／革命／スート縛り／スペ3返し（♠3単体がジョーカーに勝つ）／イレブンバック／反則上がり（反則で上がると最下位）／献上。
- 献上は継続対戦時のみ: 大貧民→大富豪へ2枚、貧民→富豪へ1枚。自動で「最強を渡し最弱を受け取る」交換。結果画面の「次のゲームへ（献上あり）」から継続。
- COM はルールベースのヒューリスティクス（最弱の勝ち組み合わせ優先、2とジョーカー温存、手札が弱いとき革命狙い、反則上がり回避）。
- 手札は強さ順ソート＋同じ数字を寄せて表示。

## UI・操作の確定仕様（オーナーの決定。勝手に変えない）

- **カードを出す操作は全ゲーム「タップで選ぶ → ボタンで確定」の2段階に統一**（七並べも大富豪も同じ）。誤タップで勝手に出ないようにするため。
- 選択中のカード: 大きく持ち上がる（-38px + 拡大）＋金色の枠と光＋✓バッジ。選択していないカードは少し暗くする。
- 選択中は理由つきプレビューを常時表示（「出せる！」「場は2枚。2枚で出してね」「同じ数字でそろえてね」等、出せない理由も出す）。出せないカードをタップすると赤く震える。
- **指なぞりウェーブ**: 手札の上で指を滑らせると、触れたカードを中心に波状に持ち上がる（余弦減衰）。選択はタップで行い、選択済みのカードは上がったまま。
- カードの見た目: 実物準拠。数字カードは標準ピップ配置（下半分は反転）、Aは大きな単スート、J/Q/Kは絵札フレーム、角インデックスは左上＋右下（回転）。**ピップと角の数字・マークが重なって読めなくなる事故が起きたことがある**ので、ピップ配置と角インデックスの干渉には特に注意（拡大スクショで確認する）。
- カードサイズはビューポート連動（CSS変数 `--cw`）。スマホ横向き（高さ不足）では相手の裏向きカード列を隠す等の圧縮モードに入る。手札の重なり幅は実寸測定して画面幅に収める。

## 未確認事項（済んだことにしない）

- 学校 iPad 実機 Safari での動作・操作感は未確認（オーナーの担当）。
- Phase 2の自動ブラウザ試験は模擬WebSocket経由。**その後、本人が実Supabase経由でPC＋スマホの対戦に成功**。学校端末の試験は未完了。ルーム番号は認証ではなく、公開Broadcastを正式版として扱わない。
- Google Sites に実際に貼った状態での動作は未確認（技術的には外部読み込みなし・localStorage 不使用で抵触しない見込み）。
- GitHub Actions の workflow ファイルは、連携アプリの権限では設置できず未設置。置く場合は `.github/workflows/test.yml` に以下の内容で作成する:

```yaml
name: tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node --test tests/games.test.mjs
```

## 残タスク・今後の候補

- **COM の強さの最終調整（特に大富豪）**: オーナーの実プレイ感想待ち。BOT対戦シミュレーションの数値だけで決めないこと（オーナーは数値より実プレイの体感を重視する）。
- 追加候補ゲーム: ダウト、スピード。
- **友達とのオンライン対戦は最優先の必須開発事項**。神経衰弱の遠隔Supabaseは試遊済み、4人用3ゲームは共通ルームのローカル動作と全試合自動完走済み。次はFirebase匿名認証・RTDB Rulesの非公開手札配送と実通信。
- 新しいカードゲームの継続追加も確定方針。新たなルールの候補は大富豪の追加ローカルルール、ダウト、スピード、ポーカー、戦争、ぶたのしっぽなど（具体的な優先順位とルールは今後決定）。
- アバター等の他プロジェクトの話はこのリポジトリの範囲外。

## オーナー（真大）との進め方

- 試遊は基本的にAI自身のNode/Playwrightテストを先行させる。オーナーは毎回の試遊を負担に感じているため、日常の確認を要求せず、学校Safari・Google Sitesの最終試験だけ必要に応じて依頼する。
- 完成の定義: 実装 → 機械的レビュー（テスト/ビルド/通しプレイ） → 人間目線の品質確認（見た目・気持ちよさ・既存のちゃんとしたゲームと比べて恥ずかしくないか） → 直しをループ → 外部資料と照らして「人に見せられる」と判断できて初めて試遊を頼む。
- 未確認のことを確認済みのように言わない。README の未確認事項は正直に保つ。


## 2026-10-25 オンライン基盤Phase 1（実装済み・本番未接続）

[オンライン開発レポート](online/README.md)が詳しい正本。神経衰弱2人用のホスト確定ルーム、非公開伏せ札を送らないview、古い操作・重複ID・手番違い拒否を開発。BroadcastChannelで同じoriginの2タブ同期（READY/START/1枚と2枚の公開と伏せ直し）をChromiumで確認。700×320横向きは12列×2段で画面内に収めた。Supabase private Broadcast transportアダプターはモック済みだが実DB/Auth/RLSとは未接続。新規10件を含むNode計30件合格。通常ゲームのGitHub Pages main/index.html・Google Sitesは変更なし。

[専用2タブ試遊](https://8mahi8.github.io/trump-collection/preview-online-memory-lab.html)は**別端末間の実オンライン対戦には対応していない**。次は隔離したバックエンドの権限設計と、本物の2端末での通信検証。

## 2026-10-25｜Firebase Local Emulator 成功（最新）

- 自動化ファイル：`.github/workflows/firebase-emulator-ci.yml`、隔離用`firebase.emulator.json`、`tests/firebase-emulator.e2e.mjs`。
- 旧Mockだけでなく、Firebase EmulatorのRules本体を使って匿名Auth＋RTDB4人対戦。実際に他人のprivate/commandsを拒否し、3ゲームを最後まで実行・再戦に成功。
- **席の正本は`privateView.seat`**（UIDやクライアントの参加順から推測しない）。REST条件付きコマンドのため本人だけが自分の`commands/$uid`を読めるRuleに変更。他人のキューの読取は拒否。
- 既存の学校版・main / v1.5.5は変えない。Firebase本番への反映は禁止、専用実接続試作と学校検証は後続工程。

## 2026-10-25｜Phase 6最新状況

- 対戦用のHTML: `online/four-seat-remote.html`（Firebase認証・通信付きの研究版）と`dist/trump-collection-online-lab.html`（外部JS/CDNを必要としない54KBの単体HTML）。開発用で実Firebase設定なし。
- 検証: `tests/online-html-build.test.mjs`・`dev/verify-online-browser.mjs`。GitHub ActionsのChrome4画面×3ゲーム同期成功。当時Node56/56・Firebase実エミュレーター3ゲーム完走も確認。正式CI: https://github.com/8mahi8/trump-collection/actions/runs/40166268484
- 残る重要問題: **ページ更新後の元の席への復帰、ホストの完全復元、ルーム掃除、実Firebase本番設定／権限確認、学校Safari／Google Sites実機**。
- ユーザー本人へ途中テストを何度も頼まない。通常COM版v1.5.5・main v1.4.0・Google Sites版は保護。
