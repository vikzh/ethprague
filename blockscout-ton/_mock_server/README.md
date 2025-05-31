# Mock Bridge Service

A realistic mock server for testing the Blockscout Cross-Chain Swap Poller integration.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

The server will start on port 3001 and display all available endpoints.

## 📡 API Endpoints

### Core Bridge API
- `GET /api/v1/swaps/recent` - Get recent cross-chain swaps
- `GET /api/v1/swaps/:hash/status` - Get swap status by transaction hash  
- `POST /api/v1/swaps/batch-status` - Get status for multiple swaps

### Utility Endpoints
- `GET /health` - Health check and server stats
- `GET /debug/swaps` - View all swaps (debug)
- `POST /admin/reset` - Reset all data to initial state

## 🧪 Testing Examples

### Get Recent Swaps
```bash
curl "http://localhost:3001/api/v1/swaps/recent?limit=5"
```

### Get Swap Status
```bash
curl "http://localhost:3001/api/v1/swaps/0x1a2b3c.../status"
```

### Batch Status Update
```bash
curl -X POST "http://localhost:3001/api/v1/swaps/batch-status" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_hashes": [
      "0x1a2b3c...",
      "0x5678ef..."
    ]
  }'
```

### Health Check
```bash
curl "http://localhost:3001/health"
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3001)

### Blockscout Integration
Configure Blockscout to use this mock service:

```bash
export CROSS_CHAIN_API_BASE_URL="http://localhost:3001"
export CROSS_CHAIN_POLLER_ENABLED="true"
export CROSS_CHAIN_POLL_INTERVAL="5000"
```

## 🎯 Features

### Realistic Data Generation
- Valid transaction hashes (64 hex characters)
- Valid Ethereum addresses (40 hex characters)
- Realistic amounts and token symbols
- Bridge metadata (fees, priorities, bridge types)

### Dynamic Behavior
- **10% chance** of generating new swaps on each `/recent` call
- **5% chance** pending swaps become settled on status check
- **3% chance** pending swaps fail on status check
- **92% chance** pending swaps remain pending (with updated timestamps)

### Error Simulation
- Proper 404 responses for missing transactions
- Rate limiting simulation
- Validation errors for malformed requests

## 📊 Mock Data Structure

### Sample Swap Object
```json
{
  "transaction_hash": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "source_chain": "TON",
  "destination_chain": "Ethereum",
  "status": "pending",
  "amount": "1500.75",
  "token_symbol": "USDT",
  "user_address": "0x742d35Cc6584C0532A3F9d1bEf15C9f7B3F0C8a2",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "settlement_tx_hash": null,
  "metadata": {
    "bridge_type": "lock_and_mint",
    "priority": "high",
    "fee_amount": "5.25",
    "nonce": 12345
  }
}
```

### Supported Chains
- Source: TON (all swaps originate from TON)
- Destinations: Ethereum, Polygon, BSC, Arbitrum, Optimism

### Supported Tokens
- USDT, USDC, TON, ETH, BTC

### Bridge Types
- `lock_and_mint`
- `atomic_swap`
- `burn_and_mint`

## 🔄 Status Progression

Swaps progress through these states:

1. **pending** → Initial state, waiting for settlement
2. **settled** → Successfully completed with settlement transaction
3. **failed** → Failed with error message and retry information

## 🛠 Development

### Project Structure
```
_mock_server/
├── package.json          # Dependencies and scripts
├── server.js             # Main server implementation
└── README.md            # This file
```

### Adding Custom Logic
The server uses simple JavaScript objects and arrays for data storage. You can easily modify:

- Status progression percentages
- New swap generation rates
- Error simulation scenarios
- Additional metadata fields

### Debugging
- Use `GET /debug/swaps` to view all current swaps
- Use `POST /admin/reset` to reset data to initial state
- Server logs all requests and responses to console

## 🔗 Integration with Blockscout

This mock server implements the exact API format expected by the Blockscout CrossChainSwapPoller. To integrate:

1. Start this mock server (`npm start`)
2. Configure Blockscout environment variables (see above)
3. Start Blockscout with the poller enabled
4. Watch the logs to see the poller making HTTP requests every 5 seconds

The mock server will:
- Occasionally return new swaps (simulating bridge detection)
- Update pending swap statuses (simulating settlement/failure)
- Provide realistic timing and metadata

## 📈 Monitoring

Watch the server console output to see:
- Incoming requests from Blockscout
- Generated new swaps
- Status changes for existing swaps
- Error scenarios and edge cases

Perfect for testing the complete cross-chain swap integration pipeline! 