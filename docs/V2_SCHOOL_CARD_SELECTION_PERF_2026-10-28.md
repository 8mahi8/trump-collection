> **実画面での確定結果（2026-10-28）**：**[Actions #40640370464 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40640370464)**。Chromium/WebKit両方で `V2 CARD SELECTION FAST PATH PASS`（盤面DOM・手札DOM維持、フル再描画なし、スクロール位置維持）を観測し、4ゲーム連続試合完走。**[Foundation #40640524486 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40640524486)**：新規private同時送信とpublic最終公開を含む163項目合格。**[RTDB noAuth Emulator #40640430349 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40640430349)**：通信の互換性検証合格。実iPad改善の数値はまだ未計測。
# トランプコレクションV2｜学校実機フィードバック・カード選択の高速化（2026-10-28）

## 学校からの新しい事実
- 学校iPadのGoogle Sites実ページで、**友達とのFirebase接続は成功**。
- しかし、まだUI全般の改善余地があり、特に**カードを選択した後が重い**と本人が実機で体感した。
- ユーザーの実測を最優先し、ゲーム機能の追加ではなく、表示と操作の処理負荷を優先改善。

## 見つかった具体的な原因
- `v2/ui/table-renderer.mjs` の選択操作が `render(current)` を毎回実行。
- `render` は `JSON.stringify(view)`、人数タグ全部の作り直し、`createBoardSurface`による場の完全DOM再生成、手札の全カードの `makeCardFace` 再生成、アクションボタンの再生成をしていた。
- 旧版カード復元後のカード1枚はコーナー・絵札・数字マークなど複数DOM要素で構成されるため、選択だけで全盤面と手札を作り直す設計は不合理だった。
- ただし『重い』の全要因がこの処理と確定したわけではない。学校の処理時間計測は未実施。『選ぶだけで重い』と『選択後に出したカードの確定が遅い』は別の現象。

## 今回の実装
1. `v2/ui/table-renderer.mjs`：`updateSelection()` を追加し、選択時は**既存の手札カード要素のclass・aria-pressedと、出すボタンのdisabledだけ**を更新。手札・相手・盤面の `replaceChildren` は一切しない。手札スクロール位置を保持。通常の対戦 revision 更新のときだけ全面描画。
2. `daifugo` の出せるカードのSetと合法な組み合わせのシグネチャSetを状態描画時に一度生成し、選択中の判定ではSet照合。選択ごとの合法手リスト走査・ `flat()` 処理を不要にする。七並べの1枚選択も同じ高速経路。
3. `v2/session/room-match-host.mjs`：ホストが人間全員に送るprivate snapshotのREST書込を `Promise.all` で並列化。**全員分が成功してからpublic revisionを最後に公開する順序を厳守**。CPUの手札は送信しない。これにより学校Wi-Fiの1プレイヤーずつの逐次往復を削減できるが、実ネットワークでの短縮値は未計測。
4. `tests/v2-room-match-publish-perf.test.mjs`：独立した4人private書込が並列開始されること、1人のprivate書込が遅い場合はpublicを先に公開しないこと、CPU席privateを送信しないことを検証。
5. `dev/verify-v2-online-ui.mjs`：大富豪の実タップで `v2-board` DOM・手札DOM・full render version・スクロール位置が変わらず、選択だけが変わることをChromiumとWebKitの両方で判定。4ゲーム連続試合完走テストと併用。

## 外部根拠
- [Chrome Developers: Optimize DOM size](https://developer.chrome.com/docs/performance/insights/dom-size)：大量DOMの再レイアウトやスタイル計算は操作への応答を遅くする。不要なDOM更新を避ける設計の裏付け。
- [web.dev: Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)：DOM変更がレイアウトコストと操作遅延につながる。

## 検証と制限
- [新規Foundation V2のワークフロー](https://github.com/8mahi8/trump-collection/actions/workflows/foundation-v2.yml)：新規private publishのテストを含む全回帰検証。
- [V2 Room-first UI](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-ui-emulator.yml)：実タップで選択時の盤面/手札DOM保持を計測し、4ゲーム連続完走を検証。
- 本番Firebase Rules／DB、学校Google Sites実公開版、main、Google Driveは変更していない。新しいアカウント登録、匿名認証、ホスト再起動復帰は追加していない。
- **学校iPadの実機で軽くなったと確認できたわけではない**。次回試遊で選択直後の表示、出すボタン押下後の遅延、手札のタップしやすさを分けて評価する。
