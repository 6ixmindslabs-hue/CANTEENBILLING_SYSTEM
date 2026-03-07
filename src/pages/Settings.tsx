import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db/db';
import { Languages, Trash2, Database, Key, Eye, EyeOff, Download, Upload, Server, ImageIcon, CheckCircle } from 'lucide-react';

export default function Settings() {
    const { t, i18n } = useTranslation();
    const [clearing, setClearing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);

    // PIN Reset state
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [showPins, setShowPins] = useState(false);

    useEffect(() => {
        // Load settings from Dexie (if implemented)
    }, []);

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
    };

    const handleChangePin = (e: React.FormEvent) => {
        e.preventDefault();
        const savedPin = localStorage.getItem('adminPin') || '1234';

        if (currentPin !== savedPin) {
            alert(t('incorrect_pin'));
            return;
        }
        if (!newPin.trim()) {
            alert(t('new_pin_empty'));
            return;
        }
        if (newPin !== confirmPin) {
            alert(t('pin_mismatch'));
            return;
        }

        localStorage.setItem('adminPin', newPin);
        alert(t('pin_updated'));
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
    };

    const handleClearDatabase = async () => {
        if (window.confirm(t('clear_warning1'))) {
            if (window.confirm(t('clear_warning2'))) {
                setClearing(true);
                try {
                    await db.orders.clear();
                    await db.orderItems.clear();
                    alert(t('sales_cleared'));
                } catch (error) {
                    alert(t('clear_error'));
                } finally {
                    setClearing(false);
                }
            }
        }
    };

    const handleExportBackup = async () => {
        setExporting(true);
        setExportSuccess(false);
        try {
            const categories = await db.categories.toArray();
            const items = await db.items.toArray();
            const orders = await db.orders.toArray();
            const orderItems = await db.orderItems.toArray();
            const settings = await db.settings.toArray();

            const backupData = {
                version: 2,
                categories,
                items,          // includes base64 image data
                orders,
                orderItems,
                settings,
                timestamp: new Date().toISOString(),
                imageCount: items.filter(i => i.image).length
            };

            // Use Blob for large files (images make JSON big)
            const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(jsonBlob);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', url);
            downloadAnchorNode.setAttribute('download', `canteen_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            URL.revokeObjectURL(url);

            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 4000);
        } catch (error) {
            alert(t('export_error'));
        } finally {
            setExporting(false);
        }
    };

    const handleImportBackup = () => {
        setImportSuccess(false);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);

                    if (data.categories && data.items) {
                        const itemsWithImages = data.items.filter((i: any) => i.image).length;
                        const confirmMsg = `${t('restore_confirm')}\n\n📦 ${data.categories.length} categories\n🍽️ ${data.items.length} items (${itemsWithImages} with images)\n🧾 ${data.orders?.length ?? 0} orders`;
                        if (window.confirm(confirmMsg)) {
                            setClearing(true);
                            if (data.categories.length) await db.categories.bulkPut(data.categories);
                            if (data.items.length) await db.items.bulkPut(data.items);
                            if (data.orders?.length) await db.orders.bulkPut(data.orders);
                            if (data.orderItems?.length) await db.orderItems.bulkPut(data.orderItems);
                            if (data.settings?.length) await db.settings.bulkPut(data.settings);

                            setImportSuccess(true);
                            setTimeout(() => setImportSuccess(false), 4000);
                        }
                    } else {
                        alert(t('invalid_backup'));
                    }
                } catch (error) {
                    alert(t('import_error'));
                } finally {
                    setClearing(false);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-8 text-slate-800 flex items-center gap-3">
                    <Languages className="text-blue-600" />
                    {t('language')}
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleLanguageChange('en')}
                        className={`p-6 rounded-2xl font-bold text-xl border-2 transition-all ${i18n.language === 'en'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                    >
                        English
                    </button>
                    <button
                        onClick={() => handleLanguageChange('ta')}
                        className={`p-6 rounded-2xl font-bold text-xl border-2 transition-all ${i18n.language === 'ta'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                    >
                        தமிழ் (Tamil)
                    </button>
                </div>
            </div>

            {/* Admin PIN Reset */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-3">
                    <Key className="text-blue-600" />
                    {t('security_settings')}
                </h2>
                <form onSubmit={handleChangePin} className="space-y-4 max-w-sm">
                    <div className="relative">
                        <label className="font-bold text-slate-600 block mb-1 ml-1">{t('current_pin')}</label>
                        <div className="relative">
                            <input
                                type={showPins ? "text" : "password"}
                                value={currentPin}
                                onChange={(e) => setCurrentPin(e.target.value)}
                                className="w-full p-4 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black tracking-widest text-center"
                                placeholder="****"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPins(!showPins)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPins ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <label className="font-bold text-slate-600 block mb-1 ml-1">{t('new_pin')}</label>
                        <div className="relative">
                            <input
                                type={showPins ? "text" : "password"}
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                className="w-full p-4 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black tracking-widest text-center"
                                placeholder="****"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPins(!showPins)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPins ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <label className="font-bold text-slate-600 block mb-1 ml-1">{t('confirm_new_pin')}</label>
                        <div className="relative">
                            <input
                                type={showPins ? "text" : "password"}
                                value={confirmPin}
                                onChange={(e) => setConfirmPin(e.target.value)}
                                className="w-full p-4 pr-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black tracking-widest text-center"
                                placeholder="****"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPins(!showPins)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                            >
                                {showPins ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                    >
                        {t('update_admin_pin')}
                    </button>
                </form>
            </div>

            {/* Data Backup & Restore */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-2 text-slate-800 flex items-center gap-3">
                    <Server className="text-blue-600" />
                    {t('data_backup_restore')}
                </h2>
                <p className="text-slate-500 text-sm mb-6 flex items-center gap-2">
                    <ImageIcon size={14} className="text-blue-400 flex-shrink-0" />
                    Backup includes all categories, items (with images), orders and settings.
                </p>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 bg-blue-50/50 border border-blue-100 p-6 rounded-2xl">
                        <Download className="text-blue-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg text-slate-800 mb-2">{t('export_backup')}</h3>
                        <p className="text-slate-600 mb-6 text-sm">
                            {t('export_help_text')}<br />
                            <span className="text-blue-600 font-medium text-xs">✓ Item images included as data</span>
                        </p>
                        {exportSuccess && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mb-3 text-sm font-bold">
                                <CheckCircle size={16} /> Backup downloaded successfully!
                            </div>
                        )}
                        <button
                            onClick={handleExportBackup}
                            disabled={exporting}
                            className="w-full py-4 bg-white text-blue-600 border border-blue-200 font-bold rounded-xl hover:bg-blue-50 transition shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {exporting ? (
                                <><span className="animate-spin inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></span> Preparing.....</>
                            ) : (
                                <><Download size={18} /> {t('export_backup')}</>
                            )}
                        </button>
                    </div>

                    <div className="flex-1 bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl">
                        <Upload className="text-emerald-500 mb-4" size={32} />
                        <h3 className="font-bold text-lg text-slate-800 mb-2">{t('import_backup')}</h3>
                        <p className="text-slate-600 mb-6 text-sm">
                            {t('import_help_text')}<br />
                            <span className="text-emerald-600 font-medium text-xs">✓ Item images restored automatically</span>
                        </p>
                        {importSuccess && (
                            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mb-3 text-sm font-bold">
                                <CheckCircle size={16} /> Data restored successfully!
                            </div>
                        )}
                        <button
                            onClick={handleImportBackup}
                            disabled={clearing}
                            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {clearing ? (
                                <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span> {t('clearing')}</>
                            ) : (
                                <><Upload size={18} /> {t('import_backup')}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-red-50 p-6 md:p-8 rounded-2xl border border-red-200">
                <h2 className="text-2xl font-bold mb-4 text-red-700 flex items-center gap-3">
                    <Database className="text-red-500" />
                    {t('danger_zone')}
                </h2>
                <p className="text-red-600 mb-6 font-medium">{t('danger_warning')}</p>

                <button
                    onClick={handleClearDatabase}
                    disabled={clearing}
                    className="flex items-center gap-2 px-8 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition w-full md:w-auto"
                >
                    <Trash2 />
                    {clearing ? t('clearing') : t('clear_sales_data')}
                </button>
            </div>
        </div>
    );
}
