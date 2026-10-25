# 既存Firebaseの安全な再利用｜トランプコレクション

## 方針（2026-10-25）

新しいFirebaseを作ることを前提にしない。**他の学校ゲームが使っている既存のRealtime Database**を、トランプ専用の`/trumpRoomsV1`パスで共有できるかを第一候補として検討する。オーナーの希望を優先する。

**まだ本番のSecurity Rulesを確認できていないため、既存DBが実際に安全に共用できると確定したわけではない。** ルール・Auth・データの本番変更はしていない。

## Firebaseルールの重要な性質

Firebase Realtime Databaseの`.read`/`.write`は親の許可が子へ継承される。親が許可した場合、`trumpRoomsV1/$room/private/$uid`で拒否しても取り消せない。そのため、実運用ルールの**ルートおよび共有に影響するワイルドカード**を必ず監査する。また、Rulesファイルを丸ごとFirebaseへデプロイすると、現在のRulesを上書きする。

- [Firebase公式：ルールの継承](https://firebase.google.com/docs/database/security/core-syntax)
- [Firebase公式：Rules REST管理と全文上書き](https://firebase.google.com/docs/database/rest/app-management)

## 今回できたこと（本番に触れない範囲）

`dev/merge-existing-firebase-rules.mjs`で、**既存ルール全文を保持したままトランプ用の独立パスだけを追加**する候補を作れる。

合成は以下のケースで**エラーとして中止**する。
- 親ルートに少しでも許可の可能性がある`.read`/`.write`がある（条件付きの式も自動判断せず拒否）。
- ルートに`$room`などのワイルドカードがある（他ゲームへの影響や手札漏洩リスクを自動判断できないため）。
- ルートに`.validate`がある（追加パスへどう影響するか別途確認）。
- 既に`trumpRoomsV1`が存在する／入力が適正なRules JSONではない／トランプ側のルートが安全に分離されていない。

**合成が成功しても「本番へのデプロイを承認する」ものではない。** 既存ゲームへの変更がないことを静的に確認し、次はFirebase Local Emulatorで振る舞いまで確かめる。

### 自分で現行Rulesを取得したあとに行う手順

1. Firebase Consoleで、既存ゲームに使っているFirebaseの **Realtime Database → Rules** を開く。現在適用中のルールをそのままコピーして`firebase/local-current.rules.json`に保存。このパスは`.gitignore`対象。**手元に実際のRulesがない場合は推測・代用しない。**
2. まず書き込みなしの検査だけを行う。

```bash
node dev/merge-existing-firebase-rules.mjs --existing firebase/local-current.rules.json
```

3. 検査が通る場合にだけ、比較・レビュー用の合成ファイルを作る。

```bash
node dev/merge-existing-firebase-rules.mjs \
  --existing firebase/local-current.rules.json \
  --out dist/review-merged-school.rules.json
```

4. 元のRulesと差分を比較し、**`trumpRoomsV1`以外のパスが変わっていないこと**を確認。Firebase Emulatorで既存ゲームのルールを含むテストと、トランプの本人以外の手札読み取り拒否などを実行する。
5. Firebase Authenticationの匿名ログインが有効であるか確認。ほかのゲームへの影響を理解した上で有効化が必要なら別途判断する。
6. 安全が確認できた場合に限り、既存Firebaseへの接続を許可するWebクライアント構成を追加。**現行の`online/firebase-dedicated-guard.mjs`は、以前の「専用プロジェクトのみ」の検査を保持しているので、本番ルール確認前は既存DB接続を許可しない。** これは作業忘れではなく、今回の安全ゲート。

**Firebase本番へのRules変更・認証設定変更・データ書き込みはまだ行わない。**

## GitHub Actionsに追加した隔離エミュレーターテスト

GitHub上で使う`tests/fixtures/existing-school.rules.json`は、本番とは無関係の**合成テスト用サンプル**。意図的に「広いアクセス権をもつ旧ゲーム用の子パス」が含まれており、それを残したままトランプ専用パスを追加している。

- `tests/firebase-shared-rules-merge.test.mjs`：合成後に旧ゲームのルールが一切変わらないこと、危険な親許可・ワイルドカード・競合パスが拒否されることを検査。
- `firebase.shared-emulator.json`：**ローカル専用**のAuth/Realtime Databaseエミュレーター用の合成Rulesを参照。
- `tests/firebase-shared-emulator.e2e.mjs`：旧ゲームの読書き権限と、トランプのルート・非公開手札のアクセス拒否を確認。
- 既存の`tests/firebase-emulator.e2e.mjs`も合成Rules環境で実行し、ババ抜き・七並べ・大富豪の4人対戦が破綻しないことを確認する。

**このテストだけで、今使っている本番Firebaseが安全だと保証できるわけではない。** 次の実ゲートは「既存Firebaseの実Rulesを確認すること」。それまでは学校Google Sitesの公開版や他ゲームのルールを変更しない。
