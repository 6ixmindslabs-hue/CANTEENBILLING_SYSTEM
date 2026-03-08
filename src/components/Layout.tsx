import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Tags, Settings, LogIn, LogOut, Menu, X, Languages } from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
    isAdmin: boolean;
    setIsAdmin: (val: boolean) => void;
}

export default function Layout({ children, isAdmin, setIsAdmin }: LayoutProps) {
    const { t, i18n } = useTranslation();

    // Dynamic PIN loading
    const getAdminPin = () => {
        return localStorage.getItem('adminPin') || '1234';
    };
    const [pinInput, setPinInput] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'en' ? 'ta' : 'en';
        i18n.changeLanguage(newLang);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const correctPin = getAdminPin();
        if (pinInput === correctPin) {
            setIsAdmin(true);
            setShowPinModal(false);
            setPinInput('');
            if (location.pathname === '/') {
                navigate('/dashboard');
            }
        } else {
            alert(t('invalid_pin'));
        }
    };

    const links = [
        ...(!isAdmin ? [{ to: '/', name: t('billing'), icon: ShoppingCart }] : []),
        ...(isAdmin ? [
            { to: '/dashboard', name: t('dashboard'), icon: LayoutDashboard },
            { to: '/categories', name: t('categories'), icon: Tags },
            { to: '/items', name: t('items'), icon: Package },
            { to: '/settings', name: t('settings'), icon: Settings }
        ] : [])
    ];

    return (
        <div className="flex h-screen h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={clsx(
                "sidebar-left bg-white shadow-xl transform transition-transform duration-300 ease-in-out sm:transform-none flex flex-col z-50",
                sidebarOpen ? "translate-x-0 fixed inset-y-0 left-0 w-[250px]" : "-translate-x-full fixed sm:translate-x-0 inset-y-0 left-0 w-[250px]"
            )}>
                <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{t('canteen_pos')}</h1>
                    <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(false)}>
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {links.map((link) => {
                        const Icon = link.icon;
                        return (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) => clsx(
                                    "flex items-center space-x-3 px-3 py-2 rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-blue-50 text-blue-700 shadow-sm"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={18} className={isActive ? "text-blue-600" : "text-slate-400"} />
                                        <span className="font-semibold text-base">{link.name}</span>
                                    </>
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                <div className="p-3 border-t border-slate-200 flex flex-col space-y-2">
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center justify-center space-x-2 w-full py-2 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-700 font-bold transition-colors text-sm"
                    >
                        <Languages size={18} />
                        <span>{i18n.language === 'en' ? 'தமிழ்' : 'English'}</span>
                    </button>

                    {!isAdmin ? (
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="flex items-center justify-center space-x-2 w-full py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 font-bold transition-colors text-sm"
                        >
                            <LogIn size={18} />
                            <span>{t('admin_login')}</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setIsAdmin(false);
                                navigate('/');
                            }}
                            className="flex items-center justify-center space-x-2 w-full py-2 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-bold transition-colors text-sm"
                        >
                            <LogOut size={18} />
                            <span>{t('logout')}</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className={clsx("flex flex-col flex-1 bg-slate-50 main-content", location.pathname === '/' ? 'has-right-sidebar' : '')}>
                <header className="sm:hidden bg-white shadow-sm p-4 flex items-center justify-between z-10 shrink-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
                        <Menu size={24} />
                    </button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">{t('canteen_pos')}</h1>
                    <button onClick={toggleLanguage} className="p-2 -mr-2 text-slate-600">
                        <Languages size={24} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-4 lg:p-6 bg-slate-100">
                    {children}
                </div>
            </main>

            {/* Admin Login Modal */}
            {showPinModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-center mb-6 text-slate-800">{t('admin_pin')}</h2>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                type="password"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                placeholder="--- PIN: 1234 ---"
                                className="w-full text-center text-3xl tracking-[1em] p-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring focus:ring-blue-200 outline-none transition-all"
                                autoFocus
                            />
                            <div className="flex space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPinModal(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                                >
                                    {t('submit')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
