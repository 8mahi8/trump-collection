# Phase17｜Google Sites埋め込みに近い二重iframeのゲーム選択修正

日付：2026-10-25。開発ブランチのみ。本番Firebase、Auth、Rules、学校Google Sites、`main`は変更していない。

## 修正理由
統合ランチャーの「友達と遊ぶ」は、共通のFirebase4人画面を`iframe.srcdoc`で起動する。従来は`iframe.onload`後に親から`frame.contentDocument.querySelector('#game').value=selected`を呼び、選択ゲームを切り替えた。Google SitesのHTML埋め込み自体もiframeであり、sandbox環境で`contentDocument`がアクセス不能になり得る。従来コードはその例外を握りつぶしていたため、七並べ・大富豪を選択しても初期選択のババ抜きが残る恐れがあった。

## 実装
1. `online/collection-launcher.template.html`：`configureFirebase`を`configureFriendsGame(html,game)`に更新。**Firebase設定の有無に関係なく**子iframeのHTML先頭へ`window.TRUMP_INITIAL_GAME`を埋め込む。Firebaseの公開Web設定が実際にある場合だけ従来通り接続設定も埋め込む。秘密鍵等は埋め込まない。
2. `online/four-seat-remote.html`：起動時に受け取った`TRUMP_INITIAL_GAME`が既知の3ゲームなら、初期セレクトをそのゲームへ変更。未指定なら従来のババ抜き既定値を維持。
3. 親の`frame.contentDocument`直接アクセスを撤去。COMモードは既存の`postMessage`ルートを維持。
4. `dist/trump-collection-online-lab.html`をビルダーと同一内容に再生成してGitHub保存。統合1HTMLはビルド時に上記変更を取り込む。

## ブラウザ回帰テスト
`dev/verify-collection-launcher.mjs`を拡張。800×450のブラウザ上で、Google Sitesを模した`sandbox="allow-scripts allow-forms"`付き**外側iframe**を作り、その中で統合ゲームランチャーを動かす。ランチャー内側の`srcdoc`もあるため、**iframeを二重化**して実験。

- Firebase接続設定が無いまま、七並べ→大富豪→ババ抜きの友達入口を順番に開き、**内側のゲームセレクトが選択通りか**を検査。
- 設定が無い場合にFirebaseへの接続を拒否するガードも維持。
- ゲーム一覧に戻ったら内側のゲームが閉じ、次のゲーム選択ができること。
- COM七並べも二重iframeから起動し、本来のゲーム画面を表示できること。
- ChromiumとWebKit両エンジンで試験。

## 制限と次の進め方
この試験は`srcdoc`構成のサンドボックス再現であり、学校のGoogle Sites/iPad Safariそのものではない。利用中Google Sitesの実際のiframe属性や学校Wi-Fiの制限は実機検査が必要。今回はオンライン対戦の正本処理・Firebase通信プロトコルには変更を加えず、起動の確実性のみ向上させた。学校公開版の貼り替えはオーナーの実機検査と承認まで禁止する。

**[GitHub Actions #40199559696](https://github.com/8mahi8/trump-collection/actions/runs/40199559696) 成功**：Node 93/93件合格、ChromiumおよびWebKitの4ゲーム×COM／友達8入口成功、**Google Sites風二重iframeの選択・戻る・COM起動も両エンジン成功**、Firebase Emulator4端末×3ゲームの同期・退出・ホスト回線復帰、および合成共有Rules／権限局所化Rules Emulatorが全て成功。学校実機・本番Firebase接続は未検証。
