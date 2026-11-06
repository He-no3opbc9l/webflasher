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
    notesTitle: 'Особенности прошивки',
    notes: `<ul>
<li>Запись без mass erase меняет только блоки по 4 КБ, которые задевает образ; всё остальное остаётся как было, совпадающие блоки пропускаются. После записи всегда идёт сверка.</li>
<li><b>Полный дамп</b> (бэкап всего флеша) пишется по адресу <code>0x08000000</code>.</li>
<li><b>Прошивка без загрузчика</b> пишется по адресу, под который она собрана (часто <code>0x08001000</code>, <code>0x08004000</code> и т.п.). Сайт определяет его сам по таблице векторов и указателям в коде и подставляет в поле «Адрес». Проверить вручную можно по байтам 4–7 файла (little-endian, вектор сброса): <code>89 11 00 08</code> = <code>0x08001189</code> → прошивка собрана под <code>0x08001000</code>. Если записать её по <code>0x08000000</code>, загрузчик будет затёрт и чип не запустится.</li>
<li>Для прошивки без загрузчика не включайте mass erase — он сотрёт загрузчик и данные.</li>
<li>Снятие RDP стирает весь флеш вместе с загрузчиком: после этого нужен полный дамп или сначала загрузчик, потом прошивка.</li>
<li>Некоторые прошивки при первом запуске сами включают RDP — при следующем подключении защита будет снова включена.</li>
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
    an_full: 'Полный дамп флеша ({kb} КБ) → адрес 0x08000000.',
    an_start: 'Образ для начала флеша ({size} байт) → адрес 0x08000000.',
    an_app: 'Прошивка без загрузчика, собрана под 0x{addr} → адрес подставлен. Всё ниже 0x{addr} (загрузчик) не трогается.',
    an_unsure: 'Адрес определён неуверенно (возможен и 0x{alt}) — проверьте.',
    an_vec: 'Вектор сброса 0x{reset}, стек 0x{sp}.',
    an_inner: 'Внутри: {list}.',
    an_innerItem: 'образ 0x{addr} (сброс 0x{reset})',
    an_used: 'Занято: {list}.',
    an_unknown: 'Таблица векторов не найдена: файл зашифрован или это не прошивка ARM Cortex-M. Адрес не определён — проверьте вручную.',
    an_zeros: 'Файл из одних нулей — так выглядит дамп чипа с включённой защитой RDP. Прошивать его нельзя.',
    an_blank: 'Файл пустой (все байты 0xFF), прошивать нечего.',
    an_massOff: 'Mass erase выключен, чтобы не стереть остальной флеш.',
    an_sizeDiff: 'Размер дампа ({kb} КБ) не совпадает с флешем чипа ({chip} КБ).',
    addrDiff: 'Адрес отличается от определённого по файлу (0x{addr})!',
    addrUnknown: 'Адрес по файлу не определён, проверьте его вручную.',
    warn: 'ВНИМАНИЕ',
    warnMass: 'Включён mass erase: всё вне образа (загрузчик, данные) будет стёрто.',
    refuse: 'Этот файл прошивать нельзя: {why}',
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
    notesTitle: 'Flashing notes',
    notes: `<ul>
<li>Without mass erase only the 4 KB blocks the image touches are rewritten; everything else is kept and unchanged blocks are skipped. Every write is verified by reading back.</li>
<li>A <b>full dump</b> (backup of the whole flash) goes to <code>0x08000000</code>.</li>
<li><b>Firmware without the bootloader</b> goes to the address it was built for (often <code>0x08001000</code>, <code>0x08004000</code> etc.). The site detects it from the vector table and the code pointers and fills in the Address field. To check by hand: bytes 4–7 of the file (little-endian, reset vector) tell it: <code>89 11 00 08</code> = <code>0x08001189</code> → built for <code>0x08001000</code>. Written at <code>0x08000000</code> it overwrites the bootloader and the chip will not start.</li>
<li>Do not enable mass erase for firmware without the bootloader — it wipes the bootloader and data.</li>
<li>Removing RDP erases the whole flash, bootloader included: afterwards write a full dump, or the bootloader first and then the firmware.</li>
<li>Some firmware turns RDP on at first boot — the next connection will show protection again.</li>
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
    an_full: 'Full flash dump ({kb} KB) → address 0x08000000.',
    an_start: 'Image for the start of flash ({size} bytes) → address 0x08000000.',
    an_app: 'Firmware without the bootloader, built for 0x{addr} → address filled in. Everything below 0x{addr} (bootloader) is kept.',
    an_unsure: 'Address uncertain (0x{alt} also possible) — check it.',
    an_vec: 'Reset vector 0x{reset}, stack 0x{sp}.',
    an_inner: 'Contains: {list}.',
    an_innerItem: 'image 0x{addr} (reset 0x{reset})',
    an_used: 'Used: {list}.',
    an_unknown: 'No vector table: the file is encrypted or not ARM Cortex-M firmware. Address unknown — check it manually.',
    an_zeros: 'The file is all zeros — that is what a dump of an RDP-protected chip looks like. Do not flash it.',
    an_blank: 'The file is empty (all bytes 0xFF), nothing to flash.',
    an_massOff: 'Mass erase turned off so the rest of the flash is kept.',
    an_sizeDiff: 'Dump size ({kb} KB) differs from the chip flash ({chip} KB).',
    addrDiff: 'Address differs from the one detected in the file (0x{addr})!',
    addrUnknown: 'Address not detected from the file, check it manually.',
    warn: 'WARNING',
    warnMass: 'Mass erase is on: everything outside the image (bootloader, data) will be erased.',
    refuse: 'This file must not be flashed: {why}',
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
