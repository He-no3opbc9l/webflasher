// Read-only hardware test: attach (no halt/reset), identify, dump the whole flash to out/web.bin.
//   bun read.mjs [khz]
import { WebUSB } from 'usb';
import { mkdirSync, writeFileSync } from 'fs';
import { Stlink, STLINK_FILTERS, hex } from '../js/stlink.js';
import { Chip } from '../js/fpec.js';
import { backup } from '../js/ops.js';

const usb = new WebUSB({ allowAllDevices: true });
const dev = (await usb.getDevices()).find(d => STLINK_FILTERS.some(f => f.vendorId === d.vendorId && f.productId === d.productId));
if (!dev) throw new Error('no ST-Link');
const st = new Stlink(dev);
try {
  await st.connect(+(process.argv[2] || 1800));
  console.log(`ST-Link ${st.versionString} ${JSON.stringify(st.has)} SWD ${st.khz} kHz DP 0x${hex(st.dpIdcode)} Vt ${(await st.targetVoltage())?.toFixed(2)}`);
  const chip = await new Chip(st).identify();
  console.log(`${chip.name} | ${chip.core} | IDCODE 0x${hex(chip.idcode)} | ${chip.flashKB} KB | UID ${chip.uidHex} | OBR 0x${hex(chip.obr)} RDP ${chip.rdpLevel} | WRPR 0x${hex(chip.wrpr)}`);
  console.log('halted:', await st.isHalted());
  const t0 = performance.now();
  const data = await backup(chip);
  console.log(`read ${data.length} bytes in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  mkdirSync('out', { recursive: true });
  writeFileSync('out/web.bin', data);
} finally {
  await st.close();
}
