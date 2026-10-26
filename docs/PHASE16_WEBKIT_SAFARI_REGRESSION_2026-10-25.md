# Phase16｜旧iPad Safariに近いWebKitの自動テストを追加

日付：2026-10-25。対象：`dev/quality-and-ui-v1-5-20261024`。**学校の実機Safari／Google Sites／本番Firebaseには接続していない。**

## 狙い
旧iPad SafariでのHTML直接埋め込みの試遊前に、Chromium専用だった自動試験をPlaywright WebKitでも実行する。4ゲームの入口と4人対戦の同期・回線復帰・退出を重点検査。**WebKitはSafariと同じエンジン系統だが、Linux版Playwright WebKitが学校のiOS Safariそのものという意味ではない**。

## 実装した変更
- `dev/verify-collection-launcher.mjs`：`TC_BROWSER_ENGINE=webkit`を指定するとWebKitで全4ゲーム×COM/友達の8入口を検査。通常は既存のChromiumを維持。
- `dev/verify-online-browser.mjs`：同変数でWebKitに切替。設定未指定ガード、Firebase Auth/RTDBローカルエミュレーターによる4独立ページ・3ゲームの入室→READY→開始→初手同期、七並べタップ選択後の確定、ホストの通信断→復旧、退出→ロビーメニューを検証。
- `.github/workflows/firebase-emulator-ci.yml`：Playwright 1.56.1のChromiumとWebKitを両方インストールし、両エンジンの入口テスト、未設定ガード、Firebase Emulator4ページ試験を実行。
- 設定エラーを防ぐため、`TC_BROWSER_ENGINE` は `chromium` / `webkit` の2択で検証。
- いずれも既存オンラインエンジンのプロトコル変更・配札処理変更なし。

## 実際の検証結果

**GitHub Actions #40198456792 成功**：https://github.com/8mahi8/trump-collection/actions/runs/40198456792

- Node単体テスト：**93件中93件成功、失敗0**
- Chromium：COM4入口と友達4入口、Firebase4ページ×3ゲーム初手同期、通信断復旧、退出合格
- WebKit：**COM4入口と友達4入口、Firebase4ページ×3ゲーム初手同期、通信断復旧、退出合格**
- 既存ゲームを模した共有Rules Emulatorと、全ルート公開を移行する架空のルート別Rules Emulatorの両方成功
- FirebaseのプロダクションDB・Rules・Auth／Google Sites公開HTML／`main` は**未変更**。新しい有料サービスの設定なし。

## 旧ゲームとの共存の確認

実際の他リポジトリも確認済み：
- BRAWL開発版＋Sites候補：`/rooms`（1vs1）、`/rooms2v2`（2vs2）
- 小国戦線III：`/shokokuRooms1v1`
- LEMON CLASH（`dev/ipad-hand-ui`）：`/lemonClashRoomsV1`。共用Firebase用 `shared-rtdb` は**Firebase Auth匿名ログインを使わない**ため、旧領域に新しいAuth必須条件を無断適用してはいけない
- 根拠／重要な未確認事項は [Phase15](PHASE15_OPEN_ROOT_MIGRATION_2026-10-25.md)。

## 残る作業

1. 学校で使っているGoogle Sites実HTMLのFirebase利用ルートを**全件確認**し、本番移行時に既存ゲームを壊さないようにする。
2. 期限付き公開Rulesは2026-11-08 00:00 JSTに失効する。既存ゲームの通信継続方法を決める（本番で無断変更しない）。
3. 本番Firebaseで匿名Authが有効か、4人対戦が接続できるかを承認のある設定で確認する。
4. Google Sites HTML直接埋込のネストしたiframe／旧学校iPad Safari／ネットワークを実機で試す。
5. 4ゲームの正式統合リリース用HTMLを詰める。神経衰弱は既存Supabase試作を尊重する。

初期の本人方針：身内用なので複雑なチート対策は作らず、**実際に遊べる・簡単・安定**を優先。
