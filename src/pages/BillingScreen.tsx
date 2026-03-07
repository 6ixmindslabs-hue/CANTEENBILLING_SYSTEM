import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Printer, Trash2, Plus, Minus } from 'lucide-react';

export default function BillingScreen() {
    const { t, i18n } = useTranslation();
    const { cart, addToCart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, total, selectedCategory, setSelectedCategory } = useStore();

    const categories = useLiveQuery(() => db.categories.toArray()) || [];
    const items = useLiveQuery(() => {
        if (selectedCategory) {
            return db.items.where('categoryId').equals(selectedCategory).toArray();
        }
        return db.items.toArray();
    }, [selectedCategory]) || [];

    const handlePrint = async () => {
        if (cart.length === 0) return;

        // 1. Save to DB
        const orderId = crypto.randomUUID();
        const orderTotal = total();

        await db.orders.add({
            id: orderId,
            date: Date.now(),
            totalAmount: orderTotal
        });

        for (const item of cart) {
            await db.orderItems.add({
                id: crypto.randomUUID(),
                orderId,
                itemId: item.id,
                name: item.name,
                nameTa: item.nameTa,
                quantity: item.quantity,
                price: item.price
            });
        }

        // 2. Print via Browser Print API formatted for 58mm
        const printWindow = document.createElement('iframe');
        printWindow.style.position = 'absolute';
        printWindow.style.top = '-1000px';
        document.body.appendChild(printWindow);

        const printDoc = printWindow.contentWindow?.document;
        if (printDoc) {
            printDoc.open();
            printDoc.write(`
                <html>
                <head>
                    <title>Print Receipt</title>
                    <style>
                        @page { margin: 0; size: 58mm auto; }
                        body {
                            font-family: 'monospace';
                            width: 48mm; /* Leave small margin inside 58mm */
                            margin: 0 auto;
                            padding: 10px 0;
                            font-size: 12px;
                            color: #000;
                        }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .text-lg { font-size: 14px; }
                        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
                        table { w-full; border-collapse: collapse; width: 100%; }
                        th, td { text-align: left; padding: 2px 0; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .item-name { width: 50%; max-width: 24mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                        .qty { width: 15%; text-align: center; }
                        .price { width: 35%; text-align: right; }
                        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="text-center font-bold text-lg">
                        ${t('college_canteen')}
                    </div>
                    <div class="text-center">
                        ${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th class="item-name">Item</th>
                                <th class="qty">Qty</th>
                                <th class="price">Amt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.map(item => {
                const displayName = i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name;
                return `
                                <tr>
                                    <td class="item-name">${displayName}</td>
                                    <td class="qty">${item.quantity}</td>
                                    <td class="price">${item.price * item.quantity}</td>
                                </tr>`;
            }).join('')}
                        </tbody>
                    </table>
                    
                    <div class="divider"></div>
                    
                    <div class="total-row">
                        <span>Total:</span>
                        <span>Rs.${orderTotal}</span>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="text-center">
                        Thank You!
                    </div>
                </body>
                </html>
            `);
            printDoc.close();

            printWindow.contentWindow?.focus();
            setTimeout(() => {
                printWindow.contentWindow?.print();
                document.body.removeChild(printWindow);
            }, 500); // Give time for styles to render
        }

        // 3. Clear Bill
        clearCart();
    };

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* LEFT: Categories and Items Grid */}
            <div className="flex-1 flex flex-col min-h-[50vh] lg:min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Category Filter Scroll */}
                <div className="flex gap-3 overflow-x-auto py-4 px-6 no-scrollbar border-b border-slate-100 bg-slate-50">
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className={`whitespace-nowrap px-6 py-4 rounded-2xl font-bold text-lg transition-all ${selectedCategory === null
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        {t('all')}
                    </button>

                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`whitespace-nowrap px-6 py-4 rounded-2xl font-bold text-lg transition-all ${selectedCategory === cat.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {i18n.language === 'ta' && cat.nameTa ? cat.nameTa : cat.name}
                        </button>
                    ))}
                </div>

                {/* Item Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <span className="text-xl font-medium">{t('no_items')}</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                            {items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="group flex flex-col bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 transition-all active:scale-95 text-left h-48 relative overflow-hidden"
                                >
                                    <div className="w-full h-24 mb-3 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <div className="text-4xl text-slate-300 font-bold">🍕</div>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1">
                                        {i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name}
                                    </h3>
                                    <p className="text-xl font-extrabold text-blue-600 mt-auto">₹{item.price}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Bill Summary */}
            <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 h-[60vh] lg:h-full flex-shrink-0 relative overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-slate-800 text-white text-center rounded-t-2xl">
                    <h2 className="text-2xl font-bold tracking-wider">{t('college_canteen')}</h2>
                    <p className="text-slate-400 text-sm mt-1">{t('live_order_summary')}</p>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-4">
                            <Trash2 size={48} />
                            <p className="font-medium text-lg text-center leading-tight">{t('cart_is_empty')}<br />{t('tap_items_to_add')}</p>
                        </div>
                    ) : (
                        cart.map((cartItem) => (
                            <div key={cartItem.cartItemId} className="flex flex-col bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-3 slide-in-from-right animate-in fade-in duration-300 zoom-in-95">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-lg text-slate-800 pr-2">
                                        {i18n.language === 'ta' && cartItem.nameTa ? cartItem.nameTa : cartItem.name}
                                    </span>
                                    <span className="font-extrabold text-lg text-blue-600">₹{cartItem.price * cartItem.quantity}</span>
                                </div>

                                <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center space-x-4 bg-slate-100 rounded-lg p-1 border border-slate-200">
                                        <button
                                            onClick={() => decreaseQuantity(cartItem.cartItemId)}
                                            className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <Minus size={20} />
                                        </button>
                                        <span className="font-bold text-xl min-w-[2ch] flex justify-center text-slate-800">{cartItem.quantity}</span>
                                        <button
                                            onClick={() => increaseQuantity(cartItem.cartItemId)}
                                            className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => removeFromCart(cartItem.cartItemId)}
                                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={24} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Totals & Actions */}
                <div className="p-5 border-t border-slate-200 bg-white">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-xl font-bold text-slate-500">{t('total')}</span>
                        <span className="text-4xl font-extrabold text-slate-900 tracking-tight">₹{total()}</span>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={clearCart}
                            disabled={cart.length === 0}
                            className="px-6 py-4 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                            {t('clear_bill')}
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={cart.length === 0}
                            className="flex-1 flex items-center justify-center space-x-3 bg-green-500 text-white font-black text-xl py-4 rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 active:translate-y-0"
                        >
                            <Printer size={28} />
                            <span>{t('print_bill')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
