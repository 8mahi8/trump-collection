# トランプコレクション｜最新引き継ぎ（2026-10-25）

> **次の開発担当AIはまずこの文書と [HANDOFF.md](../HANDOFF.md) を読むこと。**
> 旧記録には後から変更された計画が残るため、下記の最新方針を優先。

## Phase16（2026-10-25）｜学校Safari系WebKitの対戦試験成功

- Playwright **WebKit + Chromium 両エンジン**でCOM4／友達4＝8入口の起動、Firebase Emulatorの**4独立ブラウザ×ババ抜き・七並べ・大富豪**のREADY→初手同期、ホスト通信断復旧、退出→新ルームが合格。
- **[GitHub Actions #40198456792](https://github.com/8mahi8/trump-collection/actions/runs/40198456792) 成功、Node 93/93、失敗0**。詳細は[Phase16資料](PHASE16_WEBKIT_SAFARI_REGRESSION_2026-10-25.md)。`TC_BROWSER_ENGINE=webkit`でUIテストを再現できる。
- LEMON CLASHの開発ブランチ `dev/ipad-hand-ui` にて実際の `/lemonClashRoomsV1` 使用・旧Firebase共用時の**Authなし**接続を確認。Phase15を更新。旧ゲームのアクセスをAuth必須に変更してはいけない。
- 本番Firebase・Google Sites・学校Safari実機は**未変更／未検証**。WebKitの合格はiOS実機合格を意味しない。繰り返しのRulesスクリーンショット要求はしない。
- 次は実校内Google Sitesで使用中のパスの全件確認、期限切れ（11月8日）の対応案、既存ユーザーの負担を減らす小さなUI改善。高度な不正対策は作らない。

## 最優先のユーザー方針追記（2026-10-25）｜身内対戦、不正対策は軽量でよい

- 利用者は学校の友達だけ。**対戦相手の悪意ある不正・チート対策に時間をかけすぎない**。開発優先順位は「友達と4ゲームで遊べる → 操作が簡単 → iPad Safari/Google Sitesで軽く安定 → 必要最小限の権限と通信費対策」。
- 高度なチート検知・リプレイ監視・対戦ログ収集・複雑なユーザー認証やホスト移譲・故意の不正操作対策は要求しない。既存のホスト権威方式を無理に強化しない。
- **不正対策とDBの基本的な権限分離は別**：不用意に全手札を公開したり、他の既存ゲームの読み書きや無料枠を壊したりしないための最低限は維持する。Security Rules移行作業もこの必要最小限に限定し、対戦可能な状態への前進を止める過剰設計を避ける。
- ルールは前に確認したものから変更していないと本人が確認済み。**同じRulesスクリーンショットは再要求しない**。本番更新・既存ゲームへの影響がある操作は別途慎重に扱い、学校のGoogle Sites版を独断で変更しない。
- この段落は過去の過剰な不正対策優先案より優先する。

## Phase 15 更新（2026-10-25）｜以前のRulesが現在も変わっていないことを本人が確認

- 本人の説明：以前確認した `mygame-df915` の期限付きルート全体の読書き許可が**現在も変わっていない**。10/22の記録の期限は **2026-11-08 00:00 JST**。この本人確認を受けて**同じスクリーンショットの再提出は求めない**（管理APIで現行Rulesを独立に再読込したわけではない）。
- 親ルートの許可は子で拒否できないため、いまのまま `/trumpRoomsV1` に非公開手札を置くことはできない。既存Firebaseを再利用しつつ、旧ゲームのルートへ権限を局所化してトランプ専用ルートに別権限を用意する**移行案**を開発ブランチに追加。
- [Phase 15作業内容](PHASE15_OPEN_ROOT_MIGRATION_2026-10-25.md)／`dev/plan-open-root-migration.mjs`／`tests/plan-open-root-migration.test.mjs`／`tests/firebase-scoped-emulator.e2e.mjs`。架空ルールからレビュー用候補を作り、実FirebaseではなくFirebase Emulatorで旧ルート／手札分離を検証する。**[CI #40197234549](https://github.com/8mahi8/trump-collection/actions/runs/40197234549)成功（Node 93/93、旧4ルートの権限維持＋トランプ手札分離のEmulator確認）**。
- 本番未解決：実際の全ゲーム利用パスの網羅性、匿名Firebase Auth、旧ゲームのルール期限切れ対処、オーナーの本番変更承認。**本番のFirebase・Google Sites版・main・PRのDraft状態は変更しない**。

## Phase 14 更新（2026-10-25）｜七並べの確定操作・本番Rules未確認

- [作業・ゲートの詳細](PHASE14_SEVEN_AND_FIREBASE_GATE_2026-10-25.md)。オンライン七並べの「タップ選択→確定ボタン」に修正し、誤タップ送信を防止。最新の単体HTMLを再生成・GitHubに保存。
- **[GitHub Actions #40196219631](https://github.com/8mahi8/trump-collection/actions/runs/40196219631) 成功：Node 89/89、Chromium4ゲーム×COM/友達8入口、Firebase Auth/RTDB Emulator4画面、共有の合成Rules Emulatorすべて合格。**
- 過去2026-10-22に記録された期限付きルート公開Rulesは、共有ルール合成時に拒否されることを追加テストで確認。**過去スクショを現行本番Rulesと同一視しない。**
- 本番の `mygame-df915` Realtime Database Security Rulesの全文は今回も取得できなかった。現在のFirebase Console Rules全文の共有が、次の管理者操作の最小要件。
- Firebase本番・学校Google Sites版・main公開COM版は未変更。PR #1はDraft継続。

## プロジェクトと直近の検証

- GitHub: https://github.com/8mahi8/trump-collection
- 開発ブランチ: `dev/quality-and-ui-v1-5-20261024`
- Draft PR: https://github.com/8mahi8/trump-collection/pull/1
- 最新確認済み GitHub Actions 成功: https://github.com/8mahi8/trump-collection/actions/runs/40198456792 （**Node 93/93件合格**）。CIは Firebase Local Emulator と Chromium **および WebKit** を使用。本番Firebase／学校iPad実機での合格ではない。
- `main/index.html` は公開COM版 **v1.4.0**、開発ブランチの`index.html`はCOM版 **v1.5.5**。本人承認なしに公開・学校Google Sites版を上書きしない。

## ゲーム仕様・完成状況

**学校iPad（Safari）で友達と遊ぶ、軽量なトランプゲーム集**。Google Sitesへの公開方法はGitHub PagesのURL埋め込みではなく、**HTML/CSS/JS全文をGoogle Sitesの「埋め込みコード」に直接貼る**こと。横向き・旧世代iPad・無料運用が条件。

- 4種類：**ババ抜き、七並べ、神経衰弱、大富豪**。COMモードはいずれも開発版に実装。
- **ババ抜き／七並べ／大富豪**：Firebase Auth匿名認証＋Realtime Database RESTによる**4人オンライン開発版**。ホストがルールと全手札の権威を保持。ゲストは本人のprivate手札だけ閲覧。4人入室、READY、開始、操作、勝敗、再戦、退出、ホスト一時通信断の安全停止／同一ページ内復帰をローカルエミュレーターとChromium4画面で検証済み。
- **神経衰弱**：**2人のSupabase Realtime公開Broadcast試作**。ユーザーがPC＋スマホで試遊成功。Firebase3ゲームとは別通信・公開ルーム番号に実質的な認証はない。学校Safari未確認。
- 4ゲーム×「COM／友達」共通選択メニューの**研究用単一HTML**を`dev/build-collection-lab.mjs`からビルド。Chromiumで全8入口を確認。本番Firebase設定はまだ入っていない。

## ユーザーが確定した最新方針

1. **既存のFirebase `mygame-df915` を再利用する方向**。新規Firebase作成を必須としない。既存ゲームを壊さないよう、トランプのパス`/trumpRoomsV1`を独立させる。
2. **対局中にページ再読み込みした場合、同じ試合への復元は不要**。更新したら新部屋を作り直す。ページを開いたままの一時通信断だけ復旧可能とする。
3. **複雑なセキュリティ機能より遊びやすさ**を優先。ただし他人の手札が見える状態、既存Firebaseの破壊、意図しない課金・公開変更は避ける。
4. 原則、細かな確認は挟まず調査→実装→自動テスト→GitHub記録まで進める。「任せた」は継続作業の委任。**実機・管理者操作が不可欠になった場合だけユーザーに最小限の依頼**。
5. 公開版＝**学校Google Sitesへ直接HTMLを貼り、友達が遊べる状態**。GitHubへのコミットやGitHub Pagesだけでは公開完了ではない。

## Firebase共有で残る唯一の大きなブロッカー

- 最新の`online/firebase-dedicated-guard.mjs`は関数`validateFirebaseConfig`で**既存`mygame-df915`を形式上許容する**よう改修済み。旧関数名は互換エイリアス。これだけで本番利用可能・プライバシー安全とは判断しない。
- `dev/merge-existing-firebase-rules.mjs`：実際の既存Rulesを**オフライン**で読み、旧ルールを維持して`trumpRoomsV1`だけを追加するレビュー候補を生成。祖先での広い許可、ルートワイルドカードなどは自動合成を拒否。
- `firebase/SHARED_DATABASE_RULES.md`：監査／合成手順。旧ゲームの**架空サンプルRules**に対する合成のエミュレーター試験では、旧権限維持・手札分離・3ゲーム4人戦完走を確認。
- **重要：現在のRulesは10/22に確認したルート全体の期限付き許可と変わっていないと本人が確認済み。ただし、管理APIによる現行Rulesの独立再取得は未実施。** 同じスクリーンショットの再提出は求めず、Phase15のオフライン移行候補を先にテストする。実適用前には全利用パスの棚卸し・バックアップ・明示承認が必要。
- **過去チャットの手がかり**：2026-10-22の別ゲーム開発チャットにFirebase Rules画面のスクリーンショットを送ったという履歴が見つかった。当時の会話ではルート全体を期限付きで許可するルールの可能性が指摘された。ただし**対象プロジェクト名・元画像・現在の適用状態は確認できない**。必ず現Rulesで再判定する。もしルートから読取を許可しているなら、子の非公開手札ルールでは取り消せない。
- **本番Rulesのデプロイ／既存ゲームのデータ操作は未実施**。本番Rules全文の取得・バックアップ・差分レビュー・旧ゲーム含むEmulator検証までは接続先設定を公開HTMLへ埋め込まない。

## 次の担当AIがする作業

1. まず`HANDOFF.md`／`firebase/SHARED_DATABASE_RULES.md`／現開発PR、CI成功記録を確認。過去資料の「新規Firebase必須」「接続ガード未更新」等は**古い**ので優先しない。
2. 本人が過去に確認したRulesを今も変えていないと明言済み。同じ資料は再要求せず、開発済みのPhase15スコープ移行案を利用する。既存ゲーム利用パスの洗い出し・旧ゲームを壊さないテストを優先する。管理者秘密鍵やログイン情報は要求しない。
3. 現Rulesが判明したら、`dev/merge-existing-firebase-rules.mjs`で危険な親許可・既存ゲームの影響を検査。必要なら安全な改善案を検討。**無承認の本番変更はしない**。
4. 合成候補をローカルEmulatorで旧ゲームの権限・トランプのprivate/command権限と4人戦の両方でテスト。成功後にだけ本番接続作業へ移行する。
5. 手元で進められる残作業：旧世代Safari向け表示、軽量な放置ルーム整理、統合UIの改善とCI整備。4ゲーム統合は独立iframe研究版であり正式版への配布は未完了。

## 主なコードと検証の入口

- `games.mjs`：4ゲーム共通ルール
- `online/four-seat-authority.mjs`：4人対戦のホスト権威
- `online/firebase-room-store.mjs`／`online/firebase-room-controller.mjs`：Auth/RTDBとホスト/ゲストの操作同期
- `online/four-seat-remote.html` → `dev/build-online-html.mjs` → `dist/trump-collection-online-lab.html`：Firebase4人開発版の単体HTML
- `online/memory-remote.html`／`online/memory-authority.mjs`／`online/realtime-wire.mjs`：神経衰弱2人Supabase試作
- `online/collection-launcher.template.html`／`dev/build-collection-lab.mjs`：共通4ゲームメニューと単体HTMLの研究ビルド
- `firebase/trump-rooms.rules.json`：**単独トランプ専用**のRules。**既存本番Firebaseへファイル丸ごと適用してはいけない**。
- `firebase.shared-emulator.json`と`tests/firebase-shared-emulator.e2e.mjs`：既存の架空ルールを合成したエミュレーター検証
- `.github/workflows/firebase-emulator-ci.yml`：Node→単体HTML→Chromium＋WebKit→Firebase Auth/RTDB Emulator（両エンジン）→共有Rules Emulator

ユーザーが「任した」と言ったら**計画だけで止まらず、可能な範囲でGitHubへコミットし、CI結果の成功を確認して報告**すること。学校版・本番Rulesは独断で触らない。
