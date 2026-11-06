// UI strings. Elements carry data-i18n="key" (text) or data-i18n-html="key" (markup); code uses t(key, params).
const STR = {
  ru: {
    subtitle: 'Прошивка AT32 / STM32 (F0, F1, F3, GD32) через ST-Link прямо из браузера',
    noUsb: 'Этот браузер не поддерживает WebUSB. Нужен Chrome, Edge, Opera или другой Chromium-браузер на компьютере (Firefox и Safari не умеют).',
    insecure: 'WebUSB работает только на https:// или http://localhost. Запустите ./serve.sh и откройте http://localhost:8000.',
    probeTitle: '1. Программатор',
    connect: 'Выбрать ST-Link',
    disconnect: 'Отключить',
    speed: 'Частота SWD',
    probeInfo: 'ST-Link {type}, прошивка {ver}, питание цели {v}',
    chipTitle: '2. Чип',
    noChip: 'Подключите ST-Link и плату.',
    model: 'Модель', core: 'Ядро', flash: 'Флеш', uid: 'UID',
    rdp: 'Защита чтения (RDP)', wrp: 'Защита записи (WRP)',
    kb: 'КБ',
    sizeUnknown: 'размер не прочитался — введите вручную',
    rdpOff: 'выключена', rdpOn: 'ВКЛЮЧЕНА (уровень 1)', rdpL2: 'уровень 2 — навсегда, чип не прошить',
    wrpOff: 'нет', wrpOn: 'есть (WRPR=0x{v})',
    refresh: 'Перечитать',
    unprotect: 'Снять защиту…',
    rdpHint: 'Флеш защищён от чтения: бэкап невозможен, запись невозможна. Снятие защиты сотрёт ВЕСЬ флеш — так устроен чип, старую прошивку уже не достать.',
    wrpHint: 'Часть страниц защищена от записи. «Снять защиту» сбросит option bytes (WRP) — при выключенном RDP флеш не стирается.',
    backupTitle: '3. Бэкап',
    backupBtn: 'Сохранить бэкап всего флеша (.bin)',
    backupHint: 'Чтение идёт без остановки прошивки, чип не трогается.',
    flashTitle: '4. Прошивка',
    drop: 'Выберите .bin файл или перетащите его сюда',
    addr: 'Адрес',
    optBackup: 'Сначала сохранить бэкап всего флеша',
    optMass: 'Стереть весь чип (mass erase) — иначе всё вне образа сохраняется',
    optRun: 'После записи перезапустить и запустить прошивку',
    write: 'Записать',
    compare: 'Сверить с чипом',
    log: 'Журнал',
    notesTitle: 'Подсказки',
    notes: `<ul>
<li>Подключение: SWDIO, SWCLK, GND и, если плата не запитана, 3.3V. Перед этим закройте OpenOCD / st-util / STM32CubeProgrammer — ST-Link может держать только одна программа.</li>
<li>Linux: нужен доступ к USB-устройству <code>0483:3748</code>, правило udev:<br><code>SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", MODE="0666", TAG+="uaccess"</code></li>
<li>Windows: нужен драйвер ST-Link от ST (STSW-LINK009, WinUSB).</li>
<li>Запись без mass erase меняет только блоки по 4 КБ, которые задевает образ; всё остальное (загрузчик, настройки) остаётся как было. Неизменившиеся блоки пропускаются.</li>
<li>Ninebot: штатная прошивка контроллера при первом запуске снова включает RDP — следующее подключение покажет защиту, это нормально.</li>
</ul>
<h3>Полный дамп или дамп без загрузчика?</h3>
<ul>
<li>Посмотрите на байты 4–7 файла (little-endian) — это адрес обработчика сброса. Например, <code>89 11 00 08</code> = <code>0x08001189</code>: прошивка собрана под <code>0x08001000</code>. <code>21 01 00 08</code> = <code>0x08000121</code>: под <code>0x08000000</code>. Адрес записи — это начало блока, куда указывает вектор (обычно кратно 0x400–0x1000).</li>
<li><b>Полный дамп</b> (бэкап с этого сайта, OpenOCD <code>dump_image</code>; размер = весь флеш, например 128 или 256 КБ): адрес <code>0x08000000</code>. Mass erase не обязателен — файл всё равно перекрывает весь флеш. Вместе с ним вернутся загрузчик, настройки и пробег.</li>
<li><b>Прошивка без загрузчика</b> (только приложение, например <code>DRV.bin</code> из обновления Ninebot): адрес начала приложения. У контроллеров Ninebot (S90L, Max G2) загрузчик занимает 4 КБ, приложение — с <code>0x08001000</code>. <b>Не пишите приложение по 0x08000000</b> — затрёте загрузчик, контроллер не запустится.</li>
<li>Для прошивки без загрузчика <b>не включайте mass erase</b>: он сотрёт загрузчик и настройки. Без него сайт перепишет только блоки приложения, загрузчик и настройки останутся.</li>
<li>Если на чипе был RDP, снятие защиты стёрло всё, включая загрузчик. Тогда сначала запишите загрузчик (4 КБ) по <code>0x08000000</code>, затем приложение по <code>0x08001000</code> — или просто полный дамп.</li>
<li>Если не уверены — сначала «Сверить с чипом» на заведомо исправной плате: при правильном адресе почти всё совпадёт.</li>
</ul>`,
    // dynamic
    connecting: 'Подключение…',
    connected: 'Подключено: {name}, флеш {kb} КБ',
    noTarget: 'ST-Link найден, но чип не отвечает. Проверьте провода и питание платы.',
    busyDevice: 'Не удалось открыть ST-Link: он занят другой программой (OpenOCD, st-util, CubeProgrammer) или нет прав доступа (Linux: правило udev).',
    disconnected: 'ST-Link отключён.',
    reading: 'Чтение флеша…',
    backupSaved: 'Бэкап сохранён: {name} ({kb} КБ)',
    fileLoaded: '{name}: {size} байт, SHA-256 {sha}',
    confirmWrite: 'Записать {name} ({size} байт) по адресу 0x{addr}?',
    confirmMass: 'Стереть ВЕСЬ чип и записать {name} ({size} байт) по адресу 0x{addr}?',
    confirmUnprotect: 'Снять защиту?\n\nЕсли включён RDP, чип сам сотрёт ВЕСЬ флеш (старую прошивку восстановить будет нельзя).\nOption bytes (USER/DATA/WRP) сбросятся в заводские.',
    unprotecting: 'Снятие защиты…',
    unprotected: 'Защита снята. RDP: {rdp}.',
    stillProtected: 'RDP всё ещё включён. Отключите питание платы на пару секунд и подключитесь снова.',
    phase_read: 'Чтение', phase_masserase: 'Стирание чипа', phase_program: 'Запись', phase_verify: 'Проверка', phase_backup: 'Бэкап',
    nothingChanged: 'На чипе уже этот образ — записывать нечего.',
    written: 'Готово: записано блоков {changed} из {total}, проверка пройдена.',
    writtenMass: 'Готово: чип стёрт, образ записан, проверка пройдена.',
    started: 'Чип перезапущен, прошивка работает.',
    cmpSame: 'Совпадает: на чипе по адресу 0x{addr} ровно этот файл.',
    cmpDiff: 'Отличается, первое расхождение по адресу 0x{at}.',
    badAddr: 'Неверный адрес',
    error: 'Ошибка: {msg}',
  },
  en: {
    subtitle: 'Flash AT32 / STM32 (F0, F1, F3, GD32) through an ST-Link right from the browser',
    noUsb: 'This browser has no WebUSB. Use Chrome, Edge, Opera or another Chromium browser on a computer (Firefox and Safari lack it).',
    insecure: 'WebUSB only works on https:// or http://localhost. Run ./serve.sh and open http://localhost:8000.',
    probeTitle: '1. Probe',
    connect: 'Select ST-Link',
    disconnect: 'Disconnect',
    speed: 'SWD clock',
    probeInfo: 'ST-Link {type}, firmware {ver}, target voltage {v}',
    chipTitle: '2. Chip',
    noChip: 'Connect the ST-Link and the board.',
    model: 'Model', core: 'Core', flash: 'Flash', uid: 'UID',
    rdp: 'Read protection (RDP)', wrp: 'Write protection (WRP)',
    kb: 'KB',
    sizeUnknown: 'size not readable — enter it manually',
    rdpOff: 'off', rdpOn: 'ON (level 1)', rdpL2: 'level 2 — permanent, chip cannot be flashed',
    wrpOff: 'none', wrpOn: 'set (WRPR=0x{v})',
    refresh: 'Re-read',
    unprotect: 'Remove protection…',
    rdpHint: 'Flash is read-protected: no backup, no writing. Removing protection erases ALL flash — that is how the chip works, the old firmware cannot be recovered.',
    wrpHint: 'Some pages are write-protected. "Remove protection" resets the option bytes (WRP) — with RDP off this does not erase flash.',
    backupTitle: '3. Backup',
    backupBtn: 'Save a backup of the whole flash (.bin)',
    backupHint: 'Reads while the firmware keeps running; the chip is not touched.',
    flashTitle: '4. Flash',
    drop: 'Choose a .bin file or drop it here',
    addr: 'Address',
    optBackup: 'Save a backup of the whole flash first',
    optMass: 'Erase the whole chip (mass erase) — otherwise everything outside the image is kept',
    optRun: 'Reset and run the firmware afterwards',
    write: 'Write',
    compare: 'Compare with chip',
    log: 'Log',
    notesTitle: 'Notes',
    notes: `<ul>
<li>Wiring: SWDIO, SWCLK, GND and 3.3V if the board is not powered. Close OpenOCD / st-util / STM32CubeProgrammer first — only one program can hold the ST-Link.</li>
<li>Linux: the user needs access to USB device <code>0483:3748</code>, udev rule:<br><code>SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", MODE="0666", TAG+="uaccess"</code></li>
<li>Windows: install ST's ST-Link driver (STSW-LINK009, WinUSB).</li>
<li>Without mass erase only the 4 KB blocks the image touches are rewritten; everything else (bootloader, settings) stays as it was. Unchanged blocks are skipped.</li>
<li>Ninebot: the stock controller firmware turns RDP back on at first boot — the next connection will show protection, that is expected.</li>
</ul>
<h3>Full dump or dump without the bootloader?</h3>
<ul>
<li>Look at bytes 4–7 of the file (little-endian): the reset handler address. E.g. <code>89 11 00 08</code> = <code>0x08001189</code>: linked for <code>0x08001000</code>; <code>21 01 00 08</code> = <code>0x08000121</code>: linked for <code>0x08000000</code>. The write address is the start of the block the vector points into (usually a multiple of 0x400–0x1000).</li>
<li><b>Full dump</b> (a backup from this site, OpenOCD <code>dump_image</code>; size = the whole flash, e.g. 128 or 256 KB): address <code>0x08000000</code>. Mass erase is optional — the file covers the whole flash anyway. Bootloader, settings and odometer come back with it.</li>
<li><b>Firmware without the bootloader</b> (application only, e.g. <code>DRV.bin</code> from a Ninebot update): the application start address. On Ninebot controllers (S90L, Max G2) the bootloader is 4 KB and the application starts at <code>0x08001000</code>. <b>Do not write the application at 0x08000000</b> — that overwrites the bootloader and the controller will not start.</li>
<li>For an application-only image <b>do not enable mass erase</b>: it wipes the bootloader and settings. Without it only the application blocks are rewritten; bootloader and settings stay.</li>
<li>If the chip had RDP, removing it erased everything, the bootloader too. Then write the bootloader (4 KB) at <code>0x08000000</code> first, then the application at <code>0x08001000</code> — or simply a full dump.</li>
<li>Not sure? Run "Compare with chip" on a known-good board first: with the right address almost everything matches.</li>
</ul>`,
    connecting: 'Connecting…',
    connected: 'Connected: {name}, flash {kb} KB',
    noTarget: 'ST-Link found but the chip does not answer. Check the wiring and board power.',
    busyDevice: 'Cannot open the ST-Link: another program holds it (OpenOCD, st-util, CubeProgrammer) or no access rights (Linux: udev rule).',
    disconnected: 'ST-Link disconnected.',
    reading: 'Reading flash…',
    backupSaved: 'Backup saved: {name} ({kb} KB)',
    fileLoaded: '{name}: {size} bytes, SHA-256 {sha}',
    confirmWrite: 'Write {name} ({size} bytes) at 0x{addr}?',
    confirmMass: 'Erase the WHOLE chip and write {name} ({size} bytes) at 0x{addr}?',
    confirmUnprotect: 'Remove protection?\n\nIf RDP is on, the chip erases ALL its flash (the old firmware cannot be recovered).\nOption bytes (USER/DATA/WRP) are reset to factory defaults.',
    unprotecting: 'Removing protection…',
    unprotected: 'Protection removed. RDP: {rdp}.',
    stillProtected: 'RDP is still on. Power-cycle the board for a few seconds and connect again.',
    phase_read: 'Reading', phase_masserase: 'Erasing chip', phase_program: 'Writing', phase_verify: 'Verifying', phase_backup: 'Backup',
    nothingChanged: 'The chip already holds this image — nothing to write.',
    written: 'Done: {changed} of {total} blocks written, verified.',
    writtenMass: 'Done: chip erased, image written, verified.',
    started: 'Chip reset, firmware running.',
    cmpSame: 'Match: the chip holds exactly this file at 0x{addr}.',
    cmpDiff: 'Differs, first mismatch at 0x{at}.',
    badAddr: 'Bad address',
    error: 'Error: {msg}',
  },
};

let lang = localStorage.getItem('webflash.lang') || (navigator.language.startsWith('ru') ? 'ru' : 'en');

export function t(key, p = {}) {
  const s = STR[lang][key] ?? STR.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? '');
}

export function getLang() { return lang; }

export function setLang(l) {
  lang = l;
  localStorage.setItem('webflash.lang', l);
  document.documentElement.lang = l;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
}
