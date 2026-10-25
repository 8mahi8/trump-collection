# トランプコレクション｜Phase 7：ホスト一時通信断への対策（2026-10-25）

## 成果
**Firebase本番は触らず、開発ブランチ内のRTDBルール／クライアント／UIを更新し、GitHub Actions上の実Firebase Local Emulator＋独立4ブラウザで検証成功。**

- [CI成功 Run 40170975967](https://github.com/8mahi8/trump-collection/actions/runs/40170975967)：Node自動テスト **60/60合格**、Firebase Emulatorでババ抜き28手・七並べ52手・大富豪97手を4人で完走、各ゲーム再戦合格。
- Playwright Chromiumでは3ゲームそれぞれ独立4画面でルーム入室→準備→開始→最初の操作を同期。**ババ抜きの4画面試験で、ホストからFirebaseへのheartbeat通信のみを遮断してゲストの操作停止を確認し、遮断解除後の自動復帰まで成功**。
- 800×450ブラウザでの未設定Firebase接続先のエラー表示を確認。
- `dev/build-online-html.mjs`で単一HTMLを再生成し、`dist/trump-collection-online-lab.html`と内容一致・JavaScript構文検査成功。今回の単体HTMLは56,069文字。**実Firebase本番URL／Web API key未投入の研究版**。

## 実装内容
1. `online/firebase-room-store.mjs`：RTDBに`heartbeat`取得・送信メソッドを追加。送信するシーケンスは正整数。
2. `firebase/trump-rooms.rules.json`：心拍は**ホストUIDだけが書き込める**。読めるのは席が承認されたUIDのみ。心拍シーケンスは単調増加し、後戻りできない。匿名ログインしていない人や部外者は読めない。
3. `online/firebase-room-controller.mjs`：
   - ホストは通常の処理ループで約2.8秒に1回heartbeatシーケンスを更新。送信失敗・応答損失の後は必ず新しいシーケンスで再試行。
   - ゲストはRTDB上の**サーバーが承認したホストのシーケンス**を読み、前進したかをローカルの経過時間で判定。学校iPadのシステム時計のズレに依存しない。
   - 約15秒間シーケンスが進まない場合は`host_unavailable`とし、古いスナップショットを破棄。以後の`act`は拒否して不正な操作を防ぐ。更新が再開されたら同じUID／同じ席で自動的に同期を再開。
4. `online/four-seat-remote.html`：ホスト停止時の説明と、復帰した際のメッセージ。未同期中はゲーム操作ボタンを無効化。
5. `tests/firebase-room-controller.test.mjs`・`tests/firebase-room-store.test.mjs`・`tests/firebase-emulator.e2e.mjs`：通信停止前後、HTTP応答損失時のシーケンス再試行、本人以外のheartbeat読取／なりすまし書込拒否を追加。
6. `dev/verify-online-browser.mjs`：4画面でホストのheartbeat送信だけを妨害し、停止→通信復帰の画面表示と同期を再現。

## 今回対応した範囲と残る重要課題

**対応済み：ホストの一時的な通信停止・復旧（ページは開いたまま、認証UIDとゲーム状態を保持した場合）。**

**未対応：**
- ページ再読み込み後の元の席・匿名UIDの復元。現在の認証はメモリ内で、学校のGoogle Sites iframeではWeb Storageを使わない方針。再読み込みでUIDが変わり、同じ席に戻れない。
- ホストのページを完全に閉じたり再読み込みした際の全手札／山札／ターン状態の再構築。ホスト権威エンジンはメモリ内。Firebaseの公開／privateだけでは完全な対局再開を安全に再現できない。
- ローカルネットワークが長時間切れた際のゲストからの未完了コマンド扱い、孤立した部屋データの削除・期限管理。Firebase本番での利用量・ルール統合検証。
- Safari旧iPad・Google Sites直接埋込での通信検証。現CIはChromiumとデモFirebase Emulatorのみ。
- 現行v1.5.5 COMゲームのメニューへの統合と、神経衰弱（Supabase試作）との通信方式統合。

**重要：GitHub Pages通常版（main/index.html v1.4.0）、COM開発版（dev/index.html v1.5.5）、学校Google Sites版、既存の他ゲームのFirebase Rulesは変更していない。**

## 2026-10-25 確定した方針変更

オーナーと合意：身内で気軽に遊ぶ用途なので、**ページ再読み込み・終了後のゲーム復元は開発対象外**。以下の旧「次の実装候補」の復元関連項目は撤回する。ページを開いたままの通信断復帰は維持。ホスト終了時の案内、新ルーム作成、実Firebase接続、既存ゲーム統合に注力する。

## 次の実装候補
1. ホストの秘密ゲーム状態を安全に復元する技術案を比較。学校SitesでlocalStorage/sessionStorageを使えない制約を維持。単純に`public`へ配札やシードを載せない。
2. ゲストの再参加はUIDの安定性とアクションIDの重複防止が鍵。短い部屋番号だけを本人認証に使わない。
3. ルーム掃除・無料枠の保護、画面の小型化と全メニュー統合の順で検証。
4. Firebase実接続用の専用設定は、他ゲームの本番DB・Rulesに一切干渉しない構成を用意してから導入。

## 再現コマンド
```bash
node --test tests/*.test.mjs
node dev/build-online-html.mjs
npx --yes firebase-tools@15.30.1 emulators:exec --project demo-trumpcards --config firebase.emulator.json --only auth,database "node --test tests/firebase-emulator.e2e.mjs && TC_BROWSER_EMULATOR=1 node dev/verify-online-browser.mjs"
```
