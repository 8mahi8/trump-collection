# トランプV2｜不足人数はCPUで自動補充（2026-10-27）

## 本人の要望
大富豪など人数が足りない場合、空席をCPUで補う。友達だけですぐ遊べることを重視し、匿名認証や再読み込み復帰は追加しない。

## 今回実装した仕様
- 大富豪・七並べ・ババ抜きは4席。人間1→CPU3、人間2→CPU2、人間3→CPU1、人間4→CPU0。
- 共通ルーム内でゲーム選択時に自動補充。CPU席はルームの本当のメンバーには含めず、ホストだけが操作する。CPU通信接続や追加の認証は不要。
- 対戦開始前に新しい友達が入室すると空いているCPU席を人間に置換し、Readyをリセット。Readyが必要なのは人間だけ。
- CPUの行動は既存のgames.mjsのババ抜き・七並べ・大富豪BOTをV2専用アダプターから再利用。既存V1通信エンジンは元に戻し、学校版コードはそのまま保持。
- V2共通テーブルとロビーにCPU人数/CPUの席表示を追加。
- 神経衰弱も共通Room状態管理では人間1＋CPU1を表現。ただしオンライン神経衰弱そのものは未実装。

## 変更した場所
- v2/core/shared-room.mjs：人数不足・入退室時のCPU補充、Ready/Match開始制御。
- v2/session/room-cpu-choice.mjs：CPU判断アダプター。CPU本人の手札と公開対戦情報のみから既存BOTを使用。
- v2/session/four-player-match.mjs：CPU席の初期化とホスト内部CPU手番。
- v2/session/room-match-host.mjs：1回のTickでCPU1手。CPUの秘密手札はFirebaseへアップロードしない。
- v2/core/unified-view.mjs、v2/ui/table-renderer.mjs、v2/online-app.mjs：CPUの席と人数を表示し、人間だけReadyを要求。
- tests/v2-shared-room.test.mjs、tests/v2-cpu-fill-match.test.mjs、dev/verify-v2-online-ui.mjs：不足人数とゲーム完走、友達2人＋CPU2人の実画面を検証。

## 実証
- [Foundation V2 Actions #40525433775 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40525433775)：人間1＋CPU3でババ抜き・七並べ・大富豪をそれぞれ最後まで完走。旧学校向けHTMLとソース一致の回帰テストも成功。
- [V2 Firebase UI Actions #40525838166 SUCCESS](https://github.com/8mahi8/trump-collection/actions/runs/40525838166)：Chromium/WebKitで4人対戦の回帰と、人間2＋CPU2の大富豪ロビー→対戦開始→共通カードテーブル表示・CPU2席の可視化を確認。Firebase Auth呼び出し0。
- 人間2＋CPU2の実ブラウザ全ターン完走および学校実iPadでの動作はまだ未確認。

## 今後の注意
- 対戦中に人間が退出した時のCPUによる試合引継ぎは実装せず、既存どおり中断。友達が対戦開始前に参加した場合だけCPU席を置換する。
- 神経衰弱のオンライン通信・UIは将来工程で対応。
- main、学校Google Sites版、本番Firebase Rules/DB、Supabase、Google Driveは無変更。
