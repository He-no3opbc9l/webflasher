import { Stlink, STLINK_FILTERS, hex } from './stlink.js';
import { Chip, FLASH_BASE } from './fpec.js';
import { backup, compare, writeImage } from './ops.js';
import { analyze } from './detect.js';
import { t, setLang, getLang } from './i18n.js';

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PROBES = { 0x3748: 'V2', 0x374b: 'V2-1', 0x374a: 'V2-1', 0x3752: 'V2-1', 0x374d: 'V3E', 0x374e: 'V3', 0x374f: 'V3', 0x3753: 'V3', 0x3754: 'V3', 0x3757: 'V3PWR' };

let link = null, chip = null, busy = false, image = null;

// ---- log / status / progress ----
function log(msg) {
  const el = $('log');
  el.textContent += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}
function status(msg, cls = '') {
  $('status').textContent = msg;
  $('status').className = cls;
  if (msg) log(msg);
}
function progress(done, total) {
  const p = $('progress');
  p.hidden = total == null;
  if (total) { p.max = total; p.value = done; }
}
const phase = name => { status(t('phase_' + name) + '…'); progress(0, 1); };

// ---- UI state ----
function render() {
  const on = !!chip;
  $('connect').disabled = busy || !!link;
  $('disconnect').disabled = busy || !link;
  $('speed').disabled = !!link;
  $('nochip').hidden = on;
  $('chip').hidden = !on;
  const readable = on && !chip.rdpLevel && chip.flashSize > 0;
  $('backup').disabled = busy || !readable;
  $('write').disabled = busy || !readable || !image;
  $('compare').disabled = busy || !readable || !image;
  $('refresh').disabled = busy || !on;
  $('unprotect').disabled = busy || !on || chip.rdpLevel === 2;
  $('c-size').disabled = busy;
  if (!on) return;
  $('c-model').textContent = chip.name;
  $('c-core').textContent = chip.core;
  $('c-id').textContent = '0x' + hex(chip.idcode);
  if (document.activeElement !== $('c-size')) $('c-size').value = chip.flashKB || '';
  $('c-size-note').textContent = chip.flashKB ? '' : t('sizeUnknown');
  $('c-uid').textContent = chip.uidHex;
  $('c-rdp').innerHTML = chip.rdpLevel === 0 ? `<span class="tag-ok">${t('rdpOff')}</span>`
    : `<span class="tag-bad">${t(chip.rdpLevel === 2 ? 'rdpL2' : 'rdpOn')}</span>`;
  $('c-wrp').innerHTML = chip.wrp ? `<span class="tag-bad">${t('wrpOn', { v: hex(chip.wrpr) })}</span>` : t('wrpOff');
  $('rdphint').hidden = !chip.rdpLevel;
  $('wrphint').hidden = !chip.wrp || !!chip.rdpLevel;
}

// Run one operation at a time; report errors.
async function op(fn) {
  if (busy) return;
  busy = true;
  render();
  try {
    await fn();
  } catch (e) {
    console.error(e);
    progress(0, null);
    status(t('error', { msg: e.message || e }), 'err');
  } finally {
    busy = false;
    render();
  }
}

function save(data, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function backupName() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `backup_${chip.family}_${chip.uidHex.slice(-8)}_${ts}.bin`;
}

async function doBackup() {
  phase('backup');
  const data = await backup(chip, progress);
  const name = backupName();
  save(data, name);
  progress(0, null);
  status(t('backupSaved', { name, kb: data.length / 1024 }), 'ok');
  return data;
}

// ---- connect ----
async function connect() {
  let dev;
  try {
    dev = await navigator.usb.requestDevice({ filters: STLINK_FILTERS });
  } catch { return; } // chooser cancelled
  await op(async () => {
    status(t('connecting'));
    const st = new Stlink(dev);
    try {
      await st.open();
    } catch (e) {
      throw new Error(`${t('busyDevice')} (${e.message})`);
    }
    link = st;
    try {
      await st.attach(+$('speed').value);
      const v = await st.targetVoltage().catch(() => null);
      $('probe').textContent = t('probeInfo', {
        type: PROBES[dev.productId] || '?', ver: st.versionString, v: v ? v.toFixed(2) + ' V' : '?',
      });
      log(`ST-Link ${st.versionString}, SWD ${st.khz ?? '?'} kHz, DP IDCODE 0x${hex(st.dpIdcode)}`);
      chip = await new Chip(st).identify();
      log(`IDCODE 0x${hex(chip.idcode)}, ${chip.name}, ${chip.core}, flash ${chip.flashKB ?? '?'} KB, OBR 0x${hex(chip.obr)}, WRPR 0x${hex(chip.wrpr)}`);
      status(t('connected', { name: chip.name, kb: chip.flashKB ?? '?' }), 'ok');
      renderAnalysis();
    } catch (e) {
      if (/NO_DEVICE|no target/.test(e.message)) e.message = `${t('noTarget')} (${e.message})`;
      link = chip = null;
      await st.close();
      throw e;
    }
  });
}

