import express from 'express';
import { calculateAddress, getExtraDataAboutOrder } from '../services/tonService.js';
import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';

const router = express.Router();

router.get('/ton-balance', async (req, res) => {
  const { address } = req.query;
  try {
    const client = new TonClient({ endpoint: "https://toncenter.com/api/v2/jsonRPC" });
    const result = await client.runMethod(Address.parse(address), "get_total");
    res.json({ total: result.stack.readNumber() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ton-escrow-address', async (req, res) => {
  const { address, orderId } = req.query;
  try {
    const calculatedAddress = await calculateAddress(address, orderId);
    res.json({ address: calculatedAddress.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ton-escrow', async (req, res) => {
  const { address, orderId } = req.query;
  try {
    const orderDataJson = await getExtraDataAboutOrder(address, orderId);
    res.json(orderDataJson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
