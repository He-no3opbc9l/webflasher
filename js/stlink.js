// ST-Link V2 / V2-1 / V3 over WebUSB: SWD mode, memory and core-register access (debug API v2).
// Protocol constants follow OpenOCD src/jtag/drivers/stlink_usb.c.

export const STLINK_FILTERS = [0x3748, 0x374b, 0x374a, 0x3752, 0x374d, 0x374e, 0x374f, 0x3753, 0x3754, 0x3757]
  .map(productId => ({ vendorId: 0x0483, productId }));

const GET_VERSION = 0xf1, DEBUG = 0xf2, DFU = 0xf3, SWIM = 0xf4, GET_CURRENT_MODE = 0xf5,
  GET_TARGET_VOLTAGE = 0xf7, APIV3_GET_VERSION_EX = 0xfb;
const D = {
  READMEM_32: 0x07, WRITEMEM_32: 0x08, EXIT: 0x21, ENTER: 0x30, ENTER_SWD: 0xa3, READ_IDCODES: 0x31,
  RESETSYS: 0x32, READREG: 0x33, WRITEREG: 0x34, WRITE_DEBUG_REG: 0x35, READ_DEBUG_REG: 0x36,
  GETLASTRWSTATUS: 0x3b, GETLASTRWSTATUS2: 0x3e, SWD_SET_FREQ: 0x43, WRITEMEM_16: 0x48, APIV3_SET_COM_FREQ: 0x61,
};
const MODE_DFU = 0, MODE_DEBUG = 2, MODE_SWIM = 3;
const OK = 0x80;
const STATUS = {
  0x81: 'FAULT', 0x09: 'NO_DEVICE (no target / no SWD response)', 0x10: 'SWD_AP_WAIT', 0x11: 'SWD_AP_FAULT',
  0x12: 'SWD_AP_ERROR', 0x13: 'SWD_AP_PARITY', 0x14: 'SWD_DP_WAIT', 0x15: 'SWD_DP_FAULT', 0x16: 'SWD_DP_ERROR',
  0x17: 'SWD_DP_PARITY', 0x18: 'SWD_AP_WDATA_ERROR', 0x19: 'SWD_AP_STICKY_ERROR', 0x1a: 'SWD_AP_STICKYORUN_ERROR',
  0x1d: 'BAD_AP',
};
const WAIT = new Set([0x10, 0x14]);
// SWD clock (kHz) -> divisor for API v2 SWD_SET_FREQ.
const V2_FREQ = [[4000, 0], [1800, 1], [1200, 2], [950, 3], [480, 7], [240, 15], [125, 31], [100, 40], [50, 79], [25, 158], [15, 265], [5, 798]];

// Cortex-M debug registers
export const DHCSR = 0xe000edf0, DEMCR = 0xe000edfc, AIRCR = 0xe000ed0c, CPUID = 0xe000ed00;
const DBGKEY = 0xa05f0000, C_DEBUGEN = 1, C_HALT = 2, C_MASKINTS = 8, S_HALT = 1 << 17;

export class StlinkError extends Error {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const le32 = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
const le16 = (b, o) => b[o] | b[o + 1] << 8;

export class Stlink {
  constructor(device) {
    this.dev = device;
    this.log = () => {};
  }

  // ---- USB transport ----
  async open() {
    const d = this.dev;
    await d.open();
    if (!d.configuration) await d.selectConfiguration(1);
    await d.claimInterface(0);
    const eps = d.configuration.interfaces[0].alternates[0].endpoints.filter(e => e.type === 'bulk');
    const lowest = dir => Math.min(...eps.filter(e => e.direction === dir).map(e => e.endpointNumber));
    this.epIn = lowest('in');
    this.epOut = lowest('out');
    if (!isFinite(this.epIn) || !isFinite(this.epOut)) { // should not happen; fall back to the known layout
      this.epIn = 1;
      this.epOut = d.productId === 0x3748 ? 2 : 1;
    }
  }

  async close() {
    try { await this.xfer([DEBUG, D.EXIT], 0); } catch {}
    try { await this.dev.releaseInterface(0); } catch {}
    try { await this.dev.close(); } catch {}
  }

  // Send a 16-byte command, optional data phase out, read `inLen` bytes back.
  async xfer(cmd, inLen, dataOut) {
    const c = new Uint8Array(16);
    c.set(cmd);
    let r = await this.dev.transferOut(this.epOut, c);
    if (r.status !== 'ok') throw new StlinkError('USB OUT: ' + r.status);
    if (dataOut) {
      r = await this.dev.transferOut(this.epOut, dataOut);
      if (r.status !== 'ok') throw new StlinkError('USB OUT: ' + r.status);
    }
    if (!inLen) return null;
    const res = await this.dev.transferIn(this.epIn, inLen);
    if (res.status !== 'ok') throw new StlinkError('USB IN: ' + res.status);
    return new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength);
  }

