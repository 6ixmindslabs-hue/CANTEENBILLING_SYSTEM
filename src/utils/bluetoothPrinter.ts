/**
 * Web Bluetooth ESC/POS Thermal Printer Utility
 * Supports 58mm thermal printers (common Chinese BLE printers)
 * Works on Chrome/Edge for Android
 */

// Common BLE GATT service/characteristic UUIDs for 58mm thermal printers
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

// Module-level cache: holds the active connection across renders
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
 * Prompts the user to select a Bluetooth printer and connects to it.
 * Returns the device name on success.
 */
export async function connectPrinter(): Promise<string> {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth is not supported on this browser. Please use Chrome on Android.');
    }

    const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_PROFILES.map(p => p.service),
    });

    if (!device.gatt) throw new Error('Bluetooth GATT not available on this device.');

    const server = await device.gatt.connect();

    // Try each known profile until one works
    for (const profile of PRINTER_PROFILES) {
        try {
            const service = await server.getPrimaryService(profile.service);
            const characteristic = await service.getCharacteristic(profile.characteristic);
            cachedCharacteristic = characteristic;
            cachedDeviceName = device.name || 'Printer';

            // Listen for disconnect
            device.addEventListener('gattserverdisconnected', () => {
                cachedCharacteristic = null;
                cachedDeviceName = '';
                console.log('Printer disconnected.');
            });

            return cachedDeviceName;
        } catch {
            // Try next profile
            continue;
        }
    }

    throw new Error('Could not find a compatible print service. Make sure your printer is on and paired.');
}

// ─────────────── ESC/POS Command Helpers ───────────────

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
    init: [ESC, 0x40],
    alignLeft: [ESC, 0x61, 0x00],
    alignCenter: [ESC, 0x61, 0x01],
    alignRight: [ESC, 0x61, 0x02],
    boldOn: [ESC, 0x45, 0x01],
    boldOff: [ESC, 0x45, 0x00],
    dblHeight: [GS, 0x21, 0x01],
    dblBoth: [GS, 0x21, 0x11],
    normalSize: [GS, 0x21, 0x00],
    feedLine: [0x0a],
    feed3: [ESC, 0x64, 0x03],
    cutPaper: [GS, 0x56, 0x42, 0x00],
};

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

/** Pad or truncate string to exactly `len` chars */
function pad(str: string, len: number, right = false): string {
    if (str.length > len) str = str.substring(0, len - 1) + '.';
    return right ? str.padStart(len) : str.padEnd(len);
}

/** Print row: name (left) | qty (center) | price (right) — 32 chars wide */
function itemRow(name: string, qty: number, price: number): string {
    const priceStr = `Rs.${price}`;
    const qtyStr = `x${qty}`;
    const nameWidth = 32 - qtyStr.length - priceStr.length - 2;
    return pad(name, nameWidth) + ' ' + qtyStr + ' ' + pad(priceStr, priceStr.length, true) + '\n';
}

function dashes(n = 32): string {
    return '-'.repeat(n) + '\n';
}

// ─────────────── Receipt Builder ───────────────

export interface ReceiptData {
    shopName: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
    const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    return bytes(
        CMD.init,

        // Shop Name — centered, bold, big
        CMD.alignCenter,
        CMD.boldOn,
        CMD.dblBoth,
        data.shopName + '\n',
        CMD.normalSize,
        CMD.boldOff,

        // Date/Time
        now + '\n',
        dashes(),

        // Header row
        CMD.alignLeft,
        CMD.boldOn,
        pad('ITEM', 18) + ' QTY    AMT\n',
        CMD.boldOff,
        dashes(),

        // Cart items
        ...data.items.map(i => itemRow(i.name, i.quantity, i.price * i.quantity)),

        dashes(),

        // Total
        CMD.boldOn,
        pad('TOTAL:', 18) + pad(`Rs.${data.total}`, 14, true) + '\n',
        CMD.boldOff,

        dashes(),

        // Footer
        CMD.alignCenter,
        CMD.boldOn,
        'Thank you!\n',
        CMD.boldOff,
        CMD.normalSize,
        'Made with 6ixmindslabs\n',

        // Feed and cut
        CMD.feed3,
        CMD.cutPaper,
    );
}

// ─────────────── Send to Printer ───────────────

const CHUNK_SIZE = 100; // BLE MTU safe size

async function sendChunked(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
        // Small delay to let the printer buffer process
        await new Promise(r => setTimeout(r, 30));
    }
}

/**
 * Prints the receipt to the connected BLE printer.
 * Throws if no printer is connected.
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
    if (!cachedCharacteristic) {
        throw new Error('No printer connected. Please connect a printer first.');
    }
    const receiptBytes = buildReceipt(data);
    await sendChunked(cachedCharacteristic, receiptBytes);
}
