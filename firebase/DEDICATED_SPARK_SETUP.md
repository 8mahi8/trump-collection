# Phase 10｜Firebase専用Sparkプロジェクトへの安全な移行準備（2026-10-25）

**現状：コードと接続前チェックのみ。Firebaseの実プロジェクト作成、既存DBの設定変更、Rulesの本番配備、実機通信は実施していない。**

## 方針：他の学校ゲームから完全に分ける

既存の`8mahi8/shokoku-sensen`は`mygame-df915-default-rtdb.firebaseio.com`を使っている。トランプ側でこの接続先を流用しない。他ゲームのプロジェクトを変更せず、**別のFirebaseプロジェクトを作成して、そのデフォルトRealtime DatabaseとAnonymous Authenticationのみを使用する**。

Firebase公式のSpark（無料）枠：Realtime Databaseの同時接続100、保存1GB、ダウンロード月10GB。**Sparkでは同一プロジェクトに複数のRealtime Databaseを作れない**ので、別DB名を既存プロジェクトへ追加して分離する案は採らない。現行の無料枠・課金設定は配備時にFirebase公式で再確認する。

- [Firebase公式料金表](https://firebase.google.com/pricing)
- [Realtime Database同時接続の説明](https://firebase.google.com/docs/database/faq-and-troubleshooting)
- [Security Rules管理・既存ルール上書きへの注意](https://firebase.google.com/docs/rules/manage-deploy)

## 今回追加した接続前の防御

`online/firebase-dedicated-guard.mjs`の`validateDedicatedFirebaseConfig()`は、**通信・ログイン前に**次の形を検査する。

1. 明示的なFirebaseプロジェクトIDが`trump-collection-...`で始まる（例：`trump-collection-school-qa`）。既存の`mygame-df915`等は不許可。
2. RTDB URLはその**同じprojectIdのdefault-rtdb**を指す。別プロジェクトのDB、偽装ドメイン、余計なパス・クエリ・ポート・ユーザー情報、HTTPは拒否。
3. 公開Web APIキーの文字種・長さを検査。サービスアカウント情報など想定外の項目は受け付けない。
4. 本番ネットワークを使うブラウザでは、この検査に失敗したら匿名ログインすら開始しない。エミュレーター用の偽通信差し替えは**localhostのみ**許可。
5. 統合メニューの`TRUMP_FIREBASE_CONFIG`も`projectId`を個別iframeへ受け渡す。

**重要な限界：命名とURLの一致だけでは「そのFirebaseプロジェクトを他のサービスが使っていない」ことは技術的に証明できない。** 必ずFirebase Consoleで新規専用プロジェクトであること、他ゲームと共有していないことを確認する。

## 実接続する日の手順（未実施）

1. Firebase Console上で**新規のSparkプロジェクト**を作成。IDは`trump-collection-`で始まる固有名。課金アカウントを紐づけず、Blazeへアップグレードしない。
2. Authenticationの匿名ログインを有効にする。Realtime Databaseはその新規プロジェクトの**デフォルトDBのみ**を有効化する。
3. Firebaseコンソールの「ウェブアプリ設定」から`projectId`、`apiKey`、`databaseURL`を確認。**APIキーは公開Webクライアント用であり、管理者秘密鍵ではない**。Admin SDKやサービスアカウントの資格情報はブラウザに入れない。
4. 接続前に以下の例のような個人ローカルファイルを作成し、**コード上のオフライン検査**を実行する。ローカル設定ファイルは`.gitignore`対象。

```json
{
  "projectId": "trump-collection-school-qa",
  "apiKey": "REPLACE_WITH_PUBLIC_WEB_API_KEY",
  "databaseURL": "https://trump-collection-school-qa-default-rtdb.asia-northeast1.firebasedatabase.app"
}
```

```bash
node dev/check-firebase-config.mjs firebase/local-web-config.json
```

これは**文字列と接続先の整合性だけの検査**。認証の有効化、実ルール・利用可能量・実際のアクセスの正しさは確認しない。

5. 既にGitHub Actionsで実Firebase Local Emulatorテスト済みの`firebase/trump-rooms.rules.json`を、新規専用プロジェクトで、**現行ルールを確認した後に**適用する。Firebase CLIによるRulesデプロイはそのDBの現行ルールを置き換えるので、既存の学校ゲームと共有するDBには絶対に適用しない。
6. 本番プロジェクトで4人の匿名認証・ルール隔離・4人対戦・一時切断・退出を最小回数で検証。アクセス権エラーや予定外の使用量があれば接続を止める。
7. 学校iPad Safari／Google Sitesの**単一HTML直接埋込**を最後に検証し、現行の学校公開版は本人が確認するまで変更しない。

## 無料枠・通信負荷の設計注意点

- 現行Firebase開発版は短い間隔でRTDB RESTリクエストを繰り返す。ブラウザのHTTPリクエスト数、ダウンロード量、認証IPごとの新規匿名アカウント作成制限が別途ある。**無料枠を守るにはポーリング削減と古いルームデータの掃除が今後の課題**。
- ページ更新後に元の試合へ戻る機能は本人の希望で作らない。**通信断の同一ページ内の復旧と、退出→新部屋作成**を維持する。
- Cloud Functions／課金プラン／外部サーバー購入を前提にしない。無料枠を超える設計になりそうなら負荷を測定してから縮小する。

## 検証記録
- データ保護・実Firebase Local Emulatorの4人対戦： [Phase 9 CI成功](https://github.com/8mahi8/trump-collection/actions/runs/40175410131)
- 今回の構成検査：`tests/firebase-dedicated-guard.test.mjs`と`dev/check-firebase-config.mjs`（実Firebase本番通信なし）
- 既存学校Firebaseの実DB・Security Rules、現在のGoogle Sites版、GitHub Pages mainは**未変更**。
