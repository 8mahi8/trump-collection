# トランプコレクション V2｜2人対戦の相手選択・観戦UI（2026-10-29）

## 最終検証（PASS）
- **Foundation：[Actions #40782495069](https://github.com/8mahi8/trump-collection/actions/runs/40782495069)** — **192/192件 PASS**（対戦メンバー・観戦者・CPU対戦・プロジェクション不変性の追加4件含む）。
- **オンライン Chromium・WebKit：[Actions #40782540655](https://github.com/8mahi8/trump-collection/actions/runs/40782540655)** — **SUCCESS**。両エンジンで、Firebase Emulator無認証チャット、大富豪→ババ抜き→七並べ→神経衰弱の同室連戦、4人ルームにおける2人対戦＋観戦2人の役割・準備ボタン検証が合格。300/375/450pxで相手選択ボタンの最小高さ43.5px、横幅の収まり、下部操作欄とスクロールの可用性もPASS。
- 実際のActions artifact `12858740002` からスクリーンショットを取得し、`online-two-seat-picker-webkit-667x300.png`、`online-two-seat-picker-webkit-667x375.png`、`online-two-seat-picker-webkit-800x450.png` を目視確認。**選択中P3が黄、P2/P4が未選択、対戦P1 VS P3・観戦P2/P4、準備/開始/退出ボタンがいずれも画面内**。短画面ではゲーム選択部分が縦スクロールする一方、重要な役割・操作は下部に表示される。
- 学校のiPad Safari＋本物のGoogle SitesへHTMLを貼り付けた実機検証は**未完了**。ブラウザEmulatorの合格を実機合格と混同しない。

---

## 背景
- 4人ルームで神経衰弱を選んだ場合、以前はホストに `P2 と対戦 / P3 と対戦 / P4 と対戦` の縦並びボタンだけを出していた。
- メンバー全員に「誰が対戦するか」「自分は観戦なのか」が直接表示されず、特に高さ300px程度のGoogle Sites埋め込みではゲーム選択・準備・退出と重なってUIが煩雑だった。
- 既存の `setParticipants` と2人選択の権威処理は機能していたため、**ルール・通信は触らずUI投影と検証を中心に改善**。

## 実装
1. `v2/ui/seat-selection.mjs` に `projectHeadToHead(room,{selfId,isCpuSeat})` を追加。会員リストの順番からP1～P4の表示名を計算し、対戦する2人・観戦する人・自分の役割・選択可能な相手を返す。データは読み取りのみ。
2. `v2/online-app.mjs` の2人用ゲーム共通ロビーで、**「対戦：P1 VS P3」「観戦：P2・P4」**の組み合わせ、自分が対戦メンバーか観戦者かを表示。ホストのみ相手選択グリッドを表示し、ゲストには選択ボタンを表示しない。選択済みボタンには `aria-pressed=true` と強調表示を付ける。
3. `v2/ui/online-shell.css` に横3列・44px以上の対戦相手ボタンを実装。高さ430px以下は余白を圧縮して、準備・開始・退出の操作欄を下端に固定しスクロール可能にする。
4. `v2/ui/room-notice.mjs` のロビー観戦者の文言を「対戦中の友達がプレイします」という不正確な説明から、**「今回は観戦（準備不要）」**に修正。
5. `tests/v2-seat-selection.test.mjs` に役割/番号/CPU/不変性の独立テスト4件を追加、`tests/v2-room-notice.test.mjs` を更新。
6. `dev/verify-v2-online-ui.mjs` に本物の4人Firebase EmulatorルームでのP3選択、P2・P4の観戦表示、未選択メンバーに準備ボタンを出さない検査、800×450・667×375・667×300のChromium/WebKitスクリーンショット・ボタン座標検査を追加。

## 確認結果
- **Foundation #40782495069**：**192/192件 PASS**。追加した相手選択の4単体テストも合格。
- 新UI全体の静的構文チェック、DOM非依存投影スモークはPASS。
- **オンラインE2E #40782540655**：後続実行は上記の通り SUCCESS。WebKit実画像も目視確認済み。

## 次の検証
- 4人ルームでホストがP3を選んだとき、P1対P3・P2/P4観戦と正しく表示されること。
- 300px高では下端操作欄と3人分の選択ボタンがスクロール操作で届くこと。
- 4ゲーム連戦・双方向チャット・CPU補充・神経衰弱2人対戦と残り2人観戦がChromium/WebKit双方で成功すること。
- 学校iPad Safari + 実Google Sites貼り付けは未実施。未確認を完成扱いしない。

**作業対象は開発ブランチ `refactor/unified-core-and-school-network-20261027`、Draft PR #2のみ。Google Sites公開版・main・本番Firebaseルール/DB・Google Driveは変更しない。**
