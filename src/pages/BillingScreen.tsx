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
        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';

        // Ensure no images can be injected (pure text mapping)
        const cartRows = cart.map(item => {
            const displayName = i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name;
            return `
            <tr>
                <td style="width: 50%; padding: 4px 2px; color: #000;">${displayName}</td>
                <td style="width: 15%; text-align: center; padding: 4px 2px; color: #000;">${item.quantity}</td>
                <td style="width: 35%; text-align: right; padding: 4px 2px; color: #000;">₹${item.price * item.quantity}</td>
            </tr>`;
        }).join('');

        printContainer.innerHTML = `
            <div style="font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 58mm; padding: 10px; font-size: 13px; color: #000 !important; background: #fff !important; box-sizing: border-box;">
                <div style="text-align: center; font-weight: bold; font-size: 15px; margin-bottom: 8px; color: #000;">${t('college_canteen')}</div>
                <div style="text-align: center; font-size: 11px; margin-bottom: 8px; color: #000;">${new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #000;">
                    <thead>
                        <tr>
                            <th style="text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; color: #000;">Item</th>
                            <th style="text-align: center; border-bottom: 1px dashed #000; padding: 4px 0; color: #000;">Qty</th>
                            <th style="text-align: right; border-bottom: 1px dashed #000; padding: 4px 0; color: #000;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cartRows}
                    </tbody>
                </table>
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; padding: 4px 0; color: #000;">
                    <span>TOTAL:</span>
                    <span>Rs.${orderTotal}</span>
                </div>
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                <div style="text-align: center; margin-top: 10px; font-weight: bold; color: #000;">Thank you!</div>
                <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
                <div style="text-align: center; font-size: 11px; font-weight: bold; color: #000; padding: 4px 0;">Made with 6ixmindslabs</div>
            </div>
        `;
        document.body.appendChild(printContainer);

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                const containerToRemove = document.getElementById('print-container');
                if (containerToRemove) document.body.removeChild(containerToRemove);
            }, 1000);
        }, 200);

        // 3. Clear Bill
        clearCart();
    };

    return (
        <div className="billing-layout">
            {/* LEFT: Categories and Items */}
            <div className="product-section">
                <div className="flex flex-col bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
                    {/* Category Filter Scroll */}
                    <div className="flex gap-2 md:gap-3 overflow-x-auto py-2 md:py-2.5 px-3 md:px-6 no-scrollbar border-b border-slate-100 bg-slate-50">
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className={`whitespace-nowrap px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all ${selectedCategory === null
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
                                className={`whitespace-nowrap px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold text-sm md:text-base transition-all ${selectedCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {i18n.language === 'ta' && cat.nameTa ? cat.nameTa : cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Item Grid */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-slate-50/50">
                        {items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-lg md:text-xl font-medium">{t('no_items')}</span>
                            </div>
                        ) : (
                            <div className="product-grid">
                                {items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => addToCart(item)}
                                        className="group flex flex-col bg-white rounded-xl md:rounded-2xl p-2 md:p-2.5 shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all active:scale-95 text-left h-32 md:h-40 relative overflow-hidden"
                                    >
                                        <div className="w-full h-16 md:h-20 mb-1 md:mb-1.5 rounded-lg md:rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            ) : (
                                                <div className="text-2xl md:text-3xl text-slate-300 font-bold">🍕</div>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-sm md:text-base text-slate-800 line-clamp-1 leading-tight">
                                            {i18n.language === 'ta' && item.nameTa ? item.nameTa : item.name}
                                        </h3>
                                        <p className="text-base md:text-lg font-extrabold text-blue-600 mt-auto">₹{item.price}</p>
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
                <div className="p-2 md:p-3 border-b border-slate-100 bg-slate-800 text-white text-center">
                    <h2 className="text-lg md:text-xl font-bold tracking-wider">{t('college_canteen')}</h2>
                    <p className="text-slate-400 text-[9px] md:text-[10px] mt-0.5">{t('live_order_summary')}</p>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 bg-slate-50">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2 md:space-y-4">
                            <Trash2 size={36} className="md:w-12 md:h-12" />
                            <p className="font-medium text-sm md:text-lg text-center leading-tight px-4">{t('cart_is_empty')}<br />{t('tap_items_to_add')}</p>
                        </div>
                    ) : (
                        cart.map((cartItem) => (
                            <div key={cartItem.cartItemId} className="flex flex-col bg-white p-3 md:p-4 rounded-lg md:rounded-xl shadow-sm border border-slate-200 gap-2 md:gap-3">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-base md:text-lg text-slate-800 pr-2">
                                        {i18n.language === 'ta' && cartItem.nameTa ? cartItem.nameTa : cartItem.name}
                                    </span>
                                    <span className="font-extrabold text-base md:text-lg text-blue-600 whitespace-nowrap">₹{cartItem.price * cartItem.quantity}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 md:space-x-4 bg-slate-100 rounded-lg p-1 border border-slate-200">
                                        <button
                                            onClick={() => decreaseQuantity(cartItem.cartItemId)}
                                            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <Minus size={18} className="md:w-5 md:h-5" />
                                        </button>
                                        <span className="font-bold text-lg md:text-xl min-w-[2ch] flex justify-center text-slate-800">{cartItem.quantity}</span>
                                        <button
                                            onClick={() => increaseQuantity(cartItem.cartItemId)}
                                            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        >
                                            <Plus size={18} className="md:w-5 md:h-5" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => removeFromCart(cartItem.cartItemId)}
                                        className="p-2 md:p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} className="md:w-6 md:h-6" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Totals & Actions */}
                <div className="p-2 md:p-2 border-t border-slate-200 bg-white">
                    <div className="flex justify-between items-end mb-1 md:mb-1.5">
                        <span className="text-base md:text-lg font-bold text-slate-500">{t('total')}</span>
                        <span className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">₹{total()}</span>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={clearCart}
                            disabled={cart.length === 0}
                            className="px-3 md:px-4 py-2.5 md:py-3 bg-red-100 text-red-600 font-bold rounded-lg md:rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 text-xs md:text-sm"
                        >
                            {t('clear_bill')}
                        </button>

                        <button
                            onClick={handlePrint}
                            disabled={cart.length === 0}
                            className="flex-1 flex items-center justify-center space-x-1.5 md:space-x-2 bg-green-500 text-white font-black text-base md:text-lg py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            <Printer size={20} className="md:w-[22px] md:h-[22px]" />
                            <span>{t('print_bill')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
