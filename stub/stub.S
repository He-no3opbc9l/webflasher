@ Flash-programming stub for F1-style FPEC (AT32F4xx, STM32F0/F1/F3, GD32F1/F3).
@ Thumb-1 only (runs on Cortex-M0 too). Loaded into SRAM and started by the debugger
@ with FLASH_CR = PG already set; halts on BKPT when done.
@   in:  r0 = FPEC base (0x40022000, bank 2: 0x40022040)   r1 = halfword count
@        r2 = source (SRAM)                                 r3 = destination (flash)
@   out: r1 = halfwords left (0 = success), r5 = last FLASH_SR
@ 0xFFFF halfwords are skipped (flash is erased beforehand).
    .syntax unified
    .cpu cortex-m0
    .thumb
    .global _start
_start:
    ldr   r6, =0x40003000      @ IWDG_KR: reload (no-op if the watchdog is not running)
    ldr   r4, =0xAAAA
    str   r4, [r6]
    movs  r7, #0
    mvns  r7, r7
    lsrs  r7, r7, #16          @ r7 = 0xFFFF
    movs  r5, #0
loop:
    cmp   r1, #0
    beq   done
    ldrh  r4, [r2]
    cmp   r4, r7
    beq   next
    strh  r4, [r3]
wait:
    ldr   r5, [r0, #0x0C]      @ FLASH_SR
    movs  r6, #1               @ BSY
    tst   r5, r6
    bne   wait
    movs  r6, #0x14            @ PGERR | WRPRTERR
    tst   r5, r6
    bne   done
next:
    adds  r2, #2
    adds  r3, #2
    subs  r1, #1
    b     loop
done:
    bkpt  #0
    .align 2
    .ltorg
