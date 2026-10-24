# カードの「見た目と手触りのクオリティ」調査

対象：学校iPad向けトランプゲーム集（HTML/CSS/JS・単体ファイル・画像素材なし・CSS描画のみ）の品質改善
調査日：2026-10-24

## 実装すべき要点トップ6

1. **ピップ配置を本物の標準レイアウトどおりにする**。数字カード2〜10は配置が世界共通で決まっており、下半分のピップは180度反転（回転対称）。CSS Gridの3列×4〜5行グリッドに座標テーブルで配置すれば、Unicodeスート文字だけで本物そっくりにできる。「大きなスート1個＋数字」より一段本物らしくなる最重要ポイント。
2. **角インデックスは左上＋右下（180度反転）を必ず対にする**。扇形に持ったとき読めることが実物の最大の工夫。右下は `transform: rotate(180deg)` で配置。コートカード（J/Q/K）は絵札画像の代わりに「大きなランク文字＋スート＋上下反転ミラー」のダブルヘッド風レイアウトにすると、CSSだけでも絵札感が出る。
3. **カードの「厚みと影」は box-shadow の多層化で作る**。1枚の薄い影ではなく「接地した濃い影＋浮き上がりの柔らかい影＋insetの上面ハイライト」の3層以上を重ねる。ホバー/選択時は影を大きく・遠くし、持ち上がりを影でも表現する（影のオフセット量＝高さの表現）。
4. **テーブル（背景）は「フェルト＋ビネット＋ごく薄いノイズ」で質感を出す**。単色グラデーションは安っぽさの主因。radial-gradientのビネット（中央が明るく周囲が暗い）＋SVG feTurbulenceのデータURIノイズ（不透明度0.05〜0.15、タイル状に繰り返し）を重ねると、画像なしで布・紙の質感になる。
5. **動きは「速く出て、ゆっくり着地（ease-out）＋わずかな行き過ぎ（overshoot）」を統一する**。カードの出現・着地は8〜12フレーム（約150〜250ms）の小さなバウンスで「カードが落ち着く」感触になる。イージングは `cubic-bezier(0.34, 1.56, 0.64, 1)`（スプリング風）や `cubic-bezier(0.16, 1, 0.3, 1)`（滑らかな減速）を用途で使い分け、linear は使わない。UI遷移の目安は200〜300ms、長くても500msまで。
6. **相手の行動は「顔アイコン＋吹き出しの短い定型文」で見せる**。Hearthstone方式の定型エモート（6種程度＋吹き出し表示）は、自由文チャットの荒らし対策として設計された実績ある型。COM対戦でも「つよい！」「やられた〜」等の吹き出しが出るだけで対戦の実在感が跳ね上がる。連打制限とミュート前提の設計もセットで。

---

## 1. 本物のトランプのカード面デザイン

### 実例/出典（URL）

- ピップ（中央のスート模様）の数と配置はデッキ間でほぼ共通の標準があり、角には左上＋右下反転のインデックス（ランク＋小さなスート）が入る。欧州式では4隅インデックスもある。
  - Pip (counting) - Wikipedia: https://en.wikipedia.org/wiki/Pip_(counting)
  - Standard 52-card deck - Wikipedia: https://en.wikipedia.org/wiki/Standard_52-card_deck
- 数字ごとの配置の具体形（要約）：2＝上下中央、3＝中央の縦列、4＝四隅、5＝四隅＋中心、6＝左右2列×3、7＝6＋上部中央に1つ、8＝6＋中央に上下2つ、9＝左右2列×4＋中心、10＝9の配置＋中央にもう1つ（上部）。下半分のピップは天地が逆向き（回転対称）。
  - What Is a Pip in Playing Cards? - Our Pastimes: https://ourpastimes.com/pip-playing-cards-4616754.html
  - The Geometry and Semiotics of Spot Patterns - Flyriver: https://www.flyriver.com/g/arrangement-of-pips
- コートカードは19世紀に「ダブルヘッド（上下反転ミラー）」化された。理由は実用で、逆さまの絵札を直す仕草から手札がバレるのを防ぐため。同時期に角インデックスも普及し、扇形に持っても読めるようになった。スート記号は常に左上＋右下に置くのが英語パターンの標準。
  - Standard 52-card deck - Wikipedia（Design節）: https://en.wikipedia.org/wiki/Standard_52-card_deck
  - Behind the Faces of Court Cards - Premium Playing Cards: https://premiumplayingcards.co.uk/blogs/articles/behind-the-faces-of-court-cards
  - Updating the design during the 1800s - International Playing-Card Society: https://i-p-c-s.org/faq/tmfaq2.php
