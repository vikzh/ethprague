import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Setup __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Init express
const app = express();
const port = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use routes
import ordersRoutes from './routes/orders.js';
import tonRoutes from './routes/ton.js';
import ethRoutes from './routes/eth.js';

app.use('/', ordersRoutes);
app.use('/', tonRoutes);
app.use('/', ethRoutes);

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'Server is running', uptime: process.uptime() });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
