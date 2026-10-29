# トランプコレクション V2｜学校iPad向け文字・操作領域の品質改善（2026-10-29）

## 最終検証結果（PASS）

- **基盤テスト**：[Foundation #40724370564](https://github.com/8mahi8/trump-collection/actions/runs/40724370564) はCSSとロビーマークアップを含むコミット `c757cf85` で success。追加のE2Eテストはプレゼンテーション検査のみでエンジンロジック無変更。
- **神経衰弱CPU**：[Memory CPU #40724370622](https://github.com/8mahi8/trump-collection/actions/runs/40724370622) success。
- **オンライン総合**：[Chromium＋WebKit #40724404548](https://github.com/8mahi8/trump-collection/actions/runs/40724404548) **success**。コミット `7b963db8` で、Firebase Emulator無認証ルーム、双方向チャット、CPU補充、大富豪→ババ抜き→七並べ→神経衰弱の同じ部屋での完走・神経衰弱2人選択、七並べ4段表示を双方のブラウザで合格。
- **追加の画面検査**：高さ300/375/450pxでロビーボタンの44px目標と同じ行の配置、3ボタンが画面内に収まること、ゲーム名/説明の文字サイズ、ゲーム選択のaria-pressedを確認。チャット入力/送信44px・閉じる40px・本文13px以上を検査。すべて合格。
- **実画面確認**：CI artifact `12832077843` から `online-lobby-webkit-667x300.png`, `online-lobby-webkit-667.png`, `online-chat-webkit-667x375.png` を取得し、目視でボタン3件の見切れなし・短画面で省略した補助説明・ゲーム名の可読性改善・チャット送信欄の収まりを確認した。ローカルの合成モックだけでなく、今回の**実Firebase Emulator上のブラウザ画面**での確認。
- **残る未検証**：学校iPad Safariと、学校のGoogle Sitesに実際に貼り付けたときの画面・接続品質。実機での仕上がりはテスト結果だけで断定しない。

---

## 変更前の実画面レビュー
[既存CI #40720160562](https://github.com/8mahi8/trump-collection/actions/runs/40720160562) から取得した実WebKitスクリーンショット `online-lobby-webkit-667.png`, `online-chat-webkit-667x375.png`, `online-results-webkit-667x375.png` を確認した。

- 667×375のロビーは横幅に余裕がある一方、準備/開始/退出の3ボタンが縦1列に並び、短画面では各ボタンの高さが34px前後まで圧縮されていた。ゲーム名と短い説明も12px/10pxで読みにくかった。
- チャットは12pxメッセージ、37pxの送信・入力操作、34pxの閉じる操作など、限られた領域で小さめだった。
- 結果画面の順位表示は実際に収まっており、順位と退出・戻る機能は以前の回帰に合格。ここは意味のない再設計をしない。

## 参考にした設計指針
- [Apple HIG：Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)：通常のタッチ対象は44×44pt以上、ボタン間の視覚的区別、押下状態が必要。
- [Apple HIG：Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls)：頻繁に使うゲーム操作44×44pt、二次的なメニュー操作28×28ptの目安、親指と狭い画面を考慮。
- [Material accessibility](https://m1.material.io/usability/accessibility.html)：タッチ対象と必要な間隔、可読性。
- 本作はWebなのでCSS pxの幾何学的検査を追加する。CSS pxと物理ptが必ずしも等価とは限らない。最終的な学校iPad実機確認は別。

## 実装
1. `v2/online-app.mjs`: ロビーの準備完了/対局開始/退出ボタンを `.v2-room-actions` にまとめて横1列表示。既存 `data-action=ready/start/leave-room` を維持して通信やテストを壊さない。ゲーム選択ボタンと準備ボタンに `aria-pressed` を明示。
2. `v2/ui/online-shell.css`: 横画面でロビー操作を44px以上の高さ、横幅95px以上にする。退出は別色の二次操作にして誤タップと操作優先度の混同を減らす。4ゲームの名前14px以上、説明11px以上にして可読性を改善。幅が狭い場合のフォント調整を追加。
3. 同CSSでチャットメッセージ13〜14px、送信・入力44px、閉じる40px、結果画面の名前14px/得点13pxを維持。
4. `dev/verify-v2-online-ui.mjs`: 800×450・667×375のオンラインロビーで操作ボタン3件の順番、同一行のY座標、幅95px・高さ43.5px以上、ゲーム名と説明の実フォントサイズ、選択済み `aria-pressed` を確認。チャットを実際に開いた状態で入力/送信44px、閉じる40px、メッセージ13pxを検査。
5. 既存の無認証Firebase Emulator、CPU/人間混合、4ゲーム同室連戦、WebKit/Chromiumの画面座標試験を維持。

## 検証基準
- [x] 新しいコミットのFoundationテストPASS
- [x] Chromium/WebKitオンライン総合で、新しいロビータッチ領域とチャットの実フォント検査がPASS
- [x] 神経衰弱CPUブラウザPASS
- [x] 新しい実スクリーンショットでロビー操作が見切れない・横幅の活用が自然であることを目視
- [ ] Google Sites学校iPadで実機の操作性と見やすさを確認

完了までは実ブラウザ合格や学校実機合格を主張しない。**main、Google Sites公開版、本番Firebase Rules/DB、Google Driveは変更しない**。Draft PR #2の開発ブランチのみ。
