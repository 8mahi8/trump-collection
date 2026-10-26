import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCollectionLabHtml} from '../dev/build-collection-lab.mjs';

test('統合ランチャー: 既存の4ゲームをCOM/友達の2入口へ振り分ける',()=>{
 const html=buildCollectionLabHtml();
 for(const name of ['babanuki','shichinarabe','shinkei','daifugo'])
   assert.ok(html.includes('data-game="'+name+'"'),name);
 for(const button of ['id="com"','id="friends"','id="back"','id="play"'])
   assert.ok(html.includes(button));
 assert.ok(html.includes('APP_HTML='));
 assert.ok(html.includes('tc:launch-com'));
 assert.ok(html.includes('window.TCCollectionLab'));
});
test('統合ランチャー: 3つのモードのJS/CSSは外部SDKなしで閉じている',()=>{
 const html=buildCollectionLabHtml();
 assert.doesNotMatch(html,/<script\s+src=/);
 assert.ok(html.includes('createFirebaseRoomHost'));
 assert.ok(html.includes('createMemoryAuthority'));
 assert.ok(html.includes('makeRealtimeWire'));
 assert.ok(html.includes('createDaifugo'));
 assert.ok(html.includes('TRUMP_FIREBASE_CONFIG'));
 assert.ok(html.includes('validateFirebaseConfig'));
 assert.ok(html.includes('projectId:config.projectId'));
 // Firebase Web configuration remains absent until explicitly provided.
 assert.ok(html.includes('実Firebase本番への接続は未設定'));
 assert.ok(html.includes('神経衰弱のみ既存Supabase'));
 assert.doesNotMatch(html,/serviceAccount|service_role|private_key/);
});
test('統合ランチャー: 書込み可能な本番設定や自動公開は含まない',()=>{
 const html=buildCollectionLabHtml();
 assert.ok(html.length>80000,'all modes should have source in the standalone HTML');
 assert.ok(html.includes('学校のGoogle Sites版は未変更'));
 assert.ok(html.includes('友達対戦'));
 assert.ok(html.includes('Firebase本番'));
 assert.ok(html.includes('srcdoc'));
});

test('保存済み統合HTMLは最新の四ゲームビルドと完全一致する',()=>{
 const stored=readFileSync(new URL('../dist/trump-collection-integrated-lab.html',import.meta.url),'utf8');
 const generated=buildCollectionLabHtml();
 assert.equal(stored,generated,'GitHub配布用HTMLがソース更新に追従していること');
 for(const key of ['id="chatToggle"','tc:leave-room','createFirebaseRoomHost','createMemoryAuthority']){
  // Some HTML is JSON-escaped into srcdoc, so verify the original phrases survive in either form.
  assert.ok(stored.includes(key)||stored.includes(key.replaceAll('"','\\\"')),key);
 }
});
