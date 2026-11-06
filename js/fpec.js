// F1-style flash controller (FPEC @ 0x40022000): Artery AT32F4xx, STM32F0/F1/F3, GD32F1/F3 and clones.
// Same register map as common/flashit.cfg; programming goes through a small RAM stub (stub/stub.S).
import { CPUID, hex } from './stlink.js';

export const FLASH_BASE = 0x08000000;
const FPEC = 0x40022000, BANK2 = 0x40;
const KEYR = 0x04, OPTKEYR = 0x08, SR = 0x0c, CR = 0x10, AR = 0x14, OBR = 0x1c, WRPR = 0x20;
const KEY1 = 0x45670123, KEY2 = 0xcdef89ab;
const SR_BSY = 0x01, SR_ERR = 0x14, SR_CLEAR = 0x34;
const CR_PG = 0x01, CR_PER = 0x02, CR_MER = 0x04, CR_OPTPG = 0x10, CR_OPTER = 0x20, CR_STRT = 0x40,
  CR_LOCK = 0x80, CR_OPTWRE = 0x200, CR_OBL_LAUNCH = 0x2000;
const OPT_BYTES = 0x1ffff800;
const BANK2_START = 0x08080000; // 512 KB bank 1 on XL-density F1 / AT32F403A / GD32 XD

// stub/stub.S, assembled: r0 = FPEC base, r1 = halfwords, r2 = src, r3 = dst -> r1 = halfwords left
const STUB = new Uint8Array([
  0x0c, 0x4e, 0x0d, 0x4c, 0x34, 0x60, 0x00, 0x27, 0xff, 0x43, 0x3f, 0x0c, 0x00, 0x25, 0x00, 0x29, 0x0e, 0xd0, 0x14, 0x88,
  0xbc, 0x42, 0x07, 0xd0, 0x1c, 0x80, 0xc5, 0x68, 0x01, 0x26, 0x35, 0x42, 0xfb, 0xd1, 0x14, 0x26, 0x35, 0x42, 0x03, 0xd1,
  0x02, 0x32, 0x02, 0x33, 0x01, 0x39, 0xee, 0xe7, 0x00, 0xbe, 0xc0, 0x46, 0x00, 0x30, 0x00, 0x40, 0xaa, 0xaa, 0x00, 0x00,
]);
const STUB_ADDR = 0x20000000, BUF_ADDR = 0x20000100, BUF_SIZE = 2048; // fits the smallest parts (4 KB SRAM)
// Erase/write granularity: every page size of these families (1/2/4 KB) divides it, so working in
// 4 KB units with read-merge-write never touches data outside the image, whatever the real page size.
export const UNIT = 4096;

// STM32 DEV_ID -> [name, family]. Page size is not needed (see UNIT).
const STM32 = {
  0x412: ['STM32F10x low-density', 'f1'], 0x410: ['STM32F10x medium-density', 'f1'],
  0x414: ['STM32F10x high-density', 'f1'], 0x430: ['STM32F10x XL-density', 'f1'],
  0x418: ['STM32F105/107', 'f1'], 0x420: ['STM32F100 value line', 'f1'], 0x428: ['STM32F100 high-density', 'f1'],
  0x440: ['STM32F05x / F030x8', 'f0'], 0x444: ['STM32F03x', 'f0'], 0x445: ['STM32F04x / F070x6', 'f0'],
  0x448: ['STM32F07x', 'f0'], 0x442: ['STM32F09x / F030xC', 'f0'],
  0x422: ['STM32F30x / F31x', 'f3'], 0x432: ['STM32F37x', 'f3'], 0x438: ['STM32F303x6/8 / F334', 'f3'],
  0x439: ['STM32F301 / F302x6/8', 'f3'], 0x446: ['STM32F303xD/E', 'f3'],
};
const CORES = { 0xc20: 'Cortex-M0', 0xc60: 'Cortex-M0+', 0xc23: 'Cortex-M3', 0xc24: 'Cortex-M4', 0xc27: 'Cortex-M7' };

export class FlashError extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Chip {
  constructor(link) { this.st = link; }

