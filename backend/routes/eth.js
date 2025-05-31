import express from 'express';
import { getUSDTBalance } from '../services/ethService.js';

const router = express.Router();

router.get('/weth-balance', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Missing Ethereum address' });

  try {
    const balanceInfo = await getUSDTBalance(address);
    res.json(balanceInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
