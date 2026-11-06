// Offline test of js/detect.js: bun detect.mjs file.bin...
import { readFileSync } from 'fs';
import { analyze } from '../js/detect.js';
const hx = v => '0x' + (v >>> 0).toString(16).padStart(8, '0');
for (const f of process.argv.slice(2)) {
  const r = analyze(new Uint8Array(readFileSync(f)));
  const c = (r.candidates || []).map(c => `${hx(c.base)}:${c.hits}/${c.total}`).join(' ');
  const im = (r.images || []).map(i => `${hx(i.addr)}(rst ${hx(i.reset)})`).join(' ');
  console.log(`${r.kind.padEnd(7)} ${r.base != null ? hx(r.base) : '-'.padEnd(10)} ${r.confident ? 'sure' : r.base != null ? 'UNSURE' : ''} | ${c} | inner: ${im} | ${f.split('/').slice(-2).join('/')}`);
}
