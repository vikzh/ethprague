import express from 'express';
import path from 'path';
import { readOrders, writeOrders } from '../services/orderService.js';
import { getExtraDataAboutOrder } from '../services/tonService.js';
const router = express.Router();

router.post('/add-order', async (req, res) => {
  const { orderId, userAddress } = req.body;
  if (!orderId || !userAddress) return res.status(400).json({ error: 'Missing fields' });

  try {
    const orders = await readOrders();
    const orderExtraData = await getExtraDataAboutOrder(userAddress, orderId);
    const newOrder = {
      orderId,
      userAddress,
      timestamp: new Date().toISOString(),
      ...orderExtraData
    };
    orders.push(newOrder);
    await writeOrders(orders);
    res.json({ message: 'Stored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to store order' });
  }
});

router.post('/delete-order', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Invalid order ID' });

  try {
    const orders = await readOrders();
    const updatedOrders = orders.filter(o => o.id !== id);
    await writeOrders(updatedOrders);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;
