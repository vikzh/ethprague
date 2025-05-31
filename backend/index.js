import express from 'express';

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// GET endpoint /status
app.get('/status', (req, res) => {
  res.json({ status: 'Server is running', uptime: process.uptime() });
});

// POST endpoint: /echo
app.post('/echo', (req, res) => {
  const data = req.body;
  res.json({ received: data });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