  static check(st, what) {
    if (st !== OK) {
      const e = new StlinkError(`${what}: ${STATUS[st] || 'status 0x' + st.toString(16)}`);
      e.status = st;
      throw e;
    }
  }

  // Retry a debug command while the target answers WAIT.
  async dbg(cmd, inLen, what, dataOut) {
    for (let i = 0; ; i++) {
      const r = await this.xfer([DEBUG, ...cmd], inLen, dataOut);
      if (WAIT.has(r[0]) && i < 20) { await sleep(5); continue; }
      Stlink.check(r[0], what);
      return r;
    }
  }

  // ---- probe ----
  async readVersion() {
    const r = await this.xfer([GET_VERSION], 6);
    const v = r[0] << 8 | r[1];
    this.ver = { stlink: v >> 12 & 15, jtag: v >> 6 & 63, swim: v & 63, vid: le16(r, 2), pid: le16(r, 4) };
    if (this.ver.stlink >= 3) {
      const x = await this.xfer([APIV3_GET_VERSION_EX], 12);
      this.ver = { stlink: x[0], swim: x[1], jtag: x[2], msc: x[3], bridge: x[4], vid: le16(x, 8), pid: le16(x, 10) };
    }
    const v3 = this.ver.stlink >= 3;
    if (!v3 && this.ver.jtag < 13) throw new StlinkError(`ST-Link firmware V${this.ver.stlink}J${this.ver.jtag} is too old (need J13+), update it with ST's STLinkUpgrade`);
    this.has = {
      rwStatus2: v3 || this.ver.jtag >= 15,
      setFreq: v3 || this.ver.jtag >= 22,
      mem16: v3 || this.ver.jtag >= 26,
      v3,
    };
    return this.ver;
  }

  get versionString() {
    const v = this.ver;
    return v.stlink >= 3 ? `V${v.stlink}J${v.jtag}M${v.msc}B${v.bridge}S${v.swim}` : `V${v.stlink}J${v.jtag}S${v.swim}`;
  }

  async targetVoltage() {
    const r = await this.xfer([GET_TARGET_VOLTAGE], 8);
    const a0 = le32(r, 0), a1 = le32(r, 4);
    return a0 ? 2 * a1 * 1.2 / a0 : null;
  }

  async leaveCurrentMode() {
    const r = await this.xfer([GET_CURRENT_MODE], 2);
    if (r[0] === MODE_DFU) await this.xfer([DFU, 0x07], 0);
    else if (r[0] === MODE_DEBUG) await this.xfer([DEBUG, D.EXIT], 0);
    else if (r[0] === MODE_SWIM) await this.xfer([SWIM, 0x01], 0);
  }

  async setFreq(khz) {
    if (!this.has.setFreq) return null;
    if (this.has.v3) {
      const c = [D.APIV3_SET_COM_FREQ, 0, 0, khz & 255, khz >> 8 & 255, khz >> 16 & 255, khz >>> 24];
      const r = await this.dbg(c, 8, 'SET_COM_FREQ');
      return le32(r, 4);
    }
    const [f, div] = V2_FREQ.find(([f]) => f <= khz) || V2_FREQ[V2_FREQ.length - 1];
    await this.dbg([D.SWD_SET_FREQ, div & 255, div >> 8], 2, 'SWD_SET_FREQ');
    return f;
  }

  // Open USB, then attach(). Does not halt or reset the target.
  async connect(khz = 1800) {
    await this.open();
    return this.attach(khz);
  }

  // Leave DFU/mass-storage mode, set the clock, enter SWD, read the DP IDCODE.
  async attach(khz = 1800) {
    await this.readVersion();
    await this.leaveCurrentMode();
    this.khz = await this.setFreq(khz);
    await this.dbg([D.ENTER, D.ENTER_SWD], 2, 'enter SWD');
    const r = await this.dbg([D.READ_IDCODES], 12, 'read IDCODE');
    this.dpIdcode = le32(r, 4);
    if (!this.dpIdcode) throw new StlinkError('no target: DP IDCODE = 0 (check wiring and target power)');
    return this.dpIdcode;
  }

  // Re-enter SWD after the target dropped the link (e.g. option-byte reload reset).
  async reattach() {
    await this.leaveCurrentMode();
    if (this.khz) await this.setFreq(this.khz);
    await this.dbg([D.ENTER, D.ENTER_SWD], 2, 'enter SWD');
    await this.dbg([D.READ_IDCODES], 12, 'read IDCODE');
  }

  // ---- memory ----
  async rwStatus(what) {
    const r = this.has.rwStatus2
      ? await this.xfer([DEBUG, D.GETLASTRWSTATUS2], 12)
      : await this.xfer([DEBUG, D.GETLASTRWSTATUS], 2);
    Stlink.check(r[0], what);
  }

