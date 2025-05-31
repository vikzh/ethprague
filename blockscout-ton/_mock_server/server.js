const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple in-memory storage
let swaps = [];
let swapId = 1;

// Helper functions
function generateHash() {
  return '0x' + Array.from({length: 64}, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function generateAddress() {
  return '0x' + Array.from({length: 40}, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// Initialize some test data
function initializeTestData() {
  const chains = ['Ethereum', 'Polygon', 'BSC'];
  const tokens = ['USDT', 'USDC', 'TON'];
  
  for (let i = 0; i < 3; i++) {
    swaps.push({
      id: swapId++,
      transaction_hash: generateHash(),
      source_chain: 'TON',
      destination_chain: chains[Math.floor(Math.random() * chains.length)],
      status: 'pending',
      amount: (Math.random() * 100 + 10).toFixed(2),
      token_symbol: tokens[Math.floor(Math.random() * tokens.length)],
      user_address: generateAddress(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        bridge_type: 'lock_and_mint',
        priority: 'medium'
      }
    });
  }
}

// 1. Get recent swaps endpoint
app.get('/api/v1/swaps/recent', (req, res) => {
  const { limit = 10 } = req.query;
  
  // 20% chance to create a new swap for demo
  if (Math.random() < 0.2) {
    const newSwap = {
      id: swapId++,
      transaction_hash: generateHash(),
      source_chain: 'TON',
      destination_chain: ['Ethereum', 'Polygon'][Math.floor(Math.random() * 2)],
      status: 'pending',
      amount: (Math.random() * 100 + 10).toFixed(2),
      token_symbol: ['USDT', 'USDC'][Math.floor(Math.random() * 2)],
      user_address: generateAddress(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        bridge_type: 'lock_and_mint',
        priority: 'medium',
        created_by_demo: true
      }
    };
    swaps.push(newSwap);
    console.log(`✨ Created demo swap: ${newSwap.transaction_hash}`);
  }
  
  // Sort by creation date and apply limit
  const recentSwaps = swaps
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, parseInt(limit));
  
  console.log(`📥 Recent swaps request - returning ${recentSwaps.length} swaps`);
  
  res.json({
    success: true,
    data: {
      swaps: recentSwaps
    }
  });
});

// 2. Get swap status endpoint
app.get('/api/v1/swaps/:hash/status', (req, res) => {
  const { hash } = req.params;
  const swap = swaps.find(s => s.transaction_hash === hash);
  
  if (!swap) {
    console.log(`❌ Swap not found: ${hash}`);
    return res.status(404).json({
      success: false,
      error: 'Swap not found'
    });
  }
  
  // Demo status transitions: 15% chance to settle, 5% chance to fail
  if (swap.status === 'pending') {
    const random = Math.random();
    if (random < 0.15) {
      swap.status = 'settled';
      swap.settlement_tx_hash = generateHash();
      swap.updated_at = new Date().toISOString();
      console.log(`✅ Demo: Swap settled - ${hash}`);
    } else if (random < 0.20) {
      swap.status = 'failed';
      swap.updated_at = new Date().toISOString();
      console.log(`❌ Demo: Swap failed - ${hash}`);
    }
  }
  
  // Build response data
  const responseData = {
    transaction_hash: swap.transaction_hash,
    status: swap.status,
    updated_at: swap.updated_at
  };
  
  if (swap.settlement_tx_hash) {
    responseData.settlement_tx_hash = swap.settlement_tx_hash;
  }
  
  if (swap.status === 'failed') {
    responseData.error_message = 'Demo failure for testing';
  }
  
  console.log(`📊 Status check: ${hash} → ${swap.status}`);
  
  res.json({
    success: true,
    data: responseData
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    swaps_count: swaps.length,
    uptime: process.uptime()
  });
});

// Debug endpoint
app.get('/debug/swaps', (req, res) => {
  res.json({
    total_swaps: swaps.length,
    swaps: swaps.map(s => ({
      transaction_hash: s.transaction_hash,
      status: s.status,
      amount: s.amount,
      token_symbol: s.token_symbol,
      destination_chain: s.destination_chain
    }))
  });
});

// Reset data endpoint
app.post('/admin/reset', (req, res) => {
  swaps = [];
  swapId = 1;
  initializeTestData();
  res.json({
    success: true,
    message: 'Data reset',
    swaps_count: swaps.length
  });
});

// Initialize and start
initializeTestData();

app.listen(PORT, () => {
  console.log('\n🌉 Simplified Bridge Mock Server');
  console.log('==================================');
  console.log(`🚀 Running on port ${PORT}`);
  console.log(`📊 Started with ${swaps.length} demo swaps`);
  console.log('\n🔗 Endpoints:');
  console.log(`  GET  /api/v1/swaps/recent`);
  console.log(`  GET  /api/v1/swaps/:hash/status`);
  console.log(`  GET  /health`);
  console.log(`  GET  /debug/swaps`);
  console.log(`  POST /admin/reset`);
  console.log('\n💡 Demo Features:');
  console.log('  • 20% chance new swap on /recent call');
  console.log('  • 15% chance pending → settled');
  console.log('  • 5% chance pending → failed');
  console.log('  • Clean, simple responses');
  console.log('\n🔧 Use with Blockscout:');
  console.log(`  export CROSS_CHAIN_API_BASE_URL="http://localhost:${PORT}"`);
  console.log('  export CROSS_CHAIN_POLLER_ENABLED="true"');
  console.log('  export CROSS_CHAIN_POLL_INTERVAL="10000"');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
}); 