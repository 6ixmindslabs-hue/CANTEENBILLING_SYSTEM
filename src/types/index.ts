export interface Category {
    id: string;
    name: string;
    nameTa?: string;
}

export interface Item {
    id: string;
    name: string;
    nameTa?: string;
    price: number;
    categoryId: string;
    image: string; // Base64 or local URL
}

export interface OrderItem {
    id: string;
    orderId: string;
    itemId: string;
    name: string;
    nameTa?: string;
    quantity: number;
    price: number;
}

export interface Order {
    id: string;
    date: number; // timestamp
    totalAmount: number;
}

export interface AppSettings {
    id: string;
    language: 'en' | 'ta';
    printerName: string;
}
