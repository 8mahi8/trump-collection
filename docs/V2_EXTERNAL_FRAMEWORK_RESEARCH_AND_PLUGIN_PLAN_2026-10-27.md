# V2設計調査｜新しいゲームを追加するたびにアプリを作り直さない（2026-10-27）

## なぜこの設計を選んだか
2026-10-27 学校実機で「重い」「神経衰弱が繋がらない」「COMとオンラインのUIが別物」と判明した。指摘は**ゲームごとの画面／機能を個別実装する方法そのものが非効率**ということ。そこで既存フレームワークの公式資料を確認し、UI・通信・ゲームロジックを切り分けた「ゲーム定義のプラグイン方式」を採用した。

### 調査した公式資料と取り込む要素

| 資料 | 分かった設計要素 | 本プロジェクトでの判断 |
| --- | --- | --- |
| [boardgame.io Concepts](https://boardgame.io/documentation/) / [Game tutorial](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/tutorial.md) | ゲーム定義は **state + moves + phases + turn**。共通Client/Multiplayer基盤へ渡し、ゲームごとに通信UIを作り直さない | **設計を強く採用**。「ゲーム登録」単位でルールと合法手と盤面アダプターを閉じ込める。ライブラリ自体はまだ採用しない |
| [boardgame.io Multiplayer](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/multiplayer.md) | サーバーに権威を持たせる。クライアントはmoveを送る設計 | 共通`SessionController`とroom authorityを採用する。既存のホスト権威処理は再利用 |
| [Colyseus State Synchronization](https://docs.colyseus.io/state) | サーバーがstateを変更してクライアントに**変更部分（差分）**を同期する | 通信量・再描画回数を測定し「必要な変更だけ」を伝える思想を採用。Nodeの常駐サーバーは学校Google Sites直接埋込＋無料運用と相性が悪いため今回は採用せず |
| [Board Game Arena Studio](https://en.doc.boardgamearena.com/Development) | ルール・プレイヤー操作・状態遷移・画面UIを個別の責務に分離する | 4ゲーム共通のカード表示、操作バー、ルームUIを作り、固有の盤面表示だけゲームpluginが拡張 |
| [Firebase RTDB Web onValue](https://firebase.google.com/docs/database/web/read-and-write) | 変更時イベント受信ができ、対象パスは必要最小限に限定する | 現行の多数のREST GETの代替候補。学校SafariでWebSocket等が使えるか未確認であるため、SDKを入れれば必ず軽くなるとは決めつけない |
| [Firebase REST Streaming SSE](https://firebase.google.com/docs/database/rest/retrieve-data) | REST endpointがSSEストリーミングに対応 | 学校ネットワークで実測する第二候補。長時間接続が遮断される場合は軽量なHTTP pollingへfallback |

**採用判断：自前の軽量 plugin core＋ビルド一体型HTML、通信アダプター切り替え、最小DOM更新**。外部ライブラリを全面導入すれば多くの機能が再実装不要になる利点はあるが、今の「サーバー常駐なし・学校のGoogle Sitesのコード埋め込み・無料・短時間」条件でそのまま動くとは限らない。新しいバックエンドへ全面依存する前に、低コストの差し替え可能な設計を優先。

## V2で確定する3層（何度も別アプリを作らない）
```text
             共通 GameShell (1つのHTML / 1つのDOM)
 ┌─────────────────────────────────────────┐
 │ ゲーム選択  /  部屋番号  /  Ready  / Chat │  ← どのゲームでも共通
 │ 共通カード盤面 / 自分の手札 / アクション    │  ← CPU/対人でも同一
 │          ゲーム固有BoardSurface          │  ← 必要な箇所だけ拡張
 └──────────────────┬──────────────────────┘
                    │ 共通 ViewModel / Action
      ┌─────────────▼──────────────┐
      │   GameRegistry / Plugins   │
      │ ババ抜き / 七並べ / 神経衰弱 │
      │ 大富豪 / ...将来の5本目      │
      └─────────────┬──────────────┘
                    │共通 GameStateの操作
  ┌─────────────────▼─────────────────┐
  │  Session: CPU / local / online    │
  │  Online Network: Firebase adapter│
  │    + Auth / Fallback / Metrics    │
  └───────────────────────────────────┘
```

## 実装済（Phase V2-0b）
- `v2/core/game-registry.mjs`：重複・欠落・不正ID・座席数・アクション・リモートhookを検査する拡張可能Registry。共通側にゲーム名の分岐を増やさない。
- `v2/games/definitions.mjs`：4ゲームを **id / label / seats / boardKind / actions / createLocal / localBoard / localLegal / localHand / localCounts / optional remoteBoard, remoteLegal** として定義。ルールは既存`games.mjs`の検証済み関数へ委譲。
- `v2/core/unified-view.mjs`：**ゲーム名のif/switchをゼロにして、登録済み定義に処理を委譲**。CPUとFirebase公開/自分専用の状態を同じViewModelへ。
- `tests/v2-game-registry.test.mjs`：**架空の5本目`example-game`を登録して共通CPU/remote projectorがそのまま動く**、既存4ゲームの登録可否、重複・hook不備のエラーを検証。既存`tests/v2-unified-view.test.mjs`でも4ゲームの動作互換を維持。
- **[最新のV2 CI結果](https://github.com/8mahi8/trump-collection/actions)**：Node全体自動テストで旧版ルールと新登録方式を並行検証する。学校公開HTMLや既存校内ゲームへは未反映。

## 新規ゲーム制作で増やすもの
ゲームごとに1つのルール定義（`v2/games/<new-game>.mjs`等）と、必要なら固有の盤面Surfaceを1つ追加するだけに近づける。**新しいHTMLページ、COM画面、オンライン画面、独立した部屋・チャット・通信ロジックは増やさない**。以下が宣言的な拡張点：

```js
registry.register({
  id:'newgame', label:'新作', seats:2, boardKind:'grid',
  actions:['select','pass','rematch'],
  createLocal:seed=>createNewGame(seed),
  localHand:(state,seat)=>state.hands[seat],
  localCounts:state=>state.hands.map(x=>x.length),
  localBoard:state=>({kind:'grid', cells:state.cells}),
  localLegal:(state,seat)=>legalMoves(state,seat),
  remoteBoard:pub=>({kind:'grid',cells:pub.cells}),
  remoteLegal:(pub,priv)=>priv.legal
});
```
これは説明用の概略。実装時は登録規約に沿う合法手`drawIndices/playIds/playMoves/flipIndices/canPass`を返す必要がある。**将来的にはアクションschema自体も拡張可能にする**。

## まだ終わっていないことと品質ゲート
- **共通UIの実装は未完**。`index.html`（COM）と`online/four-seat-remote.html`（対人）が今は別レンダラーである点はそのまま。Registry/共通ViewModelが完成しても**UI同一化が完成したとは言わない**。
- **ルールエンジン自体はまだ`games.mjs`に4ゲームが同居**。段階的に各プラグイン定義内へ分離する。単純なファイル分割そのものより、ゲーム追加の影響範囲を限定することが目的。
- **神経衰弱は対人通信アダプター未移行**。学校ではSupabaseが動かなかったという本人の報告が最優先。既存Firebase本番Rulesや学校版は触らず、まず通信診断→2人用のFirebase room adapter実装。
- **遅さの原因は未実測**。通信回数／応答時間／DOM再描画時間／初回起動コストをブラウザ側で測り、少なくとも旧版比で明確な改善を確認する。
- **受け入れ条件**：ババ抜き1本のCPU＋オンラインで同じDOM/CSSを使って1試合完走 → 神経衰弱2人通信 → 七並べ・大富豪へ拡大 → 古いゲームと見た目・操作の一貫性を確保 → 学校のiPad実機で評価して初めて配布版へ昇格。
- **公開版の安全性**：現状のオープンなFirebase Rulesは本番の手札秘匿や改ざん耐性を保証しない。試遊用と本番品質を混同しない。期限2026-11-08 00:00 JSTは変更しない。