async function disconnect() {
  const l = link;
  link = chip = null;
  $('probe').textContent = '';
  if (l) await l.close();
  render();
}

// ---- file ----
async function loadFile(f) {
  if (!f) return;
  const data = new Uint8Array(await f.arrayBuffer());
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => hex(b, 2)).join('');
  const info = analyze(data);
  image = { name: f.name, data, sha, info, massOff: false };
  $('fileinfo').textContent = t('fileLoaded', { name: f.name, size: data.length, sha: sha.slice(0, 16) });
  $('fileinfo').removeAttribute('data-i18n');
  $('drop').classList.add('has');
  log(t('fileLoaded', { name: f.name, size: data.length, sha }));
  if (info.base != null) $('addr').value = '0x' + hex(info.base);
  if (info.base != null && info.kind !== 'full' && $('o-mass').checked) { // keep the rest of the flash
    $('o-mass').checked = false;
    image.massOff = true;
  }
  renderAnalysis();
  for (const el of $('analysis').querySelectorAll('p')) log(el.textContent);
  render();
}

const BAD_FILE = { zeros: 'an_zeros', blank: 'an_blank' };

// What the file is, where it goes, and anything that disagrees with the current settings.
function renderAnalysis() {
  const box = $('analysis');
  if (!image) { box.hidden = true; $('addrwarn').hidden = true; return; }
  const i = image.info, d = image.data;
  const main = [], detail = [];
  let cls = 'ok';
  if (BAD_FILE[i.kind]) { main.push(t(BAD_FILE[i.kind])); cls = 'bad'; }
  else if (i.kind === 'unknown') { main.push(t('an_unknown')); cls = 'warn'; }
  else {
    if (i.kind === 'full') main.push(t('an_full', { kb: d.length / 1024 }));
    else if (i.kind === 'start') main.push(t('an_start', { size: d.length }));
    else main.push(t('an_app', { addr: hex(i.base) }));
    if (!i.confident) { main.push(t('an_unsure', { alt: hex(i.candidates[1].base) })); cls = 'warn'; }
    if (image.massOff) main.push(t('an_massOff'));
    if (i.kind === 'full' && chip && chip.flashSize && chip.flashSize !== d.length) {
      main.push(t('an_sizeDiff', { kb: d.length / 1024, chip: chip.flashKB }));
      cls = 'warn';
    }
    if (i.vt) detail.push(t('an_vec', { reset: hex(i.vt.reset), sp: hex(i.vt.sp) }));
    if (i.images.length)
      detail.push(t('an_inner', { list: i.images.map(m => t('an_innerItem', { addr: hex(m.addr), reset: hex(m.reset) })).join(', ') }));
    const used = i.used.slice(0, 8).map(([a, b]) => `0x${hex(a)}–0x${hex(b - 1)}`).join(', ');
    detail.push(t('an_used', { list: used + (i.used.length > 8 ? ', …' : '') }));
  }
  box.className = cls;
  box.innerHTML = '';
  for (const [lines, c] of [[main, ''], [detail, 'detail']])
    for (const l of lines) {
      const p = document.createElement('p');
      p.textContent = l;
      if (c) p.className = c;
      box.appendChild(p);
    }
  box.hidden = false;
  const w = addrWarning();
  $('addrwarn').textContent = w || '';
  $('addrwarn').hidden = !w;
}

function addrWarning() {
  const i = image?.info;
  if (!i || BAD_FILE[i.kind]) return null;
  if (i.base == null) return t('addrUnknown');
  let a;
  try { a = parseAddr(); } catch { return t('badAddr'); }
  return a !== i.base ? t('addrDiff', { addr: hex(i.base) }) : null;
}

function parseAddr() {
  const s = $('addr').value.trim();
  const v = /^0x[0-9a-f]+$/i.test(s) ? parseInt(s, 16) : /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
  if (!Number.isFinite(v)) throw new Error(t('badAddr'));
  return v >>> 0;
}