  // Identify without halting the core.
  async identify() {
    const st = this.st;
    const cpuid = await st.read32(CPUID);
    const part = cpuid >> 4 & 0xfff;
    this.core = CORES[part] || `CPUID 0x${hex(cpuid)}`;
    const m0 = part === 0xc20 || part === 0xc60;
    this.idcode = await st.read32(m0 ? 0x40015800 : 0xe0042000);
    const devId = this.idcode & 0xfff;
    const known = STM32[devId];
    if (!m0 && [0x5, 0x7].includes(this.idcode >>> 28)) { // STM32 REV_IDs are 0x1xxx..0x3xxx
      this.name = 'Artery AT32F4xx';
      this.family = 'at32';
    } else if (known) {
      [this.name, this.family] = known;
      if (this.family === 'f1') this.name += ' (or GD32/CKS32/APM32 clone)';
    } else {
      this.name = 'unknown, F1-compatible assumed';
      this.family = 'f1';
    }
    if (m0 && !known) this.family = 'f0';
    const f03 = this.family === 'f0' || this.family === 'f3';
    this.sizeReg = f03 ? 0x1ffff7cc : 0x1ffff7e0;
    this.uidReg = f03 ? 0x1ffff7ac : 0x1ffff7e8;
    this.rdpOff = f03 ? 0xaa : 0xa5;
    // System memory may read as 0 or fault under RDP: then size/UID stay unknown.
    const kb = (await st.read32(this.sizeReg).catch(() => 0)) & 0xffff;
    this.flashKB = kb && kb !== 0xffff && kb <= 4096 ? kb : null;
    this.uid = [];
    for (let i = 0; i < 3; i++) this.uid.push(await st.read32(this.uidReg + 4 * i).catch(() => 0));
    await this.readProtection();
    return this;
  }

  async readProtection() {
    this.obr = await this.st.read32(FPEC + OBR);
    this.wrpr = await this.st.read32(FPEC + WRPR);
    this.rdpLevel = this.family === 'f0' || this.family === 'f3' ? this.obr >> 1 & 3 : this.obr >> 1 & 1;
    if (this.rdpLevel === 3) this.rdpLevel = 2;
    this.wrp = this.wrpr !== 0xffffffff;
    return this.rdpLevel;
  }

  get uidHex() { return this.uid.map(v => hex(v)).join(''); }
  get flashSize() { return (this.flashKB || 0) * 1024; }

  // ---- low level ----
  get dualBank() { return this.flashSize > BANK2_START - FLASH_BASE; }
  get banks() { return this.dualBank ? [FPEC, FPEC + BANK2] : [FPEC]; }
  reg(addr) { return addr >= BANK2_START && this.dualBank ? FPEC + BANK2 : FPEC; }

  async waitBusy(base, ms = 5000) {
    const t0 = performance.now();
    for (;;) {
      const sr = await this.st.read32(base + SR);
      if (!(sr & SR_BSY)) {
        if (sr & SR_ERR) {
          await this.st.write32(base + SR, SR_CLEAR);
          throw new FlashError(`flash error SR=0x${hex(sr)} (${sr & 0x10 ? 'WRPRTERR: write-protected' : 'PGERR'})`);
        }
        return;
      }
      if (performance.now() - t0 > ms) throw new FlashError('flash BSY timeout');
    }
  }

  async unlock() {
    for (const base of this.banks) {
      if (await this.st.read32(base + CR) & CR_LOCK) {
        await this.st.write32(base + KEYR, KEY1);
        await this.st.write32(base + KEYR, KEY2);
      }
      await this.st.write32(base + SR, SR_CLEAR);
      if (await this.st.read32(base + CR) & CR_LOCK) throw new FlashError('FPEC did not unlock');
    }
  }

  async lock() {
    for (const base of this.banks) await this.st.write32(base + CR, CR_LOCK);
  }

  // Erase [addr, addr+len) in 1 KB steps (page-size agnostic; re-erasing a page is harmless).
  async erase(addr, len) {
    for (let a = addr; a < addr + len; a += 1024) {
      const base = this.reg(a);
      await this.st.write32(base + CR, CR_PER);
      await this.st.write32(base + AR, a);
      await this.st.write32(base + CR, CR_PER | CR_STRT);
      await this.waitBusy(base);
      await this.st.write32(base + CR, 0);
    }
  }

  async massErase() {
    for (const base of this.banks) {
      await this.st.write32(base + CR, CR_MER);
      await this.st.write32(base + CR, CR_MER | CR_STRT);
      await this.waitBusy(base, 30000);
      await this.st.write32(base + CR, 0);
    }
  }

