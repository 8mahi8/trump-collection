# トランプV2｜神経衰弱1人＋CPU1人 ブラウザ完走と画面検証（2026-10-28）

## 実装・実証したこと
- 5桁の共通ルームをホスト1人で作成し、神経衰弱を選ぶと2席目をCPUが補う。人間1人の準備操作だけで開始できる。
- 既存の共通 Table Renderer の24枚カードを、Playwrightで実際にタップ。CPUはホスト上で既存ゲームルールのbotShinkeiにより自動進行。全カード取得、結果画面、同じルーム番号のロビーへ戻るところまで成功。
- 公開タイルの未公開カードがnullで始まることを確認。24枚配置、800x450および667x375の横向き表示、横スクロールなしをチェック。
- Google Sites埋め込み風のsandboxに、外部CDNや入れ子iframeを持たない単体HTMLを埋め込んで検証。Firebase RTDBローカルエミュレーターのみ使用。**匿名Auth呼出0件**。

## 新規コード
- dev/verify-v2-memory-cpu-ui.mjs：1人＋CPUの神経衰弱をブラウザ操作で最後まで進める独立試験。ゲームエンジン状態や伏せ札を直接参照せず、公開された札の情報だけを記憶して試験操作。
- .github/workflows/room-v2-memory-cpu.yml：ChromiumとWebKitでそれぞれ全試合完走。800x450と667x375の画面スクリーンショットを Actions Artifact (v2-memory-cpu-screen-proof) に保存。

## 確認したCI結果
- **[Actions #40543537886 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40543537886)**。
- Chromium：人間のタップ26回、CPUが進行した期間のrevision増分14を観測、対局完走→共通ルーム復帰、Firebase Auth 0件。
- WebKit：人間のタップ14回、CPU進行期間のrevision増分24を観測、対局完走→共通ルーム復帰、Firebase Auth 0件。
- revision増分はCPUのflip回数を厳密に数えたものではない。CPUの動作は試合の進行・完走で確認。
- **[Actions #40539326131 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40539326131)**：2人＋CPU2人の大富豪→ババ抜き→七並べと、人間2人の神経衰弱を同じルームで4ゲーム連続完走。4人部屋から神経衰弱の2人を選ぶ・残り2人待機も検証。

## 4ゲームの到達点と次の確認
- ババ抜き、七並べ、大富豪：共通ルームでCPU補充してブラウザ全対局完走。神経衰弱：人間2人、または人間1人＋CPU1人でブラウザ完走。
- **学校iPad Safari・実際のGoogle Sites埋め込み・学校ネットワーク・本番Firebase接続は未検証**。エミュレーター上での成功が学校での接続成功を保証するわけではない。
- 学校試遊版の動作には実RTDB接続先と、既存の本番Rulesに適切に統合した接続権限が必要。現行本番DB/Rulesを無断変更しない。
- **main、学校Google Sites公開版、本番Firebase Rules/DB、Driveは無変更**。匿名認証、ホストリロードからの試合復帰も追加していない。

## 次担当の方針
実際の学校Safariで快適に遊べることを優先し、必要な操作性・通信の不具合修正だけを実施。不要な復帰・ログ・認証機能を先回りで追加しない。ユーザーが許可するまで公開先や本番接続設定を変更しない。