  async read32(addr) {
    const r = await this.dbg([D.READ_DEBUG_REG, ...u32(addr)], 8, `read 0x${hex(addr)}`);
    return le32(r, 4);
  }

  async write32(addr, val) {
    await this.dbg([D.WRITE_DEBUG_REG, ...u32(addr), ...u32(val)], 2, `write 0x${hex(addr)}`);
  }

  // Bulk read; addr and len multiple of 4. Split at 1 KB boundaries (TAR auto-increment limit).
  async readMem(addr, len, onChunk) {
    const out = new Uint8Array(len);
    for (let off = 0; off < len;) {
      const a = addr + off;
      const n = Math.min(len - off, 1024 - (a & 1023));
      const r = await this.xfer([DEBUG, D.READMEM_32, ...u32(a), n & 255, n >> 8], n);
      if (r.length !== n) throw new StlinkError(`short read at 0x${hex(a)}: ${r.length}/${n}`);
      await this.rwStatus(`read 0x${hex(a)}`);
      out.set(r, off);
      off += n;
      if (onChunk) onChunk(off, len);
    }
    return out;
  }

  // Bulk write; addr and data length multiple of 4.
  async writeMem(addr, data) {
    for (let off = 0; off < data.length;) {
      const a = addr + off;
      const n = Math.min(data.length - off, 1024 - (a & 1023));
      await this.xfer([DEBUG, D.WRITEMEM_32, ...u32(a), n & 255, n >> 8], 0, data.subarray(off, off + n));
      await this.rwStatus(`write 0x${hex(a)}`);
      off += n;
    }
  }

  get canWrite16() { return this.has.mem16; }

  async write16(addr, val) {
    if (!this.has.mem16) throw new StlinkError('16-bit writes need ST-Link firmware J26+');
    await this.xfer([DEBUG, D.WRITEMEM_16, ...u32(addr), 2, 0], 0, new Uint8Array([val & 255, val >> 8 & 255]));
    await this.rwStatus(`write16 0x${hex(addr)}`);
  }

  // ---- core ----
  async readReg(n) {
    const r = await this.dbg([D.READREG, n], 8, `read r${n}`);
    return le32(r, 4);
  }

  async writeReg(n, v) {
    await this.dbg([D.WRITEREG, n, ...u32(v)], 2, `write r${n}`);
  }

  async isHalted() { return !!(await this.read32(DHCSR) & S_HALT); }

  async halt() {
    await this.write32(DHCSR, DBGKEY | C_HALT | C_DEBUGEN);
    await this.waitHalt(500);
  }

  async waitHalt(ms) {
    const t0 = performance.now();
    for (;;) {
      let h = false;
      try { h = await this.isHalted(); } catch (e) { if (performance.now() - t0 > ms) throw e; }
      if (h) return;
      if (performance.now() - t0 > ms) throw new StlinkError('core did not halt');
      await sleep(1);
    }
  }

  // System reset with the core caught at the reset vector (all peripherals in reset state).
  async resetHalt() {
    await this.write32(DHCSR, DBGKEY | C_HALT | C_DEBUGEN);
    await this.write32(DEMCR, 0x01000001); // TRCENA | VC_CORERESET
    try {
      await this.dbg([D.RESETSYS], 2, 'reset');
    } catch {
      await this.write32(AIRCR, 0x05fa0004).catch(() => {}); // SYSRESETREQ
    }
    await sleep(20);
    await this.waitHalt(1000);
    await this.write32(DEMCR, 0x01000000);
  }

  // Reset and let the firmware run, debug disabled.
  async resetRun() {
    await this.write32(DEMCR, 0);
    await this.write32(DHCSR, DBGKEY);
    try {
      await this.dbg([D.RESETSYS], 2, 'reset');
    } catch {
      await this.write32(AIRCR, 0x05fa0004).catch(() => {});
    }
  }

  // Run code already loaded in RAM until it hits BKPT. regs: {0: r0, 1: r1, ...}
  async runAlgo(entry, regs, timeoutMs) {
    for (const [n, v] of Object.entries(regs)) await this.writeReg(+n, v);
    await this.writeReg(16, 0x01000000); // xPSR: Thumb bit
    await this.writeReg(15, entry);
    await this.write32(DHCSR, DBGKEY | C_HALT | C_DEBUGEN | C_MASKINTS);
    await this.write32(DHCSR, DBGKEY | C_DEBUGEN | C_MASKINTS);
    await this.waitHalt(timeoutMs);
    await this.write32(DHCSR, DBGKEY | C_HALT | C_DEBUGEN);
  }
}

export const hex = (v, w = 8) => (v >>> 0).toString(16).padStart(w, '0');
const u32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
