# トランプコレクション V2｜5本目の実装で拡張契約を実証（2026-10-29）

## 今回の目的と範囲

4ゲームの共通化が「見た目だけの共通化」で終わっていないか、**本物の第五ゲームを一つ追加し、ルール・CPU・オンラインAuthority・共通ロビー/画面・テストに最後まで接続して**検証する。学校のGoogle Sites公開版、main、本番Firebase Rules/DB、Driveは触らず、Draft PR #2の開発ブランチだけを更新する。今回の第5作は商品化・学校公開を目的としない、**実装検証用のオリジナル短時間ゲーム**。

## 試験ゲーム「ハイカード勝負（試験）」

- 2人用。52枚のトランプからシャッフルして12枚を使い、P1とP2に伏せ札6枚ずつ。
- 交互に自分の伏せ札を1枚タップ。双方が1枚ずつ公開したら、ランクが高い方に1点。Aは14として最強。同じランクなら双方0点。
- 6ラウンドで終了し、高得点側が勝ち。同点なら引き分け。覚えなくていい、複雑なドラフト不要の開発検証向けルール。
- めくる操作は既存 `flip` プロトコル。ローカルCPU戦も同じ共通 `createCpuSession` に追加できた。これは戦略性・完成度を優先した本採用企画ではない。

## 追加したファイルと共通機構

1. `v2/games/highcard-duel.mjs`：独立したルール。シード固定・決定的シャッフル、合法手、状態遷移、6ラウンド点数・同点、CPU手番、非公開カードを含まないpublic state。
2. `v2/session/two-player-highcard-match.mjs`：ホストのみが12枚の実カードを保持するauthority。public/private revision同期、room/match ID、プレイヤー合法手、CPUターン。参加者の手札は空のprivate payloadで送信され、裏向きのカードの実体は公開REST payloadに現れない。
3. `v2/games/definitions.mjs` に5本目の1プラグインを登録。`localMove/cpuChoose/localBoard/localLegal/remoteBoard/remoteLegal`を提供。 `ui.turnHint` でめくる枚数の説明が神経衰弱と混同しないようにした。
4. `v2/session/match-engine-catalog.mjs` に `highcard` の対戦エンジンを追加。**共通の `room-match-host.mjs`、`room-match-guest.mjs`、`room-session.mjs`、`room-coordinator.mjs` は変更不要**。
5. `v2/ui/board-surfaces.mjs` に2列（P1/P2）の見えるカード列 `highcard` surfaceを追加。カード画像生成は既存の `makeCardFace`、操作は既存の `flip` アクションを流用。新ゲーム固有の余白だけ `v2/ui/table.css` に追加。
6. 旧テストの「2人用は神経衰弱のみ」「ゲームは必ず4本」という固定前提を、登録されたseat count / plugin数に追従するチェックへ変更。

## 検証の段階

- [x] [Foundation #40836031606](https://github.com/8mahi8/trump-collection/actions/runs/40836031606) **211/211 PASS**。ゲーム作成、シード再現性、6ラウンド、合法タップ、非公開カード、対戦終了、1人＋CPU、2人でのhost Authorityを検証。
- [ ] [オンライン総合 Chromium/WebKit #40836099774](https://github.com/8mahi8/trump-collection/actions/runs/40836099774)。2人が実Firebase Emulatorルームに入り、開発ゲームを選んで12回めくり、結果画面まで完走。公開Viewに隠しカードが無いことを再検査。800×450、667×375、667×300の各画面で12枚の表示・タップ領域が収まるかを判定。
- [ ] 新しいオンライン総合のスクリーンショットを取得し、WebKit/Chromiumのレイアウトを目視。
- [ ] 実学校iPad Safari × Google Sites埋め込みは未試験。**Google Sites公開版には掲載していない**。

## 重要な設計上の制限

この検証で、既存の `flip` と表裏カードUIを再利用する2人ゲームは、共通ホスト・ゲスト・通信・ロビーを変更せず追加できると実証する。一方、**新しい独自ルール、非公開状態管理、固有の盤面レイアウト**はやはり個別実装が必要。新しい種類のアクション（例：入札/複雑な複数選択など）も追加するときは `room-session` 等の入力検証の拡張が必要。

**結論：ユーザーが求める「ゲームを追加しやすい設計」には進んだが、定義ファイル1枚だけで自動的に完成する仕組みではない。5本目を通して追加コストを評価する。**
