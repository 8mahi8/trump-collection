import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOnlineHtml} from '../dev/build-online-html.mjs';
import {readFileSync} from 'node:fs';
test('4人Firebaseオンライン開発版は外部JS不要の単一HTMLに組み立て可能',()=>{
 const html=buildOnlineHtml();
 assert.match(html,/<html lang="ja">/);
 assert.match(html,/<script>/);
 assert.doesNotMatch(html,/<script[^>]+src=/);
 assert.doesNotMatch(html,/type="module"/);
 assert.doesNotMatch(html,/^\s*import /m);
 for(const name of ['createFirebaseRoomHost','createFirebaseRoomGuest','createFirebaseAnonymousAuth',
  'createFirebaseRoomStore','validateFirebaseConfig','createFourSeatAuthority','createBabanuki','createDaifugo']){
  assert.ok(html.includes(name),name+' not bundled');
 }
 for(const key of ['id="create"','id="join"','id="ready"','id="start"','id="rematch"',
  'id="leave"','id="hand"','id="board"','id="actions"'])assert.ok(html.includes(key));
});
test('単体HTMLはFirebase実接続を未設定のままにし、共有対象だけを名前で認識する',()=>{
 const html=buildOnlineHtml();
 for(const prohibited of ['service_role','serviceAccount','private_key']){
  assert.equal(html.includes(prohibited),false,prohibited);
 }
 assert.ok(html.includes('TRUMP_FIREBASE_CONFIG'),'user-provided public project config should be required');
 assert.ok(html.includes('TRUMP_FIREBASE_OPEN_ROOT_TRIAL'),'known-school open root is trial-only, never the default');
 assert.ok(html.includes('const OPEN_ROOT_TRIAL=window.TRUMP_FIREBASE_OPEN_ROOT_TRIAL===true'));
 assert.ok(html.includes('FIREBASE_PROJECT_NOT_ALLOWED'));
 assert.ok(html.includes('mygame-df915'));
 assert.ok(html.includes('validateFirebaseConfig'));
 assert.ok(html.includes('FIREBASE_PROJECT_DATABASE_MISMATCH'));
});
test('ホスト再接続や学校版更新が未完成であることをUIで明示',()=>{
 const html=buildOnlineHtml();
 assert.ok(html.includes('ページを再読み込みした場合は、新しい部屋を作り直してください'));
 assert.ok(html.includes('学校のGoogle Sites版・公開版は変更せず'));
});

test('GitHubに保存した開発用単体HTMLが最新のビルド結果と一致',()=>{
 const saved=readFileSync(new URL('../dist/trump-collection-online-lab.html',import.meta.url),'utf8');
 assert.equal(saved,buildOnlineHtml());
});