// ---- actions ----
async function doWrite() {
  const addr = parseAddr();
  const mass = $('o-mass').checked;
  const i = image.info;
  if (BAD_FILE[i.kind]) throw new Error(t('refuse', { why: t(BAD_FILE[i.kind]) }));
  const p = { name: image.name, size: image.data.length, addr: hex(addr) };
  const warns = [addrWarning()];
  if (i.base != null && !i.confident) warns.push(t('an_unsure', { alt: hex(i.candidates[1].base) }));
  if (mass && !(i.kind === 'full' && image.data.length >= chip.flashSize)) warns.push(t('warnMass'));
  const w = warns.filter(Boolean);
  const msg = t(mass ? 'confirmMass' : 'confirmWrite', p) + (w.length ? `\n\n${t('warn')}:\n• ${w.join('\n• ')}` : '');
  if (!confirm(msg)) return;
  let full = null;
  if ($('o-backup').checked) {
    await link.resetHalt(); // nothing may change the flash between this backup and the write
    full = await doBackup();
  }
  const r = await writeImage(chip, addr, image.data, { massErase: mass, fullBackup: full, phase, progress });
  progress(0, null);
  if (r.changed === 0) status(t('nothingChanged'), 'ok');
  else status(mass ? t('writtenMass') : t('written', { changed: r.changed, total: r.total }), 'ok');
  if ($('o-run').checked) {
    await link.resetRun();
    log(t('started'));
    await sleep(500);
    await chip.readProtection().catch(() => {}); // some firmware turns RDP back on at first boot
  }
}

async function doCompare() {
  const addr = parseAddr();
  phase('read');
  const at = await compare(chip, addr, image.data, progress);
  progress(0, null);
  if (at == null) status(t('cmpSame', { addr: hex(addr) }), 'ok');
  else status(t('cmpDiff', { at: hex(at) }), 'err');
}

async function doUnprotect() {
  if (!confirm(t('confirmUnprotect'))) return;
  status(t('unprotecting'));
  const lvl = await chip.removeProtection();
  if (lvl) status(t('stillProtected'), 'err');
  else status(t('unprotected', { rdp: t('rdpOff') }), 'ok');
  log(`OBR 0x${hex(chip.obr)}, WRPR 0x${hex(chip.wrpr)}, flash ${chip.flashKB ?? '?'} KB`);
}

async function doRefresh() {
  await chip.identify();
  log(`IDCODE 0x${hex(chip.idcode)}, OBR 0x${hex(chip.obr)}, WRPR 0x${hex(chip.wrpr)}, flash ${chip.flashKB ?? '?'} KB`);
}

// ---- wiring ----
function init() {
  for (const b of document.querySelectorAll('#lang button')) {
    b.onclick = () => {
      setLang(b.dataset.lang);
      for (const x of document.querySelectorAll('#lang button')) x.classList.toggle('on', x === b);
      if (image) $('fileinfo').textContent = t('fileLoaded', { name: image.name, size: image.data.length, sha: image.sha.slice(0, 16) });
      renderAnalysis();
      render();
    };
    b.classList.toggle('on', b.dataset.lang === getLang());
  }
  setLang(getLang());

  if (!window.isSecureContext) { $('nousb').textContent = t('insecure'); $('nousb').hidden = false; }
  else if (!navigator.usb) { $('nousb').textContent = t('noUsb'); $('nousb').hidden = false; }
  if (!navigator.usb || !window.isSecureContext) { $('connect').disabled = true; return; }

  $('connect').onclick = connect;
  $('disconnect').onclick = () => op(disconnect);
  $('backup').onclick = () => op(doBackup);
  $('write').onclick = () => op(doWrite);
  $('compare').onclick = () => op(doCompare);
  $('unprotect').onclick = () => op(doUnprotect);
  $('refresh').onclick = () => op(doRefresh);
  $('c-size').onchange = () => {
    const v = parseInt($('c-size').value, 10);
    if (chip) chip.flashKB = v > 0 && v <= 4096 ? v : null;
    renderAnalysis();
    render();
  };
  $('file').onchange = e => loadFile(e.target.files[0]);
  $('addr').oninput = renderAnalysis;
  const drop = $('drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); loadFile(e.dataTransfer.files[0]); };

  navigator.usb.addEventListener('disconnect', e => {
    if (link && e.device === link.dev) {
      link = chip = null;
      $('probe').textContent = '';
      status(t('disconnected'), 'err');
      render();
    }
  });
  render();
}

init();
