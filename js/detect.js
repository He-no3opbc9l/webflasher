// Work out where a raw Cortex-M flash image belongs, from its contents alone.
//
// 1. The vector table at offset 0 gives the initial SP (in SRAM) and the handler addresses (odd = Thumb, in flash).
//    The base must lie below every handler and the image must reach past the highest one.
// 2. Among the bases that fit (1 KB grid), the right one makes the image's own code pointers (odd words: vector
//    entries, literal pools, function tables) land on function entries (PUSH, LDR rX,[pc], B .); a wrong base
//    lands them in random code. The base with by far the most hits wins.
// 3. With base 0x08000000 and a size that is a whole flash size, the file is a full dump; other vector tables
//    inside it (bootloader + application) and the used 1 KB blocks are reported.
export const FLASH_LO = 0x08000000;
const FLASH_HI = 0x08400000;

const w32 = (d, o) => (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0;
const h16 = (d, o) => d[o] | d[o + 1] << 8;
const isCode = v => (v & 1) === 1 && v >= FLASH_LO && v < FLASH_HI;
const isSp = v => (v & 3) === 0 && ((v > 0x20000000 && v <= 0x20080000) || (v > 0x10000000 && v <= 0x10010000));
const isEntry = hw => (hw & 0xfe00) === 0xb400 /* push */ || hw === 0xe92d /* push.w */ ||
  (hw & 0xf800) === 0x4800 /* ldr rX,[pc,#] */ || hw === 0xe7fe /* b . */;

// Vector table at off, or null. Needs SP, Reset, NMI and HardFault; ends at the first non-handler, non-zero word.
export function vectorTable(d, off) {
  if (off + 16 > d.length) return null;
  const sp = w32(d, off);
  if (!isSp(sp) || ![1, 2, 3].every(i => isCode(w32(d, off + 4 * i)))) return null;
  const handlers = [];
  let n = 1;
  for (; n < 256 && off + 4 * n + 4 <= d.length; n++) {
    const v = w32(d, off + 4 * n);
    if (isCode(v)) handlers.push(v);
    else if (v !== 0) break;
  }
  return { sp, reset: w32(d, off + 4), handlers, size: 4 * n };
}

function bases(d, vt, step) {
  const min = Math.min(...vt.handlers), max = Math.max(...vt.handlers);
  const lo = Math.max(FLASH_LO, max - d.length + 1), hi = (min & ~1) - vt.size;
  const out = [];
  for (let b = Math.ceil(lo / step) * step; b <= hi; b += step) out.push(b);
  return out;
}

function score(d, ptrs, b) {
  let hits = 0, total = 0;
  for (const p of ptrs) {
    const o = p - 1 - b;
    if (o < 0 || o + 2 > d.length) continue;
    total++;
    if (isEntry(h16(d, o))) hits++;
  }
  return { base: b, hits, total };
}

function usedRanges(d, base) {
  const out = [];
  for (let o = 0; o < d.length; o += 1024) {
    const blk = d.subarray(o, o + 1024);
    if (blk.every(x => x === 0xff)) continue;
    const last = out[out.length - 1];
    if (last && last[1] === base + o) last[1] = base + o + blk.length;
    else out.push([base + o, base + o + blk.length]);
  }
  return out;
}

// Other vector tables inside an image placed at base (e.g. the application inside a full dump).
function innerImages(d, base) {
  const out = [];
  for (let o = 0x400; o + 16 <= d.length; o += 0x400) {
    const vt = vectorTable(d, o);
    if (vt && vt.handlers.every(h => h > base + o + vt.size && h < base + d.length)) out.push({ addr: base + o, ...vt });
  }
  return out;
}

const isFlashSize = n => n >= 16384 && n % 16384 === 0;

// -> { kind: 'zeros'|'blank'|'unknown'|'full'|'start'|'app', base, confident, vt, images, used, candidates }
//   full  = dump of the whole flash (base 0x08000000, size a multiple of 16 KB)
//   start = image for the start of flash that is not a whole-flash size (e.g. a bootloader alone)
//   app   = image linked above 0x08000000 (firmware without the bootloader, or a high-placed bootloader)
export function analyze(d) {
  if (d.every(x => x === 0)) return { kind: 'zeros' };
  if (d.every(x => x === 0xff)) return { kind: 'blank' };
  const vt = vectorTable(d, 0);
  if (!vt) {
    // A full dump whose first block is erased (no bootloader) still has the application's table further in.
    const images = isFlashSize(d.length) ? innerImages(d, FLASH_LO) : [];
    if (images.length) return { kind: 'full', base: FLASH_LO, confident: true, vt: null, images, used: usedRanges(d, FLASH_LO) };
    return { kind: 'unknown' };
  }
  let cand = bases(d, vt, 0x400);
  if (!cand.length) cand = bases(d, vt, 0x100);
  if (!cand.length) return { kind: 'unknown', vt };
  const ptrs = [];
  for (let o = 0; o + 4 <= d.length; o += 4) {
    const v = w32(d, o);
    if (isCode(v)) ptrs.push(v);
  }
  const scored = cand.map(b => score(d, ptrs, b)).sort((a, b) => b.hits - a.hits || a.base - b.base);
  const [best, second] = scored;
  const confident = !second || (best.hits >= 4 && best.hits >= 2 * second.hits + 2);
  const base = best.base;
  const images = innerImages(d, base);
  const kind = base !== FLASH_LO ? 'app' : isFlashSize(d.length) ? 'full' : 'start';
  return { kind, base, confident, vt, images, used: usedRanges(d, base), candidates: scored.slice(0, 3) };
}
