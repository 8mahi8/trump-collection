# トランプコレクションV2｜カードUIの旧版復元（2026-10-28）

## 実機からの重要なフィードバック
- 学校Google Sites版V2で実際にFirebase接続・ルーム参加には成功した。
- ただし本人から「前良かったカードUIが悪くなっている」と明確に品質退行の指摘があった。
- 比較対象はGitHub `index.html` に残る旧v1.5系（以前に本人が良いと評価）。これを指針にし、V2の簡素な `♠A` テキストのカードを改善する。

## 今回の実装（通信は触らない）
- `v2/ui/card-face.mjs` を追加。旧版のトランプ表現に近いスート・ランクの上下角、数字札の配置（2～10）、Aの大マーク、J/Q/Kの中央の絵札風装飾、ジョーカー、模様入り青い裏面を共通部品化。
- `v2/ui/board-surfaces.mjs` は、ババ抜きの伏せ札、七並べの4×13列（置ける枠を黄色）、大富豪の場のカード、神経衰弱の24枚全てに同じカード部品を利用。`data-action`/`data-index`等の操作コマンドは変更しない。
- `v2/ui/table-renderer.mjs` は手札を数字順・スート順に整列し、重ねて並べ、合法なカードを水色で示し、選択中は持ち上げる。対戦相手の人数/得点を小さなアイコン付きで表示。
- `v2/ui/table.css` はフェルト調の緑色テーブル・白い陰影カード・青裏面・カードの重なり・選択状態の浮き上がりを旧版に近づけ、iPad横画面の短い高さにも対応。
- `dev/verify-v2-online-ui.mjs` にカード角・重なりの回帰判定、七並べ・大富豪の2サイズスクリーンショットを追加。

## 元の良さとして継承する未完了確認
- 旧版にはババ抜きの引いた札を大きく見せる演出、神経衰弱のペア成立時の強調、COMの吹き出しなどもあった。今回の第一段階は**カード見た目の復元**であり、ゲームごとの演出が完全に旧版と一致したという意味ではない。
- 画面レイアウト・タップ動作は必ずChromium/WebKitブラウザ試験で検証する。学校の実iPadで遊んだ本人の評価を優先。

## 変更していない範囲
- 共通ルームとホスト・ゲストのFirebase通信プロトコル、書込先、認証なし方式、手札の非公開範囲、CPU/ゲームルール、main、学校Google Sitesの実公開版、本番Firebase Rules/DB、既存Driveファイル。
- 実機テスト済みの旧HTMLはそのまま。新しいUI版は**開発ブランチで検証成功後に、差替え用として個別に渡す**。

## 検証証拠
- [Foundation V2 #40603055525 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40603055525) 161/161合格。
- [最新WebKit/Chromium実画面テスト](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-ui-emulator.yml) で4ゲームの実タップ完走・新画面のスクリーンショット合否を確認する。
- [神経衰弱CPU WebKit/Chromium](https://github.com/8mahi8/trump-collection/actions/workflows/room-v2-memory-cpu.yml) で24枚の配置と操作を確認する。
