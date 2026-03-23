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

const NON_ASCII_TEXT = /[^\x00-\x7F]/;

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
const GS = 0x1d;

const CMD = {
    init: [ESC, 0x40],              // Initialize printer
    feed3: [ESC, 0x64, 0x03],        // Paper feed 3 lines
    cutPaper: [GS, 0x56, 0x42, 0x00], // Full cut
};

const RECEIPT_PIXEL_WIDTH = 384;
const RECEIPT_PADDING = 16;
const RECEIPT_CONTENT_WIDTH = RECEIPT_PIXEL_WIDTH - (RECEIPT_PADDING * 2);
const RECEIPT_FONT_STACK = '"Noto Sans Tamil", "Nirmala UI", "Latha", sans-serif';
const TITLE_FONT = `700 30px ${RECEIPT_FONT_STACK}`;
const BODY_FONT = `400 22px ${RECEIPT_FONT_STACK}`;
const BODY_BOLD_FONT = `700 22px ${RECEIPT_FONT_STACK}`;
const SMALL_FONT = `400 18px ${RECEIPT_FONT_STACK}`;
const SMALL_BOLD_FONT = `700 18px ${RECEIPT_FONT_STACK}`;

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

const LINE_W = 32;
const COL_NAME = 15;
const COL_QTY = 7;
const COL_AMT = 10;

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
    headers?: {
        item: string;
        qty: string;
        amount: string;
        total: string;
        thanks: string;
    };
}

function buildPlainTextReceipt(data: ReceiptData): Uint8Array {
    const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    const lblItem = data.headers?.item || 'ITEM';
    const lblQty = data.headers?.qty || 'QTY';
    const lblAmt = data.headers?.amount || 'AMOUNT';
    const lblTotal = data.headers?.total || 'TOTAL';
    const lblThanks = data.headers?.thanks || 'Thank you!';

    // Column header - same widths as itemRow
    const headerRow =
        lpad(lblItem, COL_NAME) +
        rpad(lblQty, COL_QTY) +
        rpad(lblAmt, COL_AMT) +
        '\n';

    // Total row - QTY column left blank, AMOUNT right-aligned
    const totalRow =
        lpad(lblTotal, COL_NAME) +
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
        center(lblThanks),
        center('Made with 6ixmindslabs'),
    ].join('');

    return bytes(CMD.init, receipt, CMD.feed3, CMD.cutPaper);
}

function shouldRasterizeReceipt(data: ReceiptData): boolean {
    const headerValues = Object.values(data.headers || {});
    return [
        data.shopName,
        ...headerValues,
        ...data.items.map(item => item.name),
    ].some(value => NON_ASCII_TEXT.test(value));
}

async function waitForReceiptFonts(): Promise<void> {
    if (!document.fonts) return;

    try {
        await Promise.all([
            document.fonts.ready,
            document.fonts.load(TITLE_FONT, 'தமிழ்'),
            document.fonts.load(BODY_FONT, 'தமிழ்'),
            document.fonts.load(BODY_BOLD_FONT, 'தமிழ்'),
            document.fonts.load(SMALL_FONT, 'தமிழ்'),
            document.fonts.load(SMALL_BOLD_FONT, 'தமிழ்'),
        ]);
    } catch {
        // Fall back to the best available system font.
    }
}

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const lines: string[] = [];

    const splitLongToken = (token: string) => {
        const parts: string[] = [];
        let current = '';

        for (const char of Array.from(token)) {
            const test = current + char;
            if (!current || ctx.measureText(test).width <= maxWidth) {
                current = test;
                continue;
            }

            parts.push(current);
            current = char;
        }

        if (current) {
            parts.push(current);
        }

        return parts;
    };

    for (const paragraph of String(text).split('\n')) {
        if (!paragraph.trim()) {
            lines.push('');
            continue;
        }

        let currentLine = '';

        for (const word of paragraph.split(/\s+/)) {
            const nextLine = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(nextLine).width <= maxWidth) {
                currentLine = nextLine;
                continue;
            }

            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }

            if (ctx.measureText(word).width <= maxWidth) {
                currentLine = word;
                continue;
            }

            const brokenWord = splitLongToken(word);
            lines.push(...brokenWord.slice(0, -1));
            currentLine = brokenWord[brokenWord.length - 1] || '';
        }

        lines.push(currentLine);
    }

    return lines.length ? lines : [''];
}

