import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TrendingUp, ShoppingBag, Printer, CalendarDays, FileText, Bluetooth, BluetoothOff, BluetoothSearching } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import {
    connectPrinter,
    isPrinterConnected,
    getConnectedPrinterName,
    disconnectPrinter,
    sendRawBytes,
} from '../utils/bluetoothPrinter';

// Format YYYY-MM-DD helper for inputs
const toDateStr = (date: Date) => {
    // ensure local timezone
    const offset = date.getTimezoneOffset();
    const d = new Date(date.getTime() - (offset * 60 * 1000));
    return d.toISOString().split('T')[0];
};

export default function SalesDashboard() {
    const { t, i18n } = useTranslation();
    const orders = useLiveQuery(() => db.orders.toArray()) || [];
    const orderItems = useLiveQuery(() => db.orderItems.toArray()) || [];
    const categories = useLiveQuery(() => db.categories.toArray()) || [];
    const items = useLiveQuery(() => db.items.toArray()) || [];

    const getTodayStr = () => toDateStr(new Date());

    const [activeFilter, setActiveFilter] = useState('Today');
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState(getTodayStr());

    // Bluetooth printer state
    const [printerName, setPrinterName] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printerError, setPrinterError] = useState('');

    useEffect(() => {
        setPrinterName(getConnectedPrinterName());
    }, []);

    const connected = isPrinterConnected();

    const handleConnect = async () => {
        if (isPrinterConnected()) {
            disconnectPrinter();
            setPrinterName('');
            return;
        }
        setIsConnecting(true);
        setPrinterError('');
        try {
            const name = await connectPrinter();
            setPrinterName(name);
        } catch (err: unknown) {
            setPrinterError(err instanceof Error ? err.message : 'Connection failed');
        } finally {
            setIsConnecting(false);
        }
    };

    // The rendered report state lock
    const [reportPeriod, setReportPeriod] = useState({
        start: getTodayStr(),
        end: getTodayStr()
    });

    const filters = ['Today', 'Yesterday', 'This Week', 'This Month', 'Custom'];

    const handleFilterClick = (filter: string) => {
        setActiveFilter(filter);
        if (filter === 'Custom') return;

        const now = new Date();
        let endStr = toDateStr(now);
        setEndDate(endStr);

        let startD = new Date();
        if (filter === 'Today') {
            startD = now;
        } else if (filter === 'Yesterday') {
            startD.setDate(startD.getDate() - 1);
            setEndDate(toDateStr(startD)); // Yesterday ends yesterday
            endStr = toDateStr(startD);
        } else if (filter === 'This Week') {
            const day = startD.getDay();
            const diff = startD.getDate() - day + (day === 0 ? -6 : 1); // Monday start
            startD.setDate(diff);
        } else if (filter === 'This Month') {
            startD.setDate(1);
        }

        const startStr = toDateStr(startD);
        setStartDate(startStr);
        setReportPeriod({ start: startStr, end: endStr });
    };

    const handleDateChange = (val: string, type: 'start' | 'end') => {
        setActiveFilter('Custom');
        if (type === 'start') {
            setStartDate(val);
            setReportPeriod({ start: val, end: endDate });
        } else {
            setEndDate(val);
            setReportPeriod({ start: startDate, end: val });
        }
    };

    // Calculate all report data based exclusively on reportPeriod
    const reportData = useMemo(() => {
        let sTime = 0;
        let eTime = Number.MAX_SAFE_INTEGER;

        if (reportPeriod.start) {
            const d = new Date(reportPeriod.start);
            d.setHours(0, 0, 0, 0);
            sTime = d.getTime();
        }
        if (reportPeriod.end) {
            const d = new Date(reportPeriod.end);
            d.setHours(23, 59, 59, 999);
            eTime = d.getTime();
        }

        const filteredOrders = orders.filter(o => o.date >= sTime && o.date <= eTime);
        const totalSales = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = filteredOrders.length;

        const filteredOrderIds = new Set(filteredOrders.map(o => o.id));
        const filteredOrderItems = orderItems.filter(item => filteredOrderIds.has(item.orderId));

        const itemCounts: Record<string, number> = {};
        const categorySalesMap: Record<string, number> = {};
        const itemSalesMap: Record<string, number> = {};

        filteredOrderItems.forEach(orderItem => {
            const itemDef = items.find(i => i.id === orderItem.itemId);

            // Item Name & Count tracking
            const itemName = i18n.language === 'ta' && orderItem.nameTa ? orderItem.nameTa : orderItem.name;
            itemSalesMap[itemName] = (itemSalesMap[itemName] || 0) + orderItem.quantity;
            itemCounts[itemName] = (itemCounts[itemName] || 0) + orderItem.quantity;

            // Category tracking
            const catId = itemDef ? itemDef.categoryId : 'unknown';
            const catTotal = orderItem.price * orderItem.quantity;
            categorySalesMap[catId] = (categorySalesMap[catId] || 0) + catTotal;
        });

        // Top Item resolution
        let topItem = '-';
        let maxQty = 0;
        for (const [name, qty] of Object.entries(itemCounts)) {
            if (qty > maxQty) {
                maxQty = qty;
                topItem = name;
            }
        }

        // Table Mapping
        const orderMap = new Map(filteredOrders.map(o => [o.id, o]));
        const detailedSalesArray = filteredOrderItems.map(item => {
            const order = orderMap.get(item.orderId)!;
            const itemDef = items.find(i => i.id === item.itemId);
            const categoryDef = itemDef ? categories.find(c => c.id === itemDef.categoryId) : undefined;
            return {
                ...item,
                cartItemId: item.id + '-' + order.id,
                date: order.date,
                categoryName: categoryDef ? (i18n.language === 'ta' && categoryDef.nameTa ? categoryDef.nameTa : categoryDef.name) : t('uncategorized'),
                itemNameDisplay: i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name,
                total: item.price * item.quantity
            };
        }).sort((a, b) => b.date - a.date);

        return {
            totalSales,
            totalOrders,
            topItem,
            allTimeOrders: orders.length,
            detailedSalesArray,
            categorySalesMap,
            itemSalesMap
        };
    }, [orders, orderItems, items, categories, reportPeriod, i18n.language]);

    // Format for Print "01-03-2026"
    const formatShortDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
    };

    const handlePrint = async () => {
        if (!isPrinterConnected()) {
            setPrinterError('Connect a printer first!');
            return;
        }
        setIsPrinting(true);
        setPrinterError('');
        try {
            // Build ESC/POS plain-text sales summary
            const LINE_W = 32;
            const dashes = () => '-'.repeat(LINE_W) + '\n';
            const center = (str: string) => {
                const pad = Math.max(0, Math.floor((LINE_W - str.length) / 2));
                return ' '.repeat(pad) + str + '\n';
            };
            const lpad = (str: string, len: number) => {
                str = String(str);
                if (str.length > len) str = str.substring(0, len - 1) + '.';
                return str.padEnd(len);
            };
            const rpad = (str: string, len: number) => {
                str = String(str);
                if (str.length > len) str = str.substring(0, len - 1) + '.';
                return str.padStart(len);
            };

            const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            const period = `${formatShortDate(reportPeriod.start)} to ${formatShortDate(reportPeriod.end)}`;

            // Category rows
            const catRows: string[] = [];
            categories.forEach(cat => {
                const sales = reportData.categorySalesMap[cat.id] || 0;
                if (sales > 0) {
                    const name = i18n.language === 'ta' && cat.nameTa ? cat.nameTa : cat.name;
                    catRows.push(lpad(name, 22) + rpad(`Rs${sales}`, 10) + '\n');
                }
            });
            const unkSales = reportData.categorySalesMap['unknown'] || 0;
            if (unkSales > 0) {
                catRows.push(lpad(t('uncategorized'), 22) + rpad(`Rs${unkSales}`, 10) + '\n');
            }
            if (catRows.length === 0) catRows.push(center('No sales'));

            const receipt = [
                center(t('sales_report_builder').toUpperCase()),
                '\n',
                center(now),
                center(period),
                dashes(),
                lpad(`${t('total_orders')}:`, 22) + rpad(String(reportData.totalOrders), 10) + '\n',
                lpad(`${t('total_sales')}:`, 22) + rpad(`Rs${reportData.totalSales}`, 10) + '\n',
                dashes(),
                center(t('categories').toUpperCase() + ' ' + t('dashboard').toUpperCase()),
                dashes(),
                ...catRows,
                dashes(),
                '\n',
                center(t('thank_you') || 'Thank you!'),
            ].join('');

            // ESC/POS: init + text + feed + cut
            const ESC = 0x1b, GS = 0x1d;
            const encoder = new TextEncoder();
            const textBytes = encoder.encode(receipt);
            const header = new Uint8Array([ESC, 0x40]);
            const feed = new Uint8Array([ESC, 0x64, 0x03]);
            const cut = new Uint8Array([GS, 0x56, 0x42, 0x00]);

            const data = new Uint8Array(
                header.length + textBytes.length + feed.length + cut.length
            );
            let off = 0;
            data.set(header, off); off += header.length;
            data.set(textBytes, off); off += textBytes.length;
            data.set(feed, off); off += feed.length;
            data.set(cut, off);

            // Send raw bytes directly to connected printer
            await sendRawBytes(data);
        } catch (err: unknown) {
            setPrinterError(err instanceof Error ? err.message : 'Print failed');
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">

            {/* Sales Report Generation Card */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 md:gap-4 justify-between items-start sm:items-center">
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2 md:gap-3">
                        <FileText className="text-blue-600" size={24} />
                        <span className="text-lg md:text-2xl">{t('sales_report_builder')}</span>
                    </h2>
                </div>

                <div className="p-4 md:p-6 lg:p-8">
                    {/* Quick Filters */}
                    <div className="mb-6 md:mb-8">
                        <div className="flex flex-wrap gap-2 md:gap-3">
                            {filters.map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => handleFilterClick(filter)}
                                    className={`px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold text-xs md:text-sm transition-all ${activeFilter === filter
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                        }`}
                                >
                                    {t(filter.toLowerCase().replace(' ', '_'))}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 items-end">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                            <div className="space-y-2">
                                <label className="font-bold text-slate-600 text-sm md:text-base block flex items-center gap-2">
                                    <CalendarDays size={16} className="text-slate-400 md:w-[18px] md:h-[18px]" />
                                    {t('from_date')}
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => handleDateChange(e.target.value, 'start')}
                                    className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-lg md:rounded-xl text-slate-800 font-bold text-base md:text-lg focus:ring-4 focus:ring-blue-500/20 active:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="font-bold text-slate-600 text-sm md:text-base block flex items-center gap-2">
                                    <CalendarDays size={16} className="text-slate-400 md:w-[18px] md:h-[18px]" />
                                    {t('to_date')}
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => handleDateChange(e.target.value, 'end')}
                                    className="w-full p-3 md:p-4 bg-white border border-slate-300 rounded-lg md:rounded-xl text-slate-800 font-bold text-base md:text-lg focus:ring-4 focus:ring-blue-500/20 active:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full lg:w-auto">
                            {/* Bluetooth status */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${connected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}>
                                <button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition-all ${connected
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        } disabled:opacity-50`}
                                >
                                    {isConnecting ? <BluetoothSearching size={13} className="animate-pulse" /> : connected ? <Bluetooth size={13} /> : <BluetoothOff size={13} />}
                                    {isConnecting ? 'Connecting...' : connected ? printerName : 'Connect Printer'}
                                </button>
                                {printerError && <span className="text-red-500 text-[10px] truncate max-w-[140px]">{printerError}</span>}
                            </div>

                            {/* Print button */}
                            <button
                                onClick={handlePrint}
                                disabled={!connected || isPrinting}
                                className="flex-1 lg:flex-none px-5 md:px-6 py-3 md:py-4 bg-slate-800 text-white font-black text-base md:text-lg rounded-lg md:rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 md:gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Printer size={20} className="md:w-6 md:h-6" />
                                <span>{isPrinting ? 'Printing...' : t('print_receipt')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards (Controlled by Generated Report) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white p-5 md:p-6 rounded-xl md:rounded-2xl shadow-lg border border-blue-400 relative overflow-hidden">
                    <ShoppingBag className="absolute -right-4 -bottom-4 md:-right-6 md:-bottom-6 text-blue-400 opacity-20 w-32 h-32 md:w-48 md:h-48" />
                    <h3 className="text-lg md:text-xl font-medium text-blue-100 mb-1 md:mb-2">{t('total_orders')}</h3>
                    <p className="text-4xl md:text-5xl font-black text-white">{reportData.totalOrders}</p>
                    <p className="text-blue-200 mt-1.5 md:mt-2 font-medium text-sm md:text-base">{t('all_time')}: {reportData.allTimeOrders}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 md:p-6 rounded-xl md:rounded-2xl shadow-lg border border-emerald-400 relative overflow-hidden">
                    <TrendingUp className="absolute -right-4 -bottom-4 md:-right-6 md:-bottom-6 text-emerald-400 opacity-20 w-32 h-32 md:w-48 md:h-48" />
                    <h3 className="text-lg md:text-xl font-medium text-emerald-100 mb-1 md:mb-2">{t('total_sales')}</h3>
                    <p className="text-4xl md:text-5xl font-black text-white">₹{reportData.totalSales}</p>
                    <p className="text-emerald-200 mt-1.5 md:mt-2 font-medium text-sm md:text-base">{t('for_selected_period')}</p>
                </div>
            </div>

            {/* Detailed Sales Report Table */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800">
                        {t('itemized_sales_report')}
                        <span className="block text-xs md:text-sm font-medium text-slate-500 mt-1">
                            {formatShortDate(reportPeriod.start)} {t('to_word')} {formatShortDate(reportPeriod.end)}
                        </span>
                    </h3>
                </div>

                <div className="overflow-x-auto max-h-[500px] md:max-h-[600px] overflow-y-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="p-3 md:p-5 font-bold text-xs md:text-sm">{t('date_and_time')}</th>
                                <th className="p-3 md:p-5 font-bold text-xs md:text-sm">{t('item')}</th>
                                <th className="p-3 md:p-5 font-bold text-xs md:text-sm">{t('category')}</th>
                                <th className="p-3 md:p-5 font-bold text-right text-xs md:text-sm">{t('qty')}</th>
                                <th className="p-3 md:p-5 font-bold text-right text-xs md:text-sm">{t('price')}</th>
                                <th className="p-3 md:p-5 font-bold text-right text-xs md:text-sm">{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.detailedSalesArray.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 md:p-16 text-center text-slate-400 font-medium text-base md:text-lg">
                                        {t('no_sales_found')}
                                    </td>
                                </tr>
                            ) : (
                                reportData.detailedSalesArray.map((sale) => (
                                    <tr key={sale.cartItemId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 md:p-5 text-slate-600 font-medium whitespace-nowrap text-xs md:text-sm">{new Date(sale.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td className="p-3 md:p-5 font-bold text-slate-800 text-xs md:text-base">{sale.itemNameDisplay}</td>
                                        <td className="p-3 md:p-5 text-slate-600">
                                            <span className="px-2 md:px-3 py-0.5 md:py-1 bg-white shadow-sm border border-slate-200 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap">
                                                {sale.categoryName}
                                            </span>
                                        </td>
                                        <td className="p-3 md:p-5 text-right font-bold text-slate-700 text-xs md:text-sm">{sale.quantity}</td>
                                        <td className="p-3 md:p-5 text-right text-slate-600 text-xs md:text-sm">₹{sale.price}</td>
                                        <td className="p-3 md:p-5 text-right font-black text-blue-600 text-xs md:text-base">₹{sale.total}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
