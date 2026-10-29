import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../v2/net/connectivity-check.html',import.meta.url),'utf8');

test('school network probe is a standalone HTML with syntactically valid inline JavaScript',()=>{
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/meta name="viewport"/);
 assert.doesNotMatch(html,/<iframe\b|<script\b[^>]*\bsrc=/i);
 const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,'inline JavaScript must be present');
 assert.doesNotThrow(()=>new Function(code));
});
test('network probe does not mutate Firebase or send game actions to Supabase',()=>{
 assert.match(html,/method:'GET'/);
 assert.match(html,/new WebSocket\(/);
 assert.match(html,/event:'phx_join'/);
 assert.doesNotMatch(html,/method:'(?:PUT|POST|PATCH|DELETE)'/);
 assert.doesNotMatch(html,/event:'broadcast'/);
 assert.doesNotMatch(html,/service_role|sb_secret_/);
});
