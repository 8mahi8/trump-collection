# トランプコレクション V2｜UI品質第3回・盤面と結果、追加ゲームの安全な登録（2026-10-28）

## 目的
「学校で動く」だけでなく、友達に見せて自然に遊べるUIへ。先行レビューで残っていた七並べの合法位置、ババ抜きの手番説明、結果一覧、新ゲームを足すときのロビーとオンラインAuthorityの責務を改善した。Apple HIG / NNGroup / MDNを参考にした前回のタッチ設計基準は `V2_UI_DESIGN_SYSTEM_EXPANSION_2026-10-28.md` にある。

## 実装
- `v2/ui/board-surfaces.mjs`：ババ抜きで「CPU2から引く」「P3がCPU2から引いている」のように、引く人と引かれる人を別々に表示。七並べは52枠を維持しつつ、A/J/Q/K表記に変更。「次に置ける枠」と「**今自分の手札から置ける枠**」を別スタイルに分離。後者だけ `legal.playIds` に従って強調し、相手のターンに自分の合法候補を表示しない。
- `v2/ui/table.css`：七並べの合法位置のハイライトを、一般の次候補マスと視覚的に区別。短い横画面では説明テキストを隠して4行の盤面スペースを維持。
- `v2/games/definitions.mjs`：4ゲームに `onlineReady:true` を明示。今後追加するゲームは、実装・UI・Authority・Firebase検証を通すまでは `onlineReady` を付けず、ロビーに遊べるゲームとして表示しない。
- `v2/core/game-registry.mjs`：`onlineReady` は任意のbooleanに限定、UI用 `resultUnit` メタデータ（神経衰弱は「ペア」）を検証。
- `v2/online-app.mjs`：ハードコードされた「4ゲームのオンライン許可ID一覧」を廃止。プラグインの `onlineReady` から選択可能ゲームを決定。結果画面はゲーム名・勝者/上位/自分を認識しやすく整理。新しい得点単位も使用。
- `v2/ui/results-view.mjs`：取得済みの公開順位/公開得点/参加者IDのみから表示用の順位行を生成。ランキング順に並べるが、順位データが無い神経衰弱は公開得点順にする。勝手な勝者推測・秘密手札の参照なし。退室済みの参加者はP0にならず席番号で表示。
- CSSで結果一覧の上位/自分/得点の視認性を改善。

## テスト
- `tests/v2-board-feedback.test.mjs`：ババ抜きの手番/対象、七並べ52枠・A/J/Q/K・合法3枠・相手ターンの非表示を検査。
- `tests/v2-game-presentation.test.mjs`：4ゲームのオンライン公開準備フラグ、追加ゲームのデフォルト非公開、安全なUI拡張、得点単位を検査。
- `tests/v2-results-view.test.mjs`：公開順位、CPUと本人の区別、順位が無い2人得点戦、未取得結果、退室時のP0防止を検査。
- 追加のCode Mode隔離JSスモーク：実GitHubソースから七並べ52枠/合法3枠、ババ抜きCPU2表示、結果順位2/4人、onlineReady4件と新規未対応ゲームの非公開を確認し**PASS**。
- 主要実装JSと追加テストを構文チェックしPASS（top-level awaitのブラウザE2Eスクリプトはasyncで解析）。
- **制約**：GitHub Actionsの今回の新しいFoundation/Realtime Emulator/Chromium/WebKit全完走結果および**新コードのスクリーンショットを未取得**。以前の成功したGitHub Actions #40643315973の画像は変更前であり、これを今回の合格と数えない。学校iPad実機も未評価。

## 公開・運用
今回の変更はDraft PR #2の `refactor/unified-core-and-school-network-20261027` **だけ**。学校Google Sites版・main・本番Firebase Rules/DB・Google Driveは指示があるまで編集しない。

## 次に必要な検証
1. 今回の新コードでGitHub Actions Foundation/NoAuth RTDB Emulator/Chromium/WebKit全部成功を確認し、失敗したテストを最優先で修正。
2. 800×450と667×375の最新版ロビー/七並べ/神経衰弱/大富豪/ババ抜き/結果/チャットの**実画面を保存して目視レビュー**。特に2行タイトルのロビーで退出が見切れないこと、横スクロール時に最初と最後のカードが選べること、小さいiPadの七並べ全4行が操作可能なことを確認。
3. 全ゲーム完走→同じ5桁ルームに戻り再対戦、CPU混合、チャット送受信、カード選択のDOM高速化維持。
4. 上記が通ってから学校iPad Google Sites実機評価。結果が出るまでは「完成品質」と宣言しない。
