# トランプコレクション V2｜CPU混合対戦ブラウザ完走＋ホスト通信削減（2026-10-28 JST）

## 今回の実装
- `dev/verify-v2-online-ui.mjs`：Google Sites風iframe内部で、友達2人＋CPU2人の大富豪を**実際のカード選択・提出・パスのタップ操作のみで全ターン完走**させ、結果画面から同一ルームへ戻るまで検証。ロビー→Ready→開始→全ゲーム進行→結果→戻る。
- `tests/v2-cpu-fill-match.test.mjs`：2人＋CPU2人のババ抜き/七並べ/大富豪が既存のゲームルールですべて終局まで進行する回帰テストを追加。
- `v2/session/room-match-host.mjs`：ホストが直前に取得したRoom状態をMatch Tickへ渡す。再度のルーム読み込みを避け、実際のMatch操作/CPU進行は変えない。
- `v2/online-app.mjs`：Host Frame内で同じRoomを重複取得せず、Match更新がなければ直前のRoomを再利用。UIテスト用にpending判定を提供。認証無し方式を維持。

## 合格した実証（開発ブランチ）
- **[Actions #40527541963: success](https://github.com/8mahi8/trump-collection/actions/runs/40527541963)**。ChromiumとWebKit(Safariエンジン)で、4人の通常対戦のルーム入室→ババ抜き初手同期、および**人間2＋CPU2大富豪の全ゲーム操作・結果・同一ルーム復帰**。
- Chromium：人間カード/パス操作44手、CPU手番観測18回。混合大富豪1試合44,931ms（ローカルエミュレーター、UI上の経過時間）。
- WebKit：人間カード/パス操作41手、CPU手番観測19回。混合大富豪1試合43,111ms（同上）。
- **匿名認証/API呼び出し0件**。Authエミュレーター起動なし。JavaScript/CSS同梱の1HTMLをビルドし、Google Sites風sandbox埋め込みで検証。
- ネットワーク読取：同等の4人初手回帰シナリオで、以前の #40525838166 はChromium 126・WebKit 131 GET、今回 #40527541963 はChromium 111・WebKit 116 GET（どちらも41書込み、各15 GET削減）。約12%削減は**CI上の模擬ネットワークの観測**であり、学校の速度保証ではない。
- **[Foundation V2 #40527425180: success](https://github.com/8mahi8/trump-collection/actions/runs/40527425180)**。ホスト通信削減後の既存ゲーム回帰テストと追加した人間2＋CPU2人の3ゲーム完走Nodeテストも成功。

## 守った条件
- **学校用V2では匿名認証も再読み込み復帰も導入しない**。CPUはホストで実行し追加接続不要。
- Google Sitesで稼働中の版、main、本番Firebase Auth/RTDB Rules/DB、Supabase、Driveは全て変更なし。
- CPU混合大富豪は現時点で学校実機で未試験。オンライン神経衰弱の完成、学校iPadの接続性、長時間安定性は未完了。

## 次の作業
- 友達2人＋CPU2人のババ抜き/七並べについても実画面の操作完走をブラウザで確認。
- ロビーに人間が途中入室した時、CPU席が置換されるUIとReadyリセットを複数ブラウザで再確認。
- 既存のゲーム共通ルームを完成させるまで、不要な再ログイン/復帰/ログ管理を実装しない。学校試遊HTMLの準備は本番ルールを変えずに安全性を確認してから進める。
