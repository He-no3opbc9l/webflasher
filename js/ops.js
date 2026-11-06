// High-level operations on top of Chip: backup, write (read-merge-write or mass erase), compare.
import { FLASH_BASE, UNIT, FlashError } from './fpec.js';
import { hex } from './stlink.js';

const isBlank = b => b.every(x => x === 0xff);
const align4 = n => (n + 3) & ~3;

export function checkRange(chip, addr, len) {
  if (chip.rdpLevel) throw new FlashError('read protection (RDP) is on');
  if (addr % 4) throw new FlashError('address must be a multiple of 4');
  if (addr < FLASH_BASE) throw new FlashError(`address below flash start 0x${hex(FLASH_BASE)}`);
  if (!len) throw new FlashError('empty image');
  if (!chip.flashSize) throw new FlashError('flash size unknown: enter it manually');
  if (addr + len > FLASH_BASE + chip.flashSize)
    throw new FlashError(`image ends at 0x${hex(addr + len)}, beyond flash end 0x${hex(FLASH_BASE + chip.flashSize)}`);
}

// Read [addr, addr+len) (the core keeps running).
export async function readFlash(chip, addr, len, onProgress) {
  return chip.st.readMem(addr, align4(len), onProgress);
}

export async function backup(chip, onProgress) {
  if (chip.rdpLevel) throw new FlashError('read protection (RDP) is on: flash cannot be read');
  if (!chip.flashSize) throw new FlashError('flash size unknown: enter it manually');
  return readFlash(chip, FLASH_BASE, chip.flashSize, onProgress);
}

// Compare the chip with an image at addr. Returns the first differing address or null.
export async function compare(chip, addr, image, onProgress) {
  checkRange(chip, addr, image.length);
  const got = await readFlash(chip, addr, image.length, onProgress);
  for (let i = 0; i < image.length; i++) if (got[i] !== image[i]) return addr + i;
  return null;
}

// Write image at addr.
//   massErase = false: only the 4 KB units the image touches are rewritten; bytes outside the image keep
//     their contents (read-merge-write), units whose contents already match are skipped.
//   massErase = true: the whole chip is erased first.
// opts: { massErase, fullBackup (whole flash, read with the core halted), phase(name), progress(done, total) }
// Leaves the core halted.
export async function writeImage(chip, addr, image, opts = {}) {
  const st = chip.st;
  const phase = opts.phase || (() => {});
  const progress = opts.progress || (() => {});
  checkRange(chip, addr, image.length);
  const end = addr + image.length;
  // Halt before reading: running firmware could write its own settings page between our read and write.
  await st.resetHalt();
  let start, expect, units = [];
  if (opts.massErase) {
    start = addr;
    expect = new Uint8Array(align4(image.length)).fill(0xff);
    expect.set(image);
  } else {
    start = FLASH_BASE + Math.floor((addr - FLASH_BASE) / UNIT) * UNIT;
    const stop = Math.min(FLASH_BASE + Math.ceil((end - FLASH_BASE) / UNIT) * UNIT, FLASH_BASE + chip.flashSize);
    phase('read');
    const old = opts.fullBackup
      ? opts.fullBackup.slice(start - FLASH_BASE, stop - FLASH_BASE)
      : await readFlash(chip, start, stop - start, progress);
    expect = old.slice();
    expect.set(image, addr - start);
    for (let o = 0; o < expect.length; o += UNIT) {
      const a = old.subarray(o, o + UNIT), b = expect.subarray(o, o + UNIT);
      if (a.some((x, i) => x !== b[i])) units.push({ off: o, erase: !isBlank(a) });
    }
    if (!units.length) return { start, changed: 0, total: expect.length / UNIT, verified: true };
  }

  await chip.freezeWatchdog();
  await chip.unlock();
  await chip.loadStub();
  try {
    if (opts.massErase) {
      phase('masserase');
      await chip.massErase();
      phase('program');
      await chip.program(start, expect, progress);
    } else {
      phase('program');
      const total = units.length * UNIT;
      let done = 0;
      for (const u of units) {
        const a = start + u.off, data = expect.subarray(u.off, u.off + UNIT);
        if (u.erase) await chip.erase(a, data.length);
        await chip.program(a, data, n => progress(done + n, total));
        done += UNIT;
      }
    }
  } finally {
    await chip.lock().catch(() => {});
  }

  phase('verify');
  const got = await readFlash(chip, start, expect.length, progress);
  let bad = -1;
  for (let i = 0; i < expect.length; i++) if (got[i] !== expect[i]) { bad = i; break; }
  if (bad >= 0) throw new FlashError(`verify failed at 0x${hex(start + bad)}: 0x${hex(got[bad], 2)} != 0x${hex(expect[bad], 2)}`);
  return opts.massErase
    ? { start, changed: null, verified: true }
    : { start, changed: units.length, total: expect.length / UNIT, verified: true };
}
