/**
 * Web Bluetooth ESC/POS Thermal Printer Utility
 * Supports 58mm thermal printers (common Chinese BLE printers)
 * Works on Chrome/Edge for Android
 *
 * Receipt format: plain text only — no bold/size commands for maximum compatibility.
 * 32 characters per line in normal font mode.
 */

// ─────────────── BLE Printer Profiles ───────────────
// Common GATT service/characteristic UUIDs for 58mm thermal printers

const PRINTER_PROFILES = [
    {
        service: '000018f0-0000-1000-8000-00805f9b34fb',
        characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
    },
    {
        service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    },
    {
        service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    },
    {
        service: '0000ff00-0000-1000-8000-00805f9b34fb',
        characteristic: '0000ff02-0000-1000-8000-00805f9b34fb',
    },
];

// ─────────────── Connection State ───────────────

let cachedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let cachedDeviceName: string = '';

export function getConnectedPrinterName(): string {
    return cachedDeviceName;
}

export function isPrinterConnected(): boolean {
    return cachedCharacteristic !== null;
}

export function disconnectPrinter() {
    cachedCharacteristic = null;
    cachedDeviceName = '';
}

/**
 * Opens the browser Bluetooth picker, connects to printer, caches the characteristic.
 * Returns the device name on success.
 */
export async function connectPrinter(): Promise<string> {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth is not supported. Please use Chrome on Android.');
    }

    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_PROFILES.map(p => p.service),
    });

    if (!device.gatt) throw new Error('Bluetooth GATT not available on this device.');

    const server = await device.gatt.connect();

    for (const profile of PRINTER_PROFILES) {
        try {
            const service = await server.getPrimaryService(profile.service);
            const characteristic = await service.getCharacteristic(profile.characteristic);
            cachedCharacteristic = characteristic;
            cachedDeviceName = device.name || 'Printer';

            device.addEventListener('gattserverdisconnected', () => {
                cachedCharacteristic = null;
                cachedDeviceName = '';
            });

            return cachedDeviceName;
        } catch {
            continue;
        }
    }

    throw new Error('No compatible print service found. Make sure your printer is on.');
}

// ─────────────── ESC/POS Commands (minimal) ───────────────
// Plain text only — no bold, no font-size commands.

const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
    init:     [ESC, 0x40],              // Initialize printer
    feed3:    [ESC, 0x64, 0x03],        // Paper feed 3 lines
    cutPaper: [GS,  0x56, 0x42, 0x00], // Full cut
};

// ─────────────── Byte Builder ───────────────

const encoder = new TextEncoder();

function bytes(...parts: (number[] | Uint8Array | string)[]): Uint8Array {
    const arrays = parts.map(p => {
        if (typeof p === 'string') return encoder.encode(p);
        if (Array.isArray(p)) return new Uint8Array(p);
        return p;
    });
    const len = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

// ─────────────── Plain-Text Layout Helpers ───────────────
// 58mm printer in normal font = 32 chars per line
// Columns: ITEM(15) + QTY(7) + AMOUNT(10) = 32

const LINE_W   = 32;
const COL_NAME = 15;
const COL_QTY  = 7;
const COL_AMT  = 10;

/** Center a string within LINE_W using spaces */
function center(str: string): string {
    const pad = Math.max(0, Math.floor((LINE_W - str.length) / 2));
    return ' '.repeat(pad) + str + '\n';
}

/** Left-align, truncate if too long */
function lpad(str: string, len: number): string {
    str = String(str);
    if (str.length > len) str = str.substring(0, len - 1) + '.';
    return str.padEnd(len);
}

/** Right-align, truncate if too long */
function rpad(str: string, len: number): string {
    str = String(str);
    if (str.length > len) str = str.substring(0, len - 1) + '.';
    return str.padStart(len);
}

/** 32-dash separator */
function dashes(): string {
    return '-'.repeat(LINE_W) + '\n';
}

/** Fixed-column item row: ITEM(15) | QTY(7) | AMOUNT(10) */
function itemRow(name: string, qty: number, lineTotal: number): string {
    return (
        lpad(name, COL_NAME) +
        rpad(`x${qty}`, COL_QTY) +
        rpad(`Rs${lineTotal}`, COL_AMT) +
        '\n'
    );
}

// ─────────────── Receipt Builder ───────────────

export interface ReceiptData {
    shopName: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
    const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    // Column header - same widths as itemRow
    const headerRow =
        lpad('ITEM', COL_NAME) +
        rpad('QTY', COL_QTY) +
        rpad('AMOUNT', COL_AMT) +
        '\n';

    // Total row - QTY column left blank, AMOUNT right-aligned
    const totalRow =
        lpad('TOTAL', COL_NAME) +
        ' '.repeat(COL_QTY) +
        rpad(`Rs${data.total}`, COL_AMT) +
        '\n';

    const receipt = [
        //  ── Header ──────────────────────────────────
        center(data.shopName),   // "    CANTEEN INVOICE    "
        '\n',                    // empty line gap
        center(now),             // "   03/10/26 11:15 AM   "
        dashes(),

        //  ── Table ───────────────────────────────────
        headerRow,               // "ITEM             QTY    AMOUNT"
        dashes(),
        ...data.items.map(i =>
            itemRow(i.name, i.quantity, i.price * i.quantity)
        ),
        dashes(),

        //  ── Total ───────────────────────────────────
        totalRow,                // "TOTAL                     Rs85"
        dashes(),
        '\n',

        //  ── Footer ──────────────────────────────────
        center('Thank you!'),
        center('Made with 6ixmindslabs'),
    ].join('');

    return bytes(CMD.init, receipt, CMD.feed3, CMD.cutPaper);
}

// ─────────────── Send to Printer ───────────────

const CHUNK_SIZE = 100; // Safe BLE MTU chunk size

async function sendChunked(
    characteristic: BluetoothRemoteGATTCharacteristic,
    data: Uint8Array
) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        await characteristic.writeValue(data.slice(i, i + CHUNK_SIZE));
        await new Promise(r => setTimeout(r, 30));
    }
}

/**
 * Prints a receipt to the connected BLE printer.
 * Throws if no printer is connected.
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
    if (!cachedCharacteristic) {
        throw new Error('No printer connected. Tap "Connect Printer" first.');
    }
    await sendChunked(cachedCharacteristic, buildReceipt(data));
}
