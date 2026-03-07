import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trash2, Plus, Edit, Image as ImageIcon } from 'lucide-react';

export default function ItemsManagement() {
    const { t } = useTranslation();
    const items = useLiveQuery(() => db.items.toArray()) || [];
    const categories = useLiveQuery(() => db.categories.toArray()) || [];

    const [name, setName] = useState('');
    const [nameTa, setNameTa] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [categoryId, setCategoryId] = useState('');
    const [image, setImage] = useState<string>('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !price || !categoryId) return;

        if (editingId) {
            await db.items.update(editingId, { name, nameTa, price: Number(price), categoryId, image });
            setEditingId(null);
        } else {
            await db.items.add({
                id: crypto.randomUUID(),
                name,
                nameTa,
                price: Number(price),
                categoryId,
                image
            });
        }

        // Reset Form
        setName('');
        setNameTa('');
        setPrice('');
        setCategoryId('');
        setImage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setName(item.name);
        setNameTa(item.nameTa || '');
        setPrice(item.price);
        setCategoryId(item.categoryId);
        setImage(item.image);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            await db.items.delete(id);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-3">
                    <Plus className="text-blue-600" />
                    {editingId ? t('edit') : t('add_item')}
                </h2>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="font-bold text-slate-600 ml-1">{t('item_name')} (English)</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-shadow"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="font-bold text-slate-600 ml-1">{t('item_name_ta')} (Tamil)</label>
                        <input
                            type="text"
                            value={nameTa}
                            onChange={(e) => setNameTa(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-shadow"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="font-bold text-slate-600 ml-1">{t('price')} (₹)</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-shadow"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="font-bold text-slate-600 ml-1">{t('category')}</label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full p-4 border border-slate-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition-shadow"
                            required
                        >
                            <option value="" disabled>Select a Category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2 lg:col-span-2">
                        <label className="font-bold text-slate-600 ml-1">{t('image')}</label>
                        <div className="flex items-center gap-4">
                            <label className="flex-1 cursor-pointer w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-colors group flex items-center justify-center gap-3">
                                <ImageIcon className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                <span className="font-medium text-slate-500 group-hover:text-blue-600">Choose Image File</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    ref={fileInputRef}
                                    className="hidden"
                                />
                            </label>
                            {image && (
                                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-end gap-3 pt-2 lg:col-span-1">
                        <button
                            type="submit"
                            className="flex-1 p-4 bg-blue-600 text-white font-bold text-lg rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            {editingId ? t('save') : t('add')}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingId(null);
                                    setName('');
                                    setNameTa('');
                                    setPrice('');
                                    setCategoryId('');
                                    setImage('');
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="p-4 bg-slate-100 text-slate-600 font-bold text-lg rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                {t('cancel')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">{t('items')}</h2>
                    <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-sm font-bold">Total: {items.length}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y md:divide-y-0 md:gap-4 p-4 bg-slate-50/50">
                    {items.length === 0 ? (
                        <div className="col-span-full p-12 text-center text-slate-400 font-medium">
                            {t('no_items')}
                        </div>
                    ) : (
                        items.map(item => (
                            <div key={item.id} className="flex gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                                <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                                    {item.image ? (
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <ImageIcon size={32} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 py-1">
                                    <h3 className="font-bold text-lg text-slate-800 truncate mb-1">
                                        {item.name} {item.nameTa && <span className="text-slate-400 text-sm font-normal">({item.nameTa})</span>}
                                    </h3>
                                    <p className="text-blue-600 font-black text-lg">₹{item.price}</p>
                                </div>

                                <div className="flex flex-col gap-2 justify-center">
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="p-2.5 bg-slate-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-slate-100"
                                    >
                                        <Edit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2.5 bg-slate-50 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-slate-100"
                                    >
                                        <Trash2 size={18} />
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
