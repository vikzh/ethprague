import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ordersPath = path.join(__dirname, '../data/orders.json');

export const readOrders = async () => {
  try {
    const data = await fs.readFile(ordersPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const writeOrders = async (orders) => {
  await fs.writeFile(ordersPath, JSON.stringify(orders, null, 2));
};
