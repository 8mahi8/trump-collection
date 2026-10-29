# トランプコレクション V2｜外部資料比較・5本目ゲームの拡張性監査

**監査日：2026-10-29**　対象：Draft PR #2 の開発ブランチ（公開版は変更しない）。

## 結論（監査時点）
- **共通ロビー、共通ViewModel、共通UI、CPUローカルセッションは拡張性が高い。**
- **オンライン対戦は「ゲーム定義を1つ増やすだけ」では不十分だった。** 元コードではホスト `room-match-host.mjs` が `gameId==='shinkei'` で分岐、`room-cpu-choice.mjs` は3ゲームの名前で分岐、`card-order.mjs` も `game==='daifugo'` に依存。4人用の権威処理は `online/four-seat-authority.mjs` のゲーム別adapterに直結し、2人用は神経衰弱専用の実装。
- したがって「5本目が自動的にオンライン対戦できる」とは主張しない。新しいゲームには固有の**ルールと公開/非公開状態を分ける権威エンジン**が必要。

## 今回の改善実装
1. **オンラインエンジン登録所** `v2/session/match-engine-catalog.mjs` を追加。ホスト `v2/session/room-match-host.mjs` のゲーム名分岐を削除して `matchEngines.create({room,...})` へ統一。既存ゲームは大富豪/七並べ/ババ抜きの4席ブリッジと、神経衰弱2席ブリッジを登録。
2. **誤公開防止**：ロビーは `DEFAULT_MATCH_ENGINES.listPlayable()` から選択肢を取る。メタデータの `onlineReady:true` だけでは公開せず、実際にホストエンジンが登録され `remoteBoard/remoteLegal` があるもののみ表示。
3. **オンラインCPUの分岐削除**：`v2/games/remote-cpu.mjs` に既存ボットの挙動をそのまま移動。各ゲーム定義に `remoteCpuChoose` を登録。`v2/session/room-cpu-choice.mjs` は登録されたポリシーを呼ぶだけになった。CPUの見える情報は公開情報＋自分の手札のみという境界を維持。
4. **手札並び順のゲーム名判定を削除**：`v2/games/card-ranks.mjs` に大富豪の強さ規則を移動し、各ゲームが任意の `sortRank` を登録可能に。`v2/ui/card-order.mjs` は新ゲームでも共通。
5. **5本目の仮ゲーム試験**：`tests/v2-match-engine-catalog.test.mjs` と `tests/v2-fifth-game-extension.test.mjs`。定義だけ増やした新ゲームがオンラインで誤公開されないこと、ホストfactoryの登録で候補に入ること、ゲーム固有CPUとカード順位を共通ホスト/UIに手を入れずに追加できることを検証。
6. **UIも含めた「誤公開防止」**：`v2/ui/online-readiness.mjs` の `onlineUiGames()` をロビー入口に設置。ゲームは「host engine登録」「remoteBoard/remoteLegal」「既存タップ操作方式」「該当盤面surface」が揃って初めて選択可能。`tests/v2-online-readiness.test.mjs` で、仮の5本目がエンジン未登録・盤面未実装・未知の操作方式ではロビーに出ないこと、全条件が揃えば一覧に出ることを検査。これは実際のゲームの完成を保証するものではなく、未完成ゲームの誤表示を防止するゲート。


