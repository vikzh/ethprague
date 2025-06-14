const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Static orders data
const staticOrders = [
    {"orderId":1,"userAddress":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","timestamp":"2025-05-31T22:14:56.764Z","order_id":"1","from_address":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","from_amount":"1","to_network":0,"to_address":"138195620740243451877984700135538461098697607409202112742225086110498816","to_amount":"1","hash_key":"627710177966680116931292917747249425385797383767801221094596884259","status":"completed", "extraParams": {"src_escrow": "ton:tx:abc123def456", "dst_escrow": "eth:tx:0x789def012345abc"}},
    // {"orderId":1,"userAddress":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","timestamp":"2025-05-31T22:14:56.764Z","order_id":"1","from_address":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","from_amount":"1","to_network":0,"to_address":"138195620740243451877984700135538461098697607409202112742225086110498816","to_amount":"1","hash_key":"627710177966680116931292917747249425385797383767801221094596884259","status":"created"},
    // {"orderId":1,"userAddress":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","timestamp":"2025-05-31T22:14:56.764Z","order_id":"1","from_address":"EQCEnDKs7s2_OIuTjb642KbRufqkW47GGCuOosP150ZiGKvm","from_amount":"1","to_network":0,"to_address":"138195620740243451877984700135538461098697607409202112742225086110498816","to_amount":"1","hash_key":"627710177966680116931292917747249425385797383767801221094596884259","status":"pending", "extraParams": {"src_escrow": "ton:tx:abc123def456"}},

];

// Orders endpoint
app.get('/orders', (req, res) => {
  console.log('📥 Orders request - returning static list');
  res.json(staticOrders);
});

app.listen(PORT, () => {
  console.log(`🚀 Static Orders Server running on port ${PORT}`);
  console.log(`📊 Serving ${staticOrders.length} ss static orders`);
  console.log(`🔗 Endpoint: GET /orders`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
}); 