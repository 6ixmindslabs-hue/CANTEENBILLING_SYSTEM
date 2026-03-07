import { create } from 'zustand';
import type { Item } from '../types';

export interface CartItem extends Item {
    cartItemId: string;
    quantity: number;
}

interface PosState {
    cart: CartItem[];
    addToCart: (item: Item) => void;
    removeFromCart: (cartItemId: string) => void;
    increaseQuantity: (cartItemId: string) => void;
    decreaseQuantity: (cartItemId: string) => void;
    clearCart: () => void;
    total: () => number;
    selectedCategory: string | null;
    setSelectedCategory: (categoryId: string | null) => void;
}

export const useStore = create<PosState>((set, get) => ({
    cart: [],
    selectedCategory: null,
    setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),

    addToCart: (item) => {
        set((state) => {
            const existing = state.cart.find((c) => c.id === item.id);
            if (existing) {
                return {
                    cart: state.cart.map((c) =>
                        c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
                    ),
                };
            }
            return { cart: [...state.cart, { ...item, cartItemId: crypto.randomUUID(), quantity: 1 }] };
        });
    },

    removeFromCart: (cartItemId) => {
        set((state) => ({ cart: state.cart.filter((c) => c.cartItemId !== cartItemId) }));
    },

    increaseQuantity: (cartItemId) => {
        set((state) => ({
            cart: state.cart.map((c) =>
                c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + 1 } : c
            ),
        }));
    },

    decreaseQuantity: (cartItemId) => {
        set((state) => ({
            cart: state.cart.map((c) =>
                c.cartItemId === cartItemId ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c
            ),
        }));
    },

    clearCart: () => set({ cart: [] }),

    total: () => {
        return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
}));
