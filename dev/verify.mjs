// トランプコレクション検証パイプライン（引き継ぎ同梱版）
// 単体テスト→ビルド→フック(window.TC)駆動の通しプレイ→スクショ一式→基準画像との差分
// 使い方: リポジトリのルートで `node dev/verify.mjs`
// 要件: Node 20+ / puppeteer-core / Chrome
//   - puppeteer-core の場所は環境変数 VERIFY_TOOLS_DIR（package.json のあるDir）で指定可。未指定なら既定候補を探す
//   - Chrome のパスは環境変数 CHROME_PATH で指定可
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _cands = [process.env.VERIFY_TOOLS_DIR, '/home/hatch/workspace/tools', process.cwd()].filter(Boolean);
const _td = _cands.find(d => _ex(d + '/node_modules/puppeteer-core')) || _cands[0];
const require = createRequire(_td.replace(/\/$/, '') + '/package.json');
const puppeteer = require('puppeteer-core');
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SHOTS = REPO + '/verify-shots/latest';
const BASE = REPO + '/verify-shots/baseline';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✖'} ${name} ${detail || ''}`); };

// 1) 単体テスト
const t = spawnSync('node', ['--test', 'tests/games.test.mjs'], { cwd: REPO, encoding: 'utf8' });
const passM = (t.stdout + t.stderr).match(/ℹ pass (\d+)/), failM = (t.stdout + t.stderr).match(/ℹ fail (\d+)/);
step('単体テスト', t.status === 0, `pass=${passM?.[1]} fail=${failM?.[1]}`);

// 2) ビルド
const b = spawnSync('node', ['build-embed.mjs'], { cwd: REPO, encoding: 'utf8' });
step('単体HTMLビルド', b.status === 0, b.stdout.trim());

// 3) フック駆動の通しプレイ
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/opt/meta-chromium/chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 700 });
let errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + REPO + '/dist/trump-collection.html', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 800));
step('TCフック', await page.evaluate(() => !!window.TC && window.TC.version === '1.5.0'), await page.evaluate(() => window.TC?.version));
await page.screenshot({ path: SHOTS + '/menu.png' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const g of ['babanuki', 'shichinarabe', 'shinkei', 'daifugo']) {
  errors = [];
  await page.evaluate(gg => { window.TC.setFast(true); window.TC.start(gg); }, g);
  await sleep(600);
  let done = false;
  for (let i = 0; i < 900 && !done; i++) {
    done = await page.evaluate(() => {
      const st = window.TC.state; if (!st) return false;
      if (st.phase === 'end') return true;
      if (st.turn !== 0) return false;
      const legal = window.TC.legal();
      const game = window.TC.game;
      if (game === 'daifugo') { if (legal.length) window.TC.act({ type: 'play', ids: legal[0] }); else window.TC.act({ type: 'pass' }); }
      else if (game === 'shichinarabe') { if (legal.length) window.TC.act({ type: 'play', ids: legal[0] }); else window.TC.act({ type: 'pass' }); }
      else if (game === 'babanuki') { window.TC.act({ type: 'draw', index: 0 }); }
      else if (game === 'shinkei') {
        if (st.flipped.length === 0) { const seen = new Map(); st.board.forEach((b, ix) => { if (!b.taken) { if (!seen.has(b.card.rank)) seen.set(b.card.rank, []); seen.get(b.card.rank).push(ix); } }); window.TC._pair = [...seen.values()].find(v => v.length >= 2); window.TC.act({ type: 'flip', pos: legal.length ? legal[0][0] : 0 }); }
      }
      return false;
    });
    if (g === 'shinkei' && !done) { // 2枚目（ペア優先）
      await page.evaluate(() => { const st = window.TC.state; if (st && st.phase === 'play' && st.turn === 0 && st.flipped.length === 1) { const first = st.board[st.flipped[0]].card; const match = st.board.findIndex((b, ix) => ix !== st.flipped[0] && !b.taken && b.card.rank === first.rank); const legal = window.TC.legal(); window.TC.act({ type: 'flip', pos: match >= 0 ? match : (legal[0] ? legal[0][0] : 0) }); } });
    }
    if (i === 3) await page.screenshot({ path: `${SHOTS}/${g}.png` });
    await sleep(240);
  }
  const modal = await page.evaluate(() => !!document.querySelector('.modalWrap'));
  step(`通しプレイ ${g}`, done && modal && errors.length === 0, `end=${done} modal=${modal} errors=${errors.length}`);
  await page.evaluate(() => document.getElementById('backBtn').click());
  await sleep(300);
}
// 4) スマホ寸法スクショ
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
await page.evaluate(() => { window.TC.setFast(false); window.TC.start('daifugo'); });
await sleep(2500);
await page.screenshot({ path: SHOTS + '/phone-land.png' });
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await sleep(700);
await page.screenshot({ path: SHOTS + '/phone-port.png' });
await browser.close();

// 5) 基準画像との差分（PILで縮小して平均差）
if (!existsSync(BASE)) { mkdirSync(BASE, { recursive: true }); for (const f of readdirSync(SHOTS)) copyFileSync(`${SHOTS}/${f}`, `${BASE}/${f}`); step('基準画像', true, '初回のため今回分を基準に登録'); }
else {
  const py = spawnSync('python3', ['-c', `
from PIL import Image
import os, sys
for f in sorted(os.listdir('${SHOTS}')):
    a = Image.open('${SHOTS}/' + f).convert('L').resize((64, 64))
    bpath = '${BASE}/' + f
    if not os.path.exists(bpath): print(f + ' baseline-missing'); continue
    b = Image.open(bpath).convert('L').resize((64, 64))
    import numpy as np
    d = float(abs(np.asarray(a, dtype=float) - np.asarray(b, dtype=float)).mean())
    print(f'{f} diff={d:.2f}')
`], { encoding: 'utf8' });
  console.log(py.stdout.trim().split('\n').map(l => '  ' + l).join('\n'));
  step('基準画像との差分', true, '上のdiff値を確認（大きい場合は意図した変更か目視確認）');
}
const failed = results.filter(r => !r.ok);
console.log(`\n=== VERIFY ${failed.length ? 'FAILED: ' + failed.map(f => f.name).join(', ') : 'ALL PASS'} ===`);
process.exit(failed.length ? 1 : 0);
