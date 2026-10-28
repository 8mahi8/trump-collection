## 【最終検証結果：PASS】
**2026-10-29 更新**：最終コードコミット `3fae4965f297310d536ebba178c7bf5692426561` の [GitHub Actions #40715035198](https://github.com/8mahi8/trump-collection/actions/runs/40715035198) が **success**。実際のFirebase Realtime Database Emulator上で、ChromiumとWebKitの両方がババ抜き・七並べ・大富豪・神経衰弱の連続対戦を完走した。4人ルームからの神経衰弱2人選択、CPU補充、無認証チャット双方向、カード選択時のDOM非再構築もPASS。

特に新增した `V2 SEVENS ALL FOUR SUITS VISIBLE PASS` と `V2 SEVENS ACTIVE CONTROLS + FOUR SUITS PASS` が **両エンジンでPASS**。画像もActions artifact `12827229995` から取得して実物を目視確認した。確認した画像：`classic-seven-active-webkit-667x300.png`、`classic-seven-active-webkit-667x375.png`、`classic-seven-active-webkit-800x450.png`、`online-memory-webkit-667x375.png`、`classic-babanuki-webkit-667x300.png`。4段が画面内に収まっており、神経衰弱の重複説明も解消していた。

同一版の **[Foundation #40714960718](https://github.com/8mahi8/trump-collection/actions/runs/40714960718) success**、**[神経衰弱CPUブラウザ #40714960768](https://github.com/8mahi8/trump-collection/actions/runs/40714960768) success**（両者は最終ゲームコード `dacb63f7` 上。後続 `3fae4965` はE2E検証スクリプトのみの変更）。

残る未検証は**学校iPad上の実Google Sites iframe**。実機体感が確認できるまで一般公開/Google Sites更新はしない。300px高は情報量が多いため文字がかなり小さくなる点も継続改善候補。

---

# トランプコレクション V2｜七並べの4段欠け修正とタッチ画面レビュー（2026-10-29）

## 発見の経緯
- 直近成功の「V2 Room-first UI Safari and Chromium Emulator」実行 [#40709136030](https://github.com/8mahi8/trump-collection/actions/runs/40709136030) から **変更前の** 667×375 WebKit/Chromiumスクリーンショットを取得して目視確認。
- 特に `classic-seven-webkit-667.png` で、盤面は52セルあるのに一番下の **♣ 行が見切れていた**。これを「機能テスト成功＝UI完成」とはしない。
- 最初の固定セル高さによる修正は GitHub Actions [#40714446420](https://github.com/8mahi8/trump-collection/actions/runs/40714446420) で失敗。ログは `SEVENS_FOURTH_SUIT_CLIPPED`、800×450時 `boardBottom=228.3` 対 `lastBottom=254.2`。隠れた4段目が実際に存在することを確認。
- 固定高さは、自分の手番になると「札を出す」「パス」「選択説明」が増えて余白がなくなる問題がある。**相手の番だけでなく、自分の番でも4行の表示を検査する必要がある**と判断。

## 今回の変更
1. `v2/ui/table.css`：画面高さ500px以下の七並べ盤面に `grid-template-rows:repeat(4,minmax(0,1fr))` を適用。残りの盤面高さを**4つのマーク行へ均等配分**し、セルが本来の配置領域を越えない構造に変更。説明/凡例は狭い画面では省略し、操作に関係する盤面を優先。
2. 300px高以下への対応：四段は小さくなっても全行見えるよう、説明/手札/ソート/ボタンの高さを縮める。狭い盤面の表示カードそのものは直接タップ対象ではなく、**タップ対象は下の手札/パスボタン**である点を維持。幅667px×高さ300pxが厳しい下限であり、より広い埋め込みを推奨。
3. `dev/verify-v2-online-ui.mjs`：七並べを開始した後、`800×450,667×375,667×300` で4行を確認し、**相手の番＋自分の手番（2操作ボタンがある状態）**のスクリーンショットと座標テストを追加。4行目の下端が盤面の下端を越えたら失敗する。
4. `v2/ui/table-renderer.mjs`：ババ抜きは盤面に「誰から引く」が出るため、別箇所の曖昧な重複説明を削除。神経衰弱も2つ重複していた「2枚めくろう」の一方を削除。`v2/ui/table.css` の `.v2-actions:empty{display:none}` で空いた操作欄を折りたたむ。
5. 上記を本物の Firebase Emulator＋Playwright 対戦UIで確認するため、ババ抜きの説明行ゼロ・神経衰弱の重複ゼロと必要な単一ヒントをE2Eチェックに追加。

## 確認済み / 未確認を分ける
- **確認済み**：変更前の実WebKit画像を目視し、表示欠けを具体的に発見。最初の修正版の不合格を Actions の失敗ログで確認。ローカルChromiumの静的な共通テーブル/手札/プレイ・パス付きレイアウトで幅667/800・高さ300/375/450pxを測定し、可変グリッドの4行が盤面内に収まることを確認（静的fixtureのみ）。変更したJSの構文解析、CSSの括弧整合を確認。
- **CI最終結果**：後続の最終検証は上記PASS。前段階の実行時にはまだ結果未確定だった。最終コード・テストコミット `3fae4965f297310d536ebba178c7bf5692426561` に紐づく実行の合否を別途確認すること。実行時点ではまだ結果未確定。**過去の成功を最新改修の合格と扱わない。**
- **学校iPad**：Google Sites iframe 実機は未確認。最終公開判定には Safari の表示/タップ/チャット/4ゲーム連戦が必要。

## 今後の品質チェック
- 同じサイズの **WebKit の最新版のゲーム実スクリーンショット**で4行目が見えていることを、ログだけでなく肉眼で確認。
- 七並べの自分の番と相手の番で、どちらでも一番下の行と手札・出す/パス操作が見えること。
- 大富豪の手札選択DOM再構築無し、ババ抜きのカード44px・ペア通知、神経衰弱の8×3マス、チャット・ルーム連戦は再テスト。
- 新しいゲームを足す際は、盤面の行・列の**数だけでなく、実座標と可視領域**を自動テストする。

今回も Draft PR #2 の `refactor/unified-core-and-school-network-20261027` のみ更新。**main、学校Google Sites公開版、本番Firebase Rules/DB、Google Driveは変更しない。**
