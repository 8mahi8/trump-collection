# v1.5.0 品質改善レビュー / 2026-10-24

対象: `dev/quality-and-ui-v1-5-20261024`（main は v1.4.0 のまま）

## 目的
学校iPadのSafari / Google Sites直接埋め込みに向け、4ゲームの既存仕様を維持しながらルールの正確さ、誤操作への耐性、短い横向き画面での使いやすさを改善する。
オンライン対戦、ログイン、外部依存、保存機能は追加しない。

## 実装した変更
- **大富豪の合法手**: 同ランクの先頭N枚だけでなく全スートの非空部分集合を生成。ジョーカー代用も含めた組み合わせを選べるようにした。
- **大富豪の場流し**: 最後に場へ出したプレイヤーが上がった場合も、残存プレイヤー全員のパスを待つ。
- **大富豪のスペ3返し**: ジョーカー単体を♠3で返すと場を流し、そのプレイヤーから続行する。設定OFFなら従来どおり無効。
- **縛りとジョーカー**: スート縛り中はジョーカーが不足スート1つを補える。
- **神経衰弱**: 取ったペアが即座に透明化しないよう、成立表示と退場演出を接続。無効な位置は安全に無視する。
- **UIの進行**: COMの行動をアニメーション前後で再抽選しない。吹き出しは再描画の後に配置する。結果モーダルの重複生成を廃止。
- **画面・タッチ**: 戻る/再スタート/アクションのボタンを44px以上とし、神経衰弱の盤面を狭い横向き画面で圧縮。七並べの行を小画面幅へ対応。選択表示のカード文字サイズ単位を修正。
- **安定性**: 対戦の切替・再開時の古い待機アニメーションが新しいゲームへ手を打たないようセッション照合を追加。システムの「視差効果を減らす」をCSSで尊重。

## 外部資料と採用範囲
1. 日本大富豪連盟 公式ルール/FAQ
   - https://www.daifugo.jp/rules
   - https://daifugojapan.com/faq
   - 参考にしたのはスペ3返しで場が流れること、上がり後の場流し、縛り中のジョーカーのスート補助。
   - **本作のローカルルールを全面的に競技公式ルールへ置き換えていない。** ジョーカー枚数・反則上がり・先手などは従来仕様を維持。
2. Apple HIG Buttons: https://developer.apple.com/jp/design/human-interface-guidelines/buttons
   - タップ対象の目安44×44pt、明確な押下状態。
3. Apple HIG Game Controls: https://developer.apple.com/jp/design/human-interface-guidelines/game-controls
   - よく使う操作は安全領域と手の届きやすさを考慮。
4. MDN touch-action: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
   - 独自タッチ操作とブラウザ既定のジェスチャーの違いを確認。既存のなぞり動作を維持。
5. MDN prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
   - OSの動きを減らす設定を受け付ける。

## 検証できたこと
- ゲームロジック（従来8件 + 追加7件）**15テスト**を、GitHub上の現行ソースを読み込みJavaScript実行環境で評価し全件成功。
- 大富豪のCOM連続試合（既存30 + 追加120）も全件終了。
- `index.html` / `games.mjs` をもとにした `dist/trump-collection.html` の生成一致、同梱JavaScriptの構文検査、外部importとlocalStorage/sessionStorageなしを確認。

## まだ検証できていないこと
- `node --test` 自体を使ったローカル実行、および `node dev/verify.mjs` のPuppeteer/Chrome通しプレイ・スクリーンショット比較は**今回未実施**。
- iPad Safari実機、Google Sites直接埋め込み、タッチイベントでの見た目/アニメーションも**未確認**。
- 大富豪COMの思考の強さとゲームバランスは今回の主な調整対象外。

## リリース判断
開発ブランチで保持する。正式なGoogle Sites版（手動貼り付け）と、mainから配信されるGitHub Pagesは変更しない。ブラウザ表示とiPad実機の検証を経てから統合判断する。

## 絶対に変えない仕様
- 出す操作: カードを選ぶ → 「出す」で確定。
- HTMLは外部依存なし、localStorage/sessionStorageなし、音がなくても成立。
- Google Sites直接HTML貼り付けが正式配布。GitHub Pagesは試遊補助。
- COM対戦4種・自作素材・短時間プレイを維持。
