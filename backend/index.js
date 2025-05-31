import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs/promises';

import { TonClient } from "@ton/ton";
import { Address } from "@ton/core";

dotenv.config();

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
    throw new Error('RPC_URL environment variable is required');
}
const provider = new ethers.JsonRpcProvider(RPC_URL);

// USDT contract address and minimal ABI
const USDT_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDT_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, provider);

// Setup __dirname (ES Module workaround)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express
const app = express();
const port = 3000;
app.use(express.json());

// Open SQLite database
const dbPromise = open({
  filename: path.join(__dirname, 'messages.db'),
  driver: sqlite3.Database
});

// Initialize DB table
const initDb = async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL
    )
  `);
};

// Middleware to parse JSON bodies
app.use(express.json());

// GET endpoint /status
app.get('/status', (req, res) => {
  res.json({ status: 'Server is running', uptime: process.uptime() });
});

// POST /echo - stores message in DB
app.post('/echo', async (req, res) => {
  const { key } = req.body;
  console.log(key);

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid content field' });
  }

  const db = await dbPromise;
  await db.run('INSERT INTO messages (content) VALUES (?)', key);
  res.json({ message: 'Stored successfully' });
});

// GET /messages - retrieve all stored strings
app.get('/messages', async (req, res) => {
  const db = await dbPromise;
  const rows = await db.all('SELECT * FROM messages');
  res.json(rows);
});

// GET /messages-page - serve HTML page with messages
app.get('/', async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM messages');
    
    // Create HTML content
    const messagesHtml = rows.map(msg => `
      <div class="message">
        <div class="message-title">${msg.title}</div>
        <div class="message-content">${msg.content}</div>
        <div class="message-timestamp">${new Date(msg.timestamp).toLocaleString()}</div>
      </div>
    `).join('');

    // Read the template file
    const template = await fs.readFile(path.join(__dirname, 'templates', 'messages.html'), 'utf-8');
    
    // Replace the placeholder with actual messages
    const renderedHtml = template.replace('<!-- Messages will be inserted here -->', messagesHtml);
    
    res.send(renderedHtml);
  } catch (error) {
    console.error('Error rendering messages:', error);
    res.status(500).send('Error fetching messages');
  }
});

app.get('/weth-balance', async (req, res) => {
  const { address } = req.query;

  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid or missing Ethereum address' });
  }

  try {
    const [rawBalance, decimals] = await Promise.all([
      usdtContract.balanceOf(address),
      usdtContract.decimals()
    ]);

    const formatted = ethers.formatUnits(rawBalance, decimals);

    res.json({
      address,
      balance: formatted,
      symbol: 'WETH'
    });
  } catch (err) {
    console.error('Error fetching USDT balance:', err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});




//------------------------
//TON endpoints
//------------------------

app.get('/ton-balance', async (req, res) => {
  const { address } = req.query;

  const client = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
  });

  // Call get method
  const result = await client.runMethod(
    Address.parse(address),
    "get_total"
  );
  const total = result.stack.readNumber();
  console.log("Total:", total);
  res.json({total})
});

app.get('/ton-escrow', async (req, res) => {
  const { address } = req.query;

  const client = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
  });

  // Call get method
  const result = await client.runMethod(
    Address.parse(address),
    "get_escrow_data"
  );

  const orderId = result.stack.readNumber();
  const fromAddress = result.stack.readAddress();
  const fromAmount = result.stack.readNumber();

  console.log("test:", orderId, fromAddress, fromAmount);
  res.json({total})
});




//-------------------------------
//
// Server Start after DB is ready
//
//-------------------------------
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
});