// 単体HTML（Googleサイト貼り付け用）を生成: games.mjs を index.html にインライン化
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const games = readFileSync(new URL('./games.mjs', import.meta.url), 'utf8');
const names = [...games.matchAll(/^export (?:function|const) (\w+)/gm)].map(m => m[1]);
const gamesInline = games.replace(/^export /gm, '') + `\nconst G = { ${names.join(', ')} };\n`;
let html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
html = html.replace("import * as G from './games.mjs';", () => gamesInline);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/trump-collection.html', import.meta.url), html);
console.log('wrote dist/trump-collection.html', Math.round(html.length / 1024) + 'KB', 'exports:', names.length);
