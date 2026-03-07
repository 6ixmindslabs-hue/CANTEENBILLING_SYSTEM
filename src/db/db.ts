import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Category, Item, Order, OrderItem, AppSettings } from '../types';

export class CanteenDB extends Dexie {
    categories!: Table<Category, string>;
    items!: Table<Item, string>;
    orders!: Table<Order, string>;
    orderItems!: Table<OrderItem, string>;
    settings!: Table<AppSettings, string>;

    constructor() {
        super('CanteenDB');
        this.version(1).stores({
            categories: 'id, name',
            items: 'id, name, categoryId',
            orders: 'id, date',
            orderItems: 'id, orderId, itemId',
            settings: 'id'
        });
    }
}

export const db = new CanteenDB();
