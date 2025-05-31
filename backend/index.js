import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs/promises';

import { TonClient } from "@ton/ton";
import { Address, beginCell } from "@ton/core";

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
const port = 8080;
app.use(express.json());

// Helper function to read messages from JSON file
const readOrders = async () => {
  try {
    const data = await fs.readFile(path.join(__dirname, 'data/orders.json'), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading orders:', error);
    return [];
  }
};

// Helper function to write messages to JSON file
const writeOrders = async (messages) => {
  try {
    await fs.writeFile(path.join(__dirname, 'data/orders.json'), JSON.stringify(messages, null, 2));
  } catch (error) {
    console.error('Error writing orders:', error);
    throw error;
  }
};


// Middleware to parse JSON bodies
app.use(express.json());

// GET endpoint /status
app.get('/status', (req, res) => {
  res.json({ status: 'Server is running', uptime: process.uptime() });
});

// POST /echo - stores message in JSON file
app.post('/add-order', async (req, res) => {
  const { orderId, userAddress } = req.body;

  if (!orderId || !userAddress) {
    return res.status(400).json({ error: 'Missing or invalid content field' });
  }

  try {
    const orders = await readOrders();
    const newOrder = {
      orderId,
      userAddress,
      timestamp: new Date().toISOString()
    };
    orders.push(newOrder);
    await writeOrders(orders);
    res.json({ message: 'Stored successfully' });
  } catch (error) {
    console.error('Error storing message:', error);
    res.status(500).json({ error: 'Failed to store message' });
  }
});

// DELETE /delete-message - delete message by ID
app.post('/delete-order', async (req, res) => {
  console.log(req.body);
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  try {
    const orders = await readOrders();
    const updatedOrders = orders.filter(msg => msg.id !== id);
    await writeOrders(updatedOrders);
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET /orders - retrieve all stored strings
app.get('/orders', async (req, res) => {
  try {
    const orders = await readOrders();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /messages-page - serve HTML page with messages
app.get('/', async (req, res) => {
  try {
    const messages = await readMessages();
    
    // Create HTML content
    const messagesHtml = messages.map(msg => `
      <div class="message">
        <div class="message-title">Message #${msg.id}</div>
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

const calculateAddress = async (userAddress, orderId) => {
    console.log(`Calculate address: ${userAddress}, orderId: ${orderId}`);
    const contractAddress = "kQCrB1b7x5xWsm4AqbWbRZyfEuutYnOfunbGUdiogILGOX3s";

    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    });

    // Call get method
    const result = await client.runMethod(
      Address.parseFriendly(contractAddress).address,
      "get_order_address",
      [
        {
          type: 'slice',
          cell: beginCell().storeAddress(Address.parse(userAddress)).endCell(),
        },
        {
          type: 'int',
          value: orderId,
        }
      ]
    );

    const stack = result.stack;
    const fromAddress = stack.readAddress();
    return fromAddress;
    // const orderId = stack.readBigNumber();          // uint64 / uint128
    // const fromAddress = stack.readAddress();        // address
    // const fromAmount = stack.readBigNumber();       // uint64 / uint128
    // const toNetwork = stack.readNumber();           // int or enum
    // const toAddress = stack.readBigNumber(); // cell containing a string
    // const toAmount = stack.readBigNumber();         // uint64 / uint128
    // const hashKey = stack.readBigNumber();         // uint64 / uint128
    // // const resolverAddr = stack.readAddress();       // address
    //
    // res.json({
    //   order_id: orderId.toString(),
    //   from_address: fromAddress.toString(),
    //   from_amount: fromAmount.toString(),
    //   to_network: toNetwork,
    //   to_address: toAddress.toString(),
    //   to_amount: toAmount.toString(),
    //   hash_key: hashKey.toString(),
    //   // resolver_addr: resolverAddr.toString()
    // });
}

app.get('/ton-escrow-address', async (req, res) => {
  const { address, orderId } = req.query;

  try {
    const calculatedAddress = await calculateAddress(address, orderId);
    res.json({"address": calculatedAddress.toString()});

  } catch (err) {
    console.error("Error reading contract:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/ton-escrow', async (req, res) => {
  const { address, orderId } = req.query;

  try {
    const calculatedAddress = await calculateAddress(address, orderId);

  } catch (err) {
    console.error("Error reading contract:", err);
    res.status(500).json({ error: err.message });
  }

  try {
    const contractAddress = calculatedAddress;

    const client = new TonClient({
      endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    });

    // Call get method
    const result = await client.runMethod(
      Address.parseFriendly(contractAddress).address,
      "get_escrow_data"
    );

    const stack = result.stack;

    const orderId = stack.readBigNumber();          // uint64 / uint128
    const fromAddress = stack.readAddress();        // address
    const fromAmount = stack.readBigNumber();       // uint64 / uint128
    const toNetwork = stack.readNumber();           // int or enum
    const toAddress = stack.readBigNumber(); // cell containing a string
    const toAmount = stack.readBigNumber();         // uint64 / uint128
    const hashKey = stack.readBigNumber();         // uint64 / uint128
    // const resolverAddr = stack.readAddress();       // address

    res.json({
      order_id: orderId.toString(),
      from_address: fromAddress.toString(),
      from_amount: fromAmount.toString(),
      to_network: toNetwork,
      to_address: toAddress.toString(),
      to_amount: toAmount.toString(),
      hash_key: hashKey.toString(),
      // resolver_addr: resolverAddr.toString()
    });

  } catch (err) {
    console.error("Error reading contract:", err);
    res.status(500).json({ error: err.message });
  }
});

//-------------------------------
//
// Start the server//
//-------------------------------
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});