- 裏面の定番：Bicycle「Rider Back」（1885年〜）に代表される、**白い余白（ボーダー）を残した内側に、上下左右対称の細密な繰り返し模様**を敷く形式。対称性は「向きでカードが判別できない」ための実務要件でもある。格子（ラティス）・ダイヤ・円の繰り返しが古典的なモチーフ。
  - Bicycle Cards Explained - Alibaba（The Classic Rider Back Design節）: https://www.alibaba.com/product-insights/bicycle-cards.html
  - Bicycle Rider Back - The Ultimate Guide - ezeebike: https://ezeebike.ca/blog/the-bicycle-rider-back-a-timeless-classic-for-card-games-and-magic-tricks
- CSSだけでトランプを描く先行実装の型：カード要素に `rank-*` とスートのクラスを付け、角インデックスは絶対配置、ピップは位置クラス（spotA1等）で配置する。サイズは em 単位で設計し、フォントサイズ変更で全体が拡縮するようにする。Helveticards はピップとコートを「大きな中央シンボル」に簡略化している。
  - CSS Playing Cards - selfthinker（GitHub）: https://github.com/selfthinker/CSS-Playing-Cards
  - CSS Playing Cards, by Jeff Yaus: http://jyaus.github.io/css-playing-cards/
  - Helveticards Card Implementation - DeepWiki: https://deepwiki.com/zachwaugh/Helveticards/2-card-implementation
  - BrainJar.com: Playing Cards with CSS: http://www.brainjar.com/css/cards/default3.asp

### CSS/JSで再現する示唆

- ピップは **CSS Grid（3列×5行相当）＋ランクごとの座標テーブル** で配置する。列は左25%・中央50%・右75%、行は上から約12%・31%・50%・69%・88%を目安に、下半分のピップには `transform: rotate(180deg)`（特に♠♣♥は上下非対称なので必須。♦は対称なので省略可だが統一してよい）。
  - 2: (中央, 1行目) (中央, 5行目・反転)
  - 3: 2 ＋ (中央, 3行目)
  - 4: (左,1) (右,1) (左,5・反転) (右,5・反転)
  - 5: 4 ＋ (中央,3)
  - 6: (左,1) (右,1) (左,3) (右,3) (左,5・反転) (右,5・反転)
  - 7: 6 ＋ (中央, 2行目)
  - 8: 7 ＋ (中央, 4行目・反転)
  - 9: (左,1) (右,1) (左,2) (右,2) (左,4・反転) (右,4・反転) (左,5・反転) (右,5・反転) ＋ (中央,3)
  - 10: 9の8個 ＋ (中央, 1〜2行目の間) (中央, 4〜5行目の間・反転)
  - A: 中央に特大ピップ1個（本物も装飾的に大きくする慣習がある）
- 角インデックスは左上（ランク文字の下に小さなスート）と、右下に同じものを `rotate(180deg)` で配置。手札を扇形に重ねても左上だけ見えれば読める配置にする。
- J/Q/K は画像なしの代替として：カード中央に **内枠（細い二重線の額縁）＋大きなランク文字＋大きなスート** を置き、下半分に180度反転した複製を薄く配置すると「ダブルヘッド絵札」の雰囲気になる。王冠などの装飾は Unicode（♛等）やCSS図形で最小限添える程度に留める。
- 裏面は **白フチ（カード全面の白＋内側に柄エリア）＋対称パターン** が本物の型。柄は `repeating-linear-gradient` の斜め格子、または `radial-gradient` のドット繰り返し＋中央にスート文字のエンブレムで再現できる。色は定番の赤/青の2色から選ぶ。

---

## 2. 評価の高いデジタルカードゲームの画面の質感

### 実例/出典（URL）

- Balatro：カードの配布・選択に「物理っぽい小さなバウンス（行き過ぎて戻る）」があり、カードが“物”として感じられる。配点時は数字カウンタの加速・減速、光の
...[truncated 6936 chars]