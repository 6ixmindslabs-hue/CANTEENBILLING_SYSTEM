import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trash2, Plus, Edit } from 'lucide-react';

export default function CategoriesManagement() {
    const { t } = useTranslation();
    const categories = useLiveQuery(() => db.categories.toArray()) || [];

    const [name, setName] = useState('');
    const [nameTa, setNameTa] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        if (editingId) {
            await db.categories.update(editingId, { name, nameTa });
            setEditingId(null);
        } else {
            await db.categories.add({
                id: crypto.randomUUID(),
                name,
                nameTa
            });
        }
        setName('');
        setNameTa('');
    };

    const handleEdit = (cat: any) => {
        setEditingId(cat.id);
        setName(cat.name);
        setNameTa(cat.nameTa || '');
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this category?')) {
            await db.categories.delete(id);
            // Optional: Update items to remove categoryId
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">{editingId ? t('edit') : t('add_category')}</h2>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
                        <label className="font-bold text-slate-600 block">{t('category_name')} (English)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('category_name')}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                            required
                        />
                    </div>
                    <div className="flex-1 space-y-2">
                        <label className="font-bold text-slate-600 block">{t('category_name_ta')} (Tamil)</label>
                        <input
                            type="text"
                            value={nameTa}
                            onChange={(e) => setNameTa(e.target.value)}
                            placeholder={t('category_name_ta')}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="h-[60px] px-8 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            {editingId ? <Edit size={20} /> : <Plus size={20} />}
                            {t('save')}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                onClick={() => { setEditingId(null); setName(''); setNameTa(''); }}
                                className="h-[60px] px-8 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
                            >
                                {t('cancel')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">{t('categories')}</h2>
                </div>

                <div className="divide-y divide-slate-100">
                    {categories.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 font-medium">
                            {t('no_categories')}
                        </div>
                    ) : (
                        categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                                <span className="font-bold text-lg text-slate-700">
                                    {cat.name} {cat.nameTa && <span className="text-slate-400 text-sm ml-2">({cat.nameTa})</span>}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(cat)}
                                        className="p-3 text-blue-600 hover:bg-blue-100 rounded-xl transition"
                                    >
                                        <Edit size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