  async loadStub() { await this.st.writeMem(STUB_ADDR, STUB); }

  // Program erased flash through the RAM stub. Core must be halted, FPEC unlocked, stub loaded.
  async program(addr, data, onProgress) {
    if (addr & 1) throw new FlashError('address must be even');
    for (let off = 0; off < data.length;) {
      const a = addr + off;
      let n = Math.min(BUF_SIZE, data.length - off);
      if (a < BANK2_START && a + n > BANK2_START) n = BANK2_START - a; // a run must stay in one bank
      const chunk = new Uint8Array((n + 3) & ~3).fill(0xff);
      chunk.set(data.subarray(off, off + n));
      if (chunk.some(b => b !== 0xff)) {
        const base = this.reg(a);
        await this.st.writeMem(BUF_ADDR, chunk);
        await this.st.write32(base + CR, CR_PG);
        await this.st.runAlgo(STUB_ADDR, { 0: base, 1: (n + 1) >> 1, 2: BUF_ADDR, 3: a }, 5000);
        const left = await this.st.readReg(1);
        const sr = await this.st.read32(base + SR);
        await this.st.write32(base + CR, 0);
        if (left || sr & SR_ERR) {
          await this.st.write32(base + SR, SR_CLEAR);
          const at = a + 2 * (((n + 1) >> 1) - left);
          throw new FlashError(`programming failed at 0x${hex(at)}, SR=0x${hex(sr)}`);
        }
      }
      off += n;
      if (onProgress) onProgress(off, data.length);
    }
  }

  // Disable the watchdog while the core is halted (F1/F3/AT32 DBGMCU_CR; F0 DBGMCU_APB1_FZ).
  async freezeWatchdog() {
    try {
      if (this.family === 'f0') {
        const a = 0x40015808;
        await this.st.write32(a, await this.st.read32(a) | 1 << 12);
      } else {
        const a = 0xe0042004;
        await this.st.write32(a, await this.st.read32(a) | 1 << 8);
      }
    } catch {}
  }

  // ---- protection ----
  // Erase option bytes and program RDP = unprotected. If RDP was on, the chip mass-erases its flash.
  // Also clears write protection (WRP) and resets USER/DATA option bytes to defaults.
  async removeProtection() {
    const st = this.st;
    await st.resetHalt();
    await this.unlock();
    await st.write32(FPEC + OPTKEYR, KEY1);
    await st.write32(FPEC + OPTKEYR, KEY2);
    if (!(await st.read32(FPEC + CR) & CR_OPTWRE)) throw new FlashError('OPTWRE not set: option bytes still locked');
    await st.write32(FPEC + CR, CR_OPTWRE | CR_OPTER);
    await st.write32(FPEC + CR, CR_OPTWRE | CR_OPTER | CR_STRT);
    await this.waitBusy(FPEC, 30000);
    await st.write32(FPEC + CR, CR_OPTWRE);
    await st.write32(FPEC + CR, CR_OPTWRE | CR_OPTPG);
    if (st.canWrite16) {
      await st.write16(OPT_BYTES, this.rdpOff);
    } else { // old ST-Link firmware: write the halfword with the RAM stub
      await this.loadStub();
      await st.writeMem(BUF_ADDR, new Uint8Array([this.rdpOff, 0, 0xff, 0xff]));
      await st.runAlgo(STUB_ADDR, { 0: FPEC, 1: 1, 2: BUF_ADDR, 3: OPT_BYTES }, 5000);
    }
    await this.waitBusy(FPEC, 30000);
    // Reload the option bytes. F0/F3 need OBL_LAUNCH (it resets the chip and drops SWD).
    if (this.family === 'f0' || this.family === 'f3') {
      await st.write32(FPEC + CR, CR_OPTWRE | CR_OBL_LAUNCH).catch(() => {});
      await sleep(100);
      await st.reattach();
    } else {
      await st.write32(FPEC + CR, 0);
    }
    await st.resetHalt();
    await this.readProtection();
    const kb = (await st.read32(this.sizeReg).catch(() => 0)) & 0xffff;
    if (kb && kb !== 0xffff && kb <= 4096) this.flashKB = kb;
    return this.rdpLevel;
  }
}
