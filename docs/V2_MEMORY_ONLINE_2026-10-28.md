# トランプコレクション V2｜神経衰弱2人対戦の共通ルーム統合（2026-10-28）

## ユーザーの確定条件
- 学校iPad Safari、Google Sitesへ単体HTML直接埋め込み、友達だけで遊ぶ。Firebase匿名認証は不要、再読み込み復帰は実装しない。
- 共通ルームに4人まで集合し、遊ぶゲームを後から選ぶ。4人席ゲームは人数不足をCPU補充。神経衰弱は2人席で、1人の場合CPUが対戦する。

## 実装したコード
- `v2/session/two-player-memory-match.mjs`：オリジナル `games.mjs` の `createShinkei` / `shinkeiFlip` / `botShinkei` を使い、共通のMatch ID・Revision・参加者UID席の契約へ橋渡し。4人ゲームのエンジンは変更しない。CPUはホストのみで操作。
- 公開データの24枚タイルは未公開面を `card:null` として保存し、**現在めくったカード、直前の2枚、取得済みカード**のみ公開。全部の裏面情報をFirebaseに送らない。自分専用データに盤面の裏側・全配札は入れない。
- `v2/games/definitions.mjs`：既存の共通Table Rendererへの `remoteBoard`・`remoteLegal` 契約を追加。ゲームごとの別画面/iframe増築はしない。
- `v2/core/unified-view.mjs`、`v2/session/room-session.mjs`、`v2/session/room-match-guest.mjs`：2人対戦の得点・タイル表示・`flip` アクションを既存のオンラインセッションと共通レンダラーで処理。
- `v2/session/room-match-host.mjs`：4人席ルールと2人神経衰弱のHost Matchをゲーム名で選び、既存の配信・ACK・結果確定・ロビー復帰処理を共通利用。
- `v2/online-app.mjs`：神経衰弱を共通ルームゲーム選択に追加。人間1人ならCPU1人で即対戦可能。4人の共通ルームならホストが対戦相手を選んで2人対戦、残り2人は待機画面（観戦映像は無し）。

## 検証状況
- [Foundation V2 #40537665007](https://github.com/8mahi8/trump-collection/actions/runs/40537665007)：神経衰弱の非公開タイル、古いID操作拒否、人間2人 / 人間1人+CPU1人のMatch完走、4人部屋の席制御を含む **161項目のテスト成功**。
- ブラウザ E2E は `dev/verify-v2-online-ui.mjs` に、ババ抜き・七並べ・大富豪3ゲームから同じ部屋で神経衰弱へ切替→24枚の全操作→結果/ロビー復帰、別の4人部屋で対戦する2人を選び残り2人を待機させる試験を追加。
- [ブラウザCI #40538621253](https://github.com/8mahi8/trump-collection/actions/runs/40538621253) の完了後に成否を確認すること。初回 #40537939977 は神経衰弱の前にババ抜きでカードindex0だけを引き続け極端に長引き失敗、テストの選択位置を固定値から擬似乱数に変更した。
- **学校の実iPadで確認した結果ではない**。本番 Firebase Rules/DB/Auth・Google Sites実公開版・main・Google Driveは変更していない。

## 次工程
- 神経衰弱ブラウザ実プレイの完走・表示とWebKitのデバッグ、CPU1人とホストの直接ブラウザ対戦の確認。
- 4ゲーム共通ロビーの小さな端末での操作性・レイアウトチェック、実機試遊版の準備（ユーザーが公開指示するまで本番には変更を加えない）。
- 認証、対戦リロード復帰、監視/ログ/複雑な権限UIなど、求められていない仕組みを増やさない。