## 外部資料との照合
- [Robert Nystrom, Game Programming Patterns — Component](https://gameprogrammingpatterns.com/component.html)：ゲームルール・表示・通信を疎結合にしつつ、過度な抽象化は避けるという設計原則。今回、既存の動作保証された4ゲームの権威処理全体を作り直すことは避け、**登録場所と抽象契約だけ**を修正。
- [MDN JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)：ES Modulesの依存グラフを分けて扱う。各ゲームの定義、ロビー、オンラインengine catalog、UI surfaceのESM分離を維持。学校のGoogle Sites用HTMLでは最終的に単一ファイルへbundleするため、実ファイルとしての動的importは不要。
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)：環境を揃えたスクリーンショット比較を推奨。現在はChromium+WebKitで実スクリーンショットを収集し、300/375/450pxの表示領域とタッチ対象を座標で判定。**自動ピクセル差分用golden画像の管理はまだ未導入**。導入にはOS/フォント/アニメーション固定が必要。
- [Apple HIG — Designing for games](https://developer.apple.com/design/human-interface-guidelines/designing-for-games)：iPadの読みやすい文字とタッチ対象。現在の44px目標・チャット・ロビーおよび神経衰弱のUI検査に合致。ただしCSS pxとptが常に同じとは限らず、実学校iPadは未検証。
- [WCAG 2.2 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)：最小24 CSS pxまたは必要な間隔。重要操作はより大きい44pxを狙う。

## 実際に5本目を追加する手順
1. **選択**：既存の `draw / pick-one / pick-multi / flip` のどれかで遊べる、2人または4人用ゲームなら共通UIを流用できる。未対応の操作なら操作UI/アクション形式を拡張する必要あり。
2. **ルール**： `games.mjs` または独立したルールモジュールに、状態の作成・合法判定・更新を実装。
3. **プラグイン**：`v2/games/definitions.mjs` に `id, label, seats, boardKind, interaction, actions, createLocal, localBoard, localLegal, localHand, localCounts, remoteBoard, remoteLegal` を持つ定義を追加。必要に応じ `ui,localMove,cpuChoose,remoteCpuChoose,sortRank` を登録。
4. **オンライン権威エンジン**：既存ゲームの権威クラス/ファクトリーを参考に、public/privateの状態分離・command検証・CPUターンを実装。`v2/session/match-engine-catalog.mjs` にそのfactoryを**1件登録**。この作業は現状ゼロにはならない。
5. **表示面**：既存 `boardKind` なら共有surfaceを再利用。新しい盤面なら `v2/ui/board-surfaces.mjs` へ表示関数を追加。新しいinteractionなら `table-renderer.mjs` と `room-session.mjs` の入力契約も拡張。
6. **解禁**：新ゲームの単体＋オンラインエミュレーター＋Chromium/WebKitを合格させてから `onlineReady:true`。エンジンfactory・盤面surface・対応操作のどれかが不足していれば、フラグを立ててもロビーには表示されない。

## 残存する制約・次の優先順位
- `online/four-seat-authority.mjs` の旧3ゲームadapterと `v2/session/two-player-memory-match.mjs` はまだ固有エンジン。**5本目に応じたホスト権威adapterは必要**で、「定義1つで新ゲームが完成」とは言えない。
- 通信の `v2/session/room-match-guest.mjs` は `draw, play, pass, flip` の受理リストが固定。全く新しいアクションを持つゲームには拡張が必要。
- `v2/session/room-session.mjs` は既存4種の合法アクションの形式に限定。新操作を足すときはUI/通信/権威処理の整合性チェックを優先する。
- ロビーの実ゲーム候補は `onlineReady` とfactory両方で管理。安全な段階的追加は可能。
- **4人上限・2人/4人対戦が前提**。3人・5人ゲームなどは別途Room座席設計が必要。
- **学校iPad Google Sites実機**の体感は、Chromium/WebKitのCIだけでは最終的に保証できない。
- 短期の推奨は「まず5本目は既存の4操作方式の範囲で小さなゲームを1本作り、登録〜対戦完了まで通して拡張契約を実証する」。既存4ゲームの構造を丸ごと一斉に書き換えるのは避ける。

## 基盤テスト最終確認（更新）
[Foundation #40785659022](https://github.com/8mahi8/trump-collection/actions/runs/40785659022) が **206/206 PASS**。第五ゲームのfactory登録、実ホストrunnerのprivate→public配信経路、CPU戦略差し替え、Jokerの強さ順、画面/入力未対応時の誤公開防止を含む。CIのNodeチェックに加えて、ブラウザ版CPU画面・Safari系WebKitの基本UI検査も成功した。

## 品質ゲート
- [x] このrefactorのFoundation Node unitテスト全合格（206/206）
- [ ] Chrome/WebKit両方で4ゲームを同室で完走
- [ ] 神経衰弱CPUの独立ブラウザテスト合格
- [x] 5本目の仮ゲームのオンライン登録・CPU・手札ソートのテスト合格
- [ ] 学校実機 Google Sites で接続・操作体感を確認（公開前）

**変更可能範囲：GitHub開発ブランチ/Draft PR #2のみ。main・学校Google Sites版・本番Firebase・Google Driveは変更しない。**
