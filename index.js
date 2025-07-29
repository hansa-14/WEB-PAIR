const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");

const PORT = process.env.PORT || 8000;

// Set max listeners to avoid warning spam
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware first
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Route handlers
const qrRoute = require('./qr');
const codeRoute = require('./pair');
app.use('/qr', qrRoute);
app.use('/code', codeRoute);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('✅ Pair server alive');
});

// Serve homepage
app.use('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

module.exports = app;
