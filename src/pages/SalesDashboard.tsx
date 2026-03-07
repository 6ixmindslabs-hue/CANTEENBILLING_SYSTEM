import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { TrendingUp, ShoppingBag, Printer, CalendarDays, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';

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

    const handlePrint = () => {
        const printWindow = document.createElement('iframe');
        printWindow.style.position = 'absolute';
        printWindow.style.top = '-1000px';
        document.body.appendChild(printWindow);

        const printDoc = printWindow.contentWindow?.document;
        if (printDoc) {
            let catHtml = '';
            let hasCats = false;
            categories.forEach(cat => {
                const catSales = reportData.categorySalesMap[cat.id] || 0;
                if (catSales > 0) {
                    hasCats = true;
                    const catNameText = i18n.language === 'ta' && cat.nameTa ? cat.nameTa : cat.name;
                    catHtml += `<div class="flex-between"><span>${catNameText}</span><span>Rs.${catSales}</span></div>`;
                }
            });
            const unkSales = reportData.categorySalesMap['unknown'] || 0;
            if (unkSales > 0) {
                hasCats = true;
                catHtml += `<div class="flex-between"><span>Uncategorized</span><span>Rs.${unkSales}</span></div>`;
            }
            if (!hasCats) {
                catHtml = '<div class="text-center">No sales</div>';
            }

            printDoc.open();
            printDoc.write(`
                <html>
                <head>
                    <title>Report - ${formatShortDate(reportPeriod.start)}</title>
                    <style>
                        @page { margin: 0; size: 58mm auto; }
                        body {
                            font-family: 'monospace';
                            width: 48mm;
                            margin: 0 auto;
                            padding: 10px 0;
                            font-size: 11px;
                            color: #000;
                        }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .text-lg { font-size: 13px; }
                        .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                        .flex-between { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .title { margin-bottom: 4px; font-weight: bold; text-align: center;}
                    </style>
                </head>
                <body>
                    <div class="text-center font-bold text-lg">
                        SALES REPORT
                    </div>
                    <div class="text-center">
                        ${formatShortDate(reportPeriod.start)} to ${formatShortDate(reportPeriod.end)}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="flex-between font-bold">
                        <span>Orders:</span>
                        <span>${reportData.totalOrders}</span>
                    </div>
                    <div class="flex-between font-bold">
                        <span>Total Sales:</span>
                        <span>Rs.${reportData.totalSales}</span>
                    </div>

                    <div class="divider"></div>
                    <div class="title">CATEGORY SALES</div>
                    <div class="divider"></div>
                    
                    ${catHtml}

                    <div class="divider"></div>
                    <div class="text-center">
                        Printed: ${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                </body>
                </html>
            `);
            printDoc.close();

            printWindow.contentWindow?.focus();
            setTimeout(() => {
                printWindow.contentWindow?.print();
                document.body.removeChild(printWindow);
            }, 500);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">

            {/* Sales Report Generation Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <FileText className="text-blue-600" size={28} />
                        {t('sales_report_builder')}
                    </h2>
                </div>

                <div className="p-6 md:p-8">
                    {/* Quick Filters */}
                    <div className="mb-8">
                        <div className="flex flex-wrap gap-3">
                            {filters.map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => handleFilterClick(filter)}
                                    className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${activeFilter === filter
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                        }`}
                                >
                                    {t(filter.toLowerCase().replace(' ', '_'))}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8 items-end">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                            <div className="space-y-2">
                                <label className="font-bold text-slate-600 block flex items-center gap-2">
                                    <CalendarDays size={18} className="text-slate-400" />
                                    {t('from_date')}
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => handleDateChange(e.target.value, 'start')}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold text-lg focus:ring-4 focus:ring-blue-500/20 active:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="font-bold text-slate-600 block flex items-center gap-2">
                                    <CalendarDays size={18} className="text-slate-400" />
                                    {t('to_date')}
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => handleDateChange(e.target.value, 'end')}
                                    className="w-full p-4 bg-white border border-slate-300 rounded-xl text-slate-800 font-bold text-lg focus:ring-4 focus:ring-blue-500/20 active:border-blue-500 outline-none transition-all cursor-pointer shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 w-full lg:w-auto">
                            <button
                                onClick={handlePrint}
                                className="flex-none px-6 py-4 bg-slate-800 text-white font-black text-lg rounded-xl hover:bg-slate-900 transition-all flex items-center gap-3 shadow-lg"
                            >
                                <Printer size={24} />
                                <span className="hidden sm:inline">{t('print_receipt')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards (Controlled by Generated Report) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-indigo-500 to-blue-700 text-white p-6 rounded-2xl shadow-lg border border-blue-400 relative overflow-hidden">
                    <ShoppingBag className="absolute -right-6 -bottom-6 text-blue-400 opacity-20 w-48 h-48" />
                    <h3 className="text-xl font-medium text-blue-100 mb-2">{t('total_orders')}</h3>
                    <p className="text-5xl font-black text-white">{reportData.totalOrders}</p>
                    <p className="text-blue-200 mt-2 font-medium">{t('all_time')}: {reportData.allTimeOrders}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-6 rounded-2xl shadow-lg border border-emerald-400 relative overflow-hidden">
                    <TrendingUp className="absolute -right-6 -bottom-6 text-emerald-400 opacity-20 w-48 h-48" />
                    <h3 className="text-xl font-medium text-emerald-100 mb-2">{t('total_sales')}</h3>
                    <p className="text-5xl font-black text-white">₹{reportData.totalSales}</p>
                    <p className="text-emerald-200 mt-2 font-medium">{t('for_selected_period')}</p>
                </div>
            </div>

            {/* Detailed Sales Report Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">
                        {t('itemized_sales_report')}
                        <span className="block text-sm font-medium text-slate-500 mt-1">
                            {formatShortDate(reportPeriod.start)} {t('to_word')} {formatShortDate(reportPeriod.end)}
                        </span>
                    </h3>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
                            <tr className="text-slate-500 border-b border-slate-200">
                                <th className="p-5 font-bold">{t('date_and_time')}</th>
                                <th className="p-5 font-bold">{t('item')}</th>
                                <th className="p-5 font-bold">{t('category')}</th>
                                <th className="p-5 font-bold text-right">{t('qty')}</th>
                                <th className="p-5 font-bold text-right">{t('price')}</th>
                                <th className="p-5 font-bold text-right">{t('total')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reportData.detailedSalesArray.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-16 text-center text-slate-400 font-medium text-lg">
                                        {t('no_sales_found')}
                                    </td>
                                </tr>
                            ) : (
                                reportData.detailedSalesArray.map((sale) => (
                                    <tr key={sale.cartItemId} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-5 text-slate-600 font-medium whitespace-nowrap">{new Date(sale.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td className="p-5 font-bold text-slate-800">{sale.itemNameDisplay}</td>
                                        <td className="p-5 text-slate-600">
                                            <span className="px-3 py-1 bg-white shadow-sm border border-slate-200 rounded-lg text-sm font-bold whitespace-nowrap">
                                                {sale.categoryName}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right font-bold text-slate-700">{sale.quantity}</td>
                                        <td className="p-5 text-right text-slate-600">₹{sale.price}</td>
                                        <td className="p-5 text-right font-black text-blue-600">₹{sale.total}</td>
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
