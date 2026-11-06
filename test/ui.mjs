// UI test in real Chrome: load files into the page, print the analysis box, address and mass-erase state.
//   bun ui.mjs http://localhost:8765/ file.bin...
import puppeteer from 'puppeteer-core';
const [url, ...files] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--lang=ru'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE ERROR', e.message));
page.on('console', m => m.type() === 'error' && console.log('CONSOLE', m.text()));
await page.goto(url);
await page.evaluate(() => localStorage.setItem('webflash.lang', 'ru'));
await page.reload();
for (const f of files) {
  await page.evaluate(() => { document.getElementById('o-mass').checked = true; });
  await (await page.$('#file')).uploadFile(f);
  await page.waitForFunction(n => document.getElementById('fileinfo').textContent.includes(n), {}, f.split('/').pop());
  const r = await page.evaluate(() => ({
    an: [...document.querySelectorAll('#analysis p')].map(p => p.textContent), cls: document.getElementById('analysis').className,
    addr: document.getElementById('addr').value, mass: document.getElementById('o-mass').checked,
    warn: document.getElementById('addrwarn').hidden ? '' : document.getElementById('addrwarn').textContent,
  }));
  console.log(`== ${f.split('/').slice(-2).join('/')}  addr=${r.addr} mass=${r.mass} [${r.cls}] ${r.warn}\n   ${r.an.join('\n   ')}`);
}
// manual address change -> warning
await page.$eval('#addr', el => { el.value = '0x08000000'; el.dispatchEvent(new Event('input')); });
console.log('after manual edit:', await page.$eval('#addrwarn', el => el.hidden ? '(none)' : el.textContent));
await browser.close();
