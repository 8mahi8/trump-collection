# トランプコレクション V2｜UI品質基準と追加ゲーム設計（2026-10-28）

## 目標と対象
学校iPad SafariのGoogle Sites埋め込みで友達と遊び、**「技術デモ」ではなく、すぐ理解して楽しめる完成品**として出せる画面品質にする。新機能の数より4ゲームの入力の確実さ、場の読みやすさ、手番の理解、安定したオンライン同期を優先する。

2026-10-28にGitHub Actions #40643315973の**旧V2**画面証拠（Chromium/WebKit各800×450と667×375、ロビー／対局）をダウンロードし目視確認。旧画面はロビー/試合の構造が明快な反面、トランプ手札・相手の背面札の可視部分が狭く、ロビーのゲーム別識別力が弱く、低い画面では通信状態テキストが隠れていた。新実装のスクリーンショットは**未取得・未評価**であり、この既存証拠と混同しない。

## 外部資料に基づく原則
- Appleの[Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games/) と [Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls)：タッチ優先、主要操作は44pt相当を目標に、指が届きやすい配置、テキスト判読性、異なる縦横比への対応、押下状態を提供。面積が足りなければカードを重ねすぎず横スクロールを使う。
- Nielsen Norman Groupの[Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)：誰の番か、何が選択されたか、通信中か、出せるかを隠さず即時に見せる。
- MDNの[justify-content / safe alignment](https://developer.mozilla.org/ja/docs/Web/CSS/Reference/Properties/justify-content)：溢れるカード列の中央揃えは先頭札を隠しかねない。スクロール可能なflex-startを基本として、短い手札のみauto marginで中央に寄せる。
- WAI-ARIAの[status](https://www.w3.org/TR/wai-aria/)：重要な結果と通信状態は表示テキストでも伝える。色のみで手番/合法手を示さない。

## 今回のUI作業
1. `v2/ui/game-presentation.mjs` を追加。ゲーム定義の**任意**の `ui:{icon,tagline,handOrder}` に基づき、共通ロビータイル、手札初期ソート、ターン見出しと操作説明を生成。未定義の追加ゲームもデフォルト表示で破綻しない。
2. `v2/core/game-registry.mjs` で任意メタデータを検証・freeze。古いUIメタデータ無しのプラグインのオブジェクト形状は維持する。
3. `v2/ui/table-renderer.mjs` の `shichinarabe/daifugo` 名前判定を `spec.interaction='pick-one'/'pick-multi'` に変更。七並べで**出せない札を選べない**ようにし、選択時の表示が「出せる」と誤報しない。
4. 手札の強すぎる重なりを減らして横スクロール可能にし、12枚以上は横操作を示す。短い手札は中央揃え。主操作は通常44pxを目標に、375px高では40px確保。場の情報と選択状態を文字でも表示。
5. `v2/online-app.mjs` の4ゲームタイルにタイトルと説明を付与。2人対戦の相手選択は特定ゲームIDではなく `spec.seats===2` で判定。
6. `v2/online-lab.html` の開発者向けラベル「TRUMP V2」を一般向け名称に整理。「4ゲーム限定」と読める固定文も排除。
7. `@media(max-height:430px)` でも `#notice` を表示。小型画面でもネットワーク異常を知らせる。

## 新しいゲームを足すとき
1. `v2/games/definitions.mjs` にルール、合法操作、盤面投影、ローカル・リモートアダプターを持つゲームプラグインを登録する。 `ui` は任意。例：`ui:{icon:'♦',tagline:'手札をそろえよう',handOrder:'suit'}`。
2. 固有盤面は `v2/ui/board-surfaces.mjs` の `boardKind` に対する関数を追加し、手番・カード・アクションは共通Rendererを利用。新ゲーム固有のタッチ操作が必要なら `spec.interaction` の拡張と共通回帰テストが必要。
3. ゲーム名をロビー/共通Renderer/通信に列挙して追加するのではなく、プラグインのlabel・seats・UIメタデータを消費する。2席ならロビーの相手選択は自動流用できる。
4. **注意**：オンラインでプレイ可能にするには現在の `labGames` 対応リストとMatch Authorityの各ゲーム固有実装が別途必要。単なるUI登録だけで新ゲームが通信対戦可能になるわけではない。未実装ゲームを勝手に遊べる表示にはしない。
5. 1人＋CPU補充/2人対戦/4人対戦、Google Sites用単体HTML、Firebase匿名認証無しなどの既存契約を保持し、新ゲームも同じ手順で対戦完走テストを通す。

## 完了のための厳格な確認ゲート
- **自動テスト**：Node全Foundation、Firebase Emulator、Chromium/WebKitで4ゲーム連続完走、チャット双方向、ゲスト/ホスト同期、カードタップ時のDOM非再構築を全て通過。
- **視覚**：800×450、667×375、できれば一般iPad比率の画面で、ロビー/手番/パス/結果/チャット/CPUを撮影。ボタン被り、最初や最後の手札の欠落、ステータス隠れ、画面上下の切れ、指の押しづらさが無いこと。
- **学校実機**：Google Sites iframe上で2台以上接続、同ルームで連戦、カード選択の軽さ、チャット開閉、手札横スワイプ。ここまでが**公開品質の最終判定**。
- **運用**：今回も `main`・Google Sites公開版・本番Firebase Rules/DB・Google Driveは変更しない。

## 今回の検証の範囲（誇張禁止）
- 新しいUIメタデータ・レジストリの**実ソースコードを取得して独立JS環境で8項目のスモーク確認**：PASS。改変した主要JS計8ファイルを構文パース：PASS。
- Node/Firebase/Chromium/WebKitの**今回のHEADのCI結果と新しい画面スクリーンショットはまだ取得できていない**。旧版 #40643315973 の成功を新コードの合格として扱わない。
