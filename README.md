# WebFlash — AT32 / STM32 via ST-Link in the browser

Live: https://he-no3opbc9l.github.io/webflasher/

Static site (no build, no dependencies): WebUSB → ST-Link V2 / V2-1 / V3 → SWD.
Chips with the F1-style flash controller: Artery AT32F4xx, STM32F0/F1/F3, GD32F1/F3, CKS32/APM32.

    ./serve.sh            # http://localhost:8000 (WebUSB needs https or localhost)

Chrome / Edge / Opera only (no WebUSB in Firefox/Safari). Linux: udev rule for `0483:3748`;
Windows: ST's WinUSB ST-Link driver. Close OpenOCD first — one program per ST-Link.

## What it does

- **Connect**: enters SWD, reads CPUID / DBGMCU IDCODE / flash size / UID / OBR / WRPR. Does not halt the core.
- **Backup**: reads the whole flash while the firmware runs, saves `backup_<family>_<uid>_<time>.bin`.
- **Write** (`reset halt` first, peripherals in reset state):
  - default: read-merge-write in 4 KB units (every page size of these families divides 4 KB), so bytes outside
    the image are kept and unchanged units are skipped; erase in 1 KB steps;
  - optional mass erase;
  - always verified by read-back; optional full backup before, optional reset-and-run after.
- **Compare**: chip vs file, no writes.
- **Address detection** (`js/detect.js`): from the vector table (SP in SRAM, Thumb handlers in flash) the possible
  bases are narrowed to a 1 KB grid; the one where the image's own code pointers land on function entries
  (PUSH / LDR rX,[pc] / B .) wins. Full dumps (base 0x08000000, size a multiple of 16 KB) also list the inner images
  (e.g. bootloader + application) and used blocks. The address is filled in, mass erase is unticked for partial
  images, and a manual address that differs, an uncertain guess, all-zero (RDP) or blank files are flagged before writing.
- **Remove protection**: option-byte erase + RDP = `0xA5` (F0/F3: `0xAA`). With RDP on the chip mass-erases itself.
  Also clears WRP; USER/DATA option bytes go to defaults.

Programming runs a 60-byte Thumb-1 stub from SRAM (`stub/stub.S`, bytes embedded in `js/fpec.js`; rebuild with
`arm-none-eabi-as` + `objcopy -O binary` if changed). It writes halfwords from a 2 KB buffer at `0x20000100`,
polls BSY, skips `0xFFFF`, reloads IWDG. RAM use < 4 KB (fits STM32F030x4).

## Files

- `js/stlink.js` — ST-Link USB protocol (commands as in OpenOCD `stlink_usb.c`), memory/register access, reset/halt/run.
- `js/fpec.js` — chip identification, FPEC unlock/erase/mass erase/program, RDP/WRP removal.
- `js/ops.js` — backup, write, compare.
- `js/app.js`, `js/i18n.js`, `index.html`, `style.css` — UI (RU/EN).
- `test/` (`cd test && bun install`): `read.mjs` — read-only hardware test (WebUSB via the `usb` package);
  `detect.mjs file.bin…` — address detection on files; `ui.mjs URL file.bin…` — loads files into the page in Chrome (puppeteer).
