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

    const saveOrderToDb = async () => {
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
    };

    const handlePrintBill = async () => {
        if (!cart || cart.length === 0) {
            alert(t('cart_is_empty'));
            return;
        }

        await saveOrderToDb();

        const receiptText = `
${t('college_canteen')}
-----------------------
${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}

${cart.map((item) => {
            const displayName = i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name;
            return `${displayName.padEnd(15)} x${item.quantity}  Rs.${item.price * item.quantity}`;
        }).join("\n")}

-----------------------
TOTAL: Rs.${total()}
-----------------------
Thank you!
`;

        window.location.href = "rawbt:" + encodeURIComponent(receiptText);
        clearCart();
    };

    const handlePrintReceipt = async () => {
        if (!cart || cart.length === 0) {
            alert(t('cart_is_empty'));
            return;
        }

        await saveOrderToDb();

        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';

        const cartRows = cart.map(item => {
            const displayName = i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name;
            return `
            <tr>
                <td style="width: 50%; padding: 2px 0;">${displayName}</td>
                <td style="width: 15%; text-align: center; padding: 2px 0;">${item.quantity}</td>
                <td style="width: 35%; text-align: right; padding: 2px 0;">${item.price * item.quantity}</td>
            </tr>`;
        }).join('');

        printContainer.innerHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 58mm; padding: 5px; font-size: 13px; color: #000; background: #fff;">
                <div style="text-align: center; font-weight: bold; font-size: 15px; margin-bottom: 5px;">${t('college_canteen')}</div>
                <div style="text-align: center; font-size: 11px; margin-bottom: 5px;">${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; border-bottom: 1px dashed #000;">Item</th>
                            <th style="text-align: center; border-bottom: 1px dashed #000;">Qty</th>
                            <th style="text-align: right; border-bottom: 1px dashed #000;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cartRows}
                    </tbody>
                </table>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
                    <span>TOTAL:</span>
                    <span>Rs.${total()}</span>
                </div>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
                <div style="text-align: center; margin-top: 10px; font-weight: bold;">Thank you!</div>
                <div style="border-top: 1px dashed #000; margin: 5px 0;"></div>
            </div>
        `;
        document.body.appendChild(printContainer);

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                const containerToRemove = document.getElementById('print-container');
                if (containerToRemove) document.body.removeChild(containerToRemove);
            }, 500);
        }, 100);

        clearCart();
    };

    return (
        <div className="billing-layout">
            {/* LEFT: Categories and Items */}
            <div className="product-section">
                <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
                    {/* Category Filter Scroll */}
                    <div className="flex gap-3 overflow-x-auto py-2.5 px-6 no-scrollbar border-b border-slate-100 bg-slate-50">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`whitespace-nowrap px-6 py-3 rounded-2xl font-bold text-base transition-all ${selectedCategory === null
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
                                className={`whitespace-nowrap px-6 py-3 rounded-2xl font-bold text-base transition-all ${selectedCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {i18n.language === 'ta' && cat.nameTa ? cat.nameTa : cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Item Grid */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-xl font-medium">{t('no_items')}</span>
                            </div>
                        ) : (
                            <div className="product-grid p-4">
                                {items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="group flex flex-col bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all active:scale-95 text-left h-40 relative overflow-hidden"
                                    >
                                        <div className="w-full h-20 mb-1.5 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="text-3xl text-slate-300 font-bold">🍕</div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-base text-slate-800 line-clamp-1 leading-tight">
                                            {i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name}
                                        </h3>
                                        <p className="text-lg font-extrabold text-blue-600 mt-auto">₹{item.price}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT: Cart Summary */}
            <div className="cart-sidebar">
                {/* Header */}
                <div className="p-3 border-b border-slate-100 bg-slate-800 text-white text-center rounded-t-2xl sm:rounded-none">
                    <h2 className="text-xl font-bold tracking-wider">{t('college_canteen')}</h2>
                    <p className="text-slate-400 text-[10px] mt-0.5">{t('live_order_summary')}</p>
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
                <div className="p-2 border-t border-slate-200 bg-white">
                    <div className="flex justify-between items-end mb-1.5">
                        <span className="text-lg font-bold text-slate-500">{t('total')}</span>
                        <span className="text-3xl font-extrabold text-slate-900 tracking-tight">₹{total()}</span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={clearCart}
                                disabled={cart.length === 0}
                                className="flex-1 py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                            >
                                {t('clear_bill')}
                            </button>

                            <button
                                type="button"
                                onClick={handlePrintReceipt}
                                disabled={cart.length === 0}
                                className="print-btn flex-1 flex items-center justify-center space-x-1 bg-blue-500 text-white font-bold text-xs py-3 rounded-xl hover:bg-blue-600 transition-all shadow-md disabled:opacity-50 active:scale-95"
                            >
                                <Printer size={16} />
                                <span>{t('print_receipt')}</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handlePrintBill}
                            disabled={cart.length === 0}
                            className="print-btn w-full flex items-center justify-center space-x-2 bg-green-500 text-white font-black text-lg py-4 rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 active:scale-95"
                        >
                            <Printer size={24} />
                            <span>{t('print_bill')}</span>
                        </button>
                    </div>
                </div>
            </div>


        </div>
    );
}
