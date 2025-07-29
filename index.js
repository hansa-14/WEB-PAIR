const express = require("express");
const app = express();
const __path = process.cwd();
const PORT = process.env.PORT || 8000;

let code = require("./pair");
require("events").EventEmitter.defaultMaxListeners = 500;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/code", code);

// Fallback route (serve HTML)
app.use("/", async (req, res) => {
  res.sendFile(__path + "/pair.html");
});

// Start server
app.listen(PORT, () => {
  console.log(`⏩ Server running on http://localhost:` + PORT);
});

module.exports = app;