function renderReceiptCanvas(data: ReceiptData): HTMLCanvasElement {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = RECEIPT_PIXEL_WIDTH;
    tempCanvas.height = Math.max(1200, 320 + (data.items.length * 120));

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas rendering is not supported on this device.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    let y = RECEIPT_PADDING;

    const drawWrappedText = (
        text: string,
        font: string,
        align: CanvasTextAlign,
        lineHeight: number
    ) => {
        ctx.font = font;
        ctx.textAlign = align;

        for (const line of wrapText(ctx, text, RECEIPT_CONTENT_WIDTH)) {
            const x = align === 'center'
                ? RECEIPT_PIXEL_WIDTH / 2
                : align === 'right'
                    ? RECEIPT_PIXEL_WIDTH - RECEIPT_PADDING
                    : RECEIPT_PADDING;
            ctx.fillText(line, x, y);
            y += lineHeight;
        }
    };

    const drawDivider = () => {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(RECEIPT_PADDING, y);
        ctx.lineTo(RECEIPT_PIXEL_WIDTH - RECEIPT_PADDING, y);
        ctx.stroke();
        y += 10;
    };

    const drawPair = (left: string, right: string, font: string, lineHeight: number) => {
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.fillText(left, RECEIPT_PADDING, y);
        ctx.textAlign = 'right';
        ctx.fillText(right, RECEIPT_PIXEL_WIDTH - RECEIPT_PADDING, y);
        y += lineHeight;
    };

    const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const qtyLabel = data.headers?.qty || 'Qty';
    const amountLabel = data.headers?.amount || 'Amount';
    const totalLabel = data.headers?.total || 'Total';
    const thanksLabel = data.headers?.thanks || 'Thank you!';

    drawWrappedText(data.shopName, TITLE_FONT, 'center', 34);
    y += 6;
    drawWrappedText(now, SMALL_FONT, 'center', 22);
    y += 10;
    drawDivider();

    for (const item of data.items) {
        drawWrappedText(item.name, BODY_BOLD_FONT, 'left', 28);
        const lineTotal = item.price * item.quantity;
        drawPair(
            `${qtyLabel}: ${item.quantity} x Rs${item.price}`,
            `${amountLabel}: Rs${lineTotal}`,
            SMALL_BOLD_FONT,
            24
        );
        y += 8;
    }

    drawDivider();
    drawPair(totalLabel, `Rs${data.total}`, BODY_BOLD_FONT, 30);
    y += 4;
    drawDivider();
    y += 6;
    drawWrappedText(thanksLabel, BODY_FONT, 'center', 28);
    drawWrappedText('Made with 6ixmindslabs', SMALL_FONT, 'center', 22);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = RECEIPT_PIXEL_WIDTH;
    finalCanvas.height = Math.ceil(y + RECEIPT_PADDING);

    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) {
        throw new Error('Canvas rendering is not supported on this device.');
    }

    finalCtx.fillStyle = '#ffffff';
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    finalCtx.drawImage(tempCanvas, 0, 0);

    return finalCanvas;
}

function canvasToRasterBytes(canvas: HTMLCanvasElement): Uint8Array {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas rendering is not supported on this device.');
    }

    const width = canvas.width;
    const height = canvas.height;
    const widthBytes = Math.ceil(width / 8);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const rasterBytes = new Uint8Array(widthBytes * height);

    let offset = 0;
    for (let y = 0; y < height; y++) {
        for (let xByte = 0; xByte < widthBytes; xByte++) {
            let value = 0;

            for (let bit = 0; bit < 8; bit++) {
                const x = (xByte * 8) + bit;
                if (x >= width) continue;

                const pixelOffset = ((y * width) + x) * 4;
                const r = pixels[pixelOffset];
                const g = pixels[pixelOffset + 1];
                const b = pixels[pixelOffset + 2];
                const a = pixels[pixelOffset + 3];

                if (a < 64) continue;

                const grayscale = (0.299 * r) + (0.587 * g) + (0.114 * b);
                if (grayscale < 200) {
                    value |= 0x80 >> bit;
                }
            }

            rasterBytes[offset++] = value;
        }
    }

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    return bytes([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH], rasterBytes);
}

export async function buildReceipt(data: ReceiptData): Promise<Uint8Array> {
    if (!shouldRasterizeReceipt(data)) {
        return buildPlainTextReceipt(data);
    }

    await waitForReceiptFonts();
    const canvas = renderReceiptCanvas(data);
    return bytes(CMD.init, canvasToRasterBytes(canvas), CMD.feed3, CMD.cutPaper);
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
 * Send arbitrary raw bytes to the connected BLE printer.
 * Useful for custom receipts that don't use the standard receipt builder.
 */
export async function sendRawBytes(data: Uint8Array): Promise<void> {
    if (!cachedCharacteristic) {
        throw new Error('No printer connected. Tap "Connect Printer" first.');
    }
    await sendChunked(cachedCharacteristic, data);
}

/**
 * Prints a receipt to the connected BLE printer.
 * Throws if no printer is connected.
 */
export async function printReceipt(data: ReceiptData): Promise<void> {
    if (!cachedCharacteristic) {
        throw new Error('No printer connected. Tap "Connect Printer" first.');
    }
    await sendChunked(cachedCharacteristic, await buildReceipt(data));
}
