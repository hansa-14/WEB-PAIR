const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
require('events').EventEmitter.defaultMaxListeners = 500;

// Apply body parsers BEFORE routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes AFTER parsers
let server = require('./qr');
let code = require('./pair');

app.use('/qr', server);
app.use('/code', code);

app.use('/', async (req, res, next) => {
  res.sendFile(__path + '/index.html');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:` + PORT);
});

module.exports = app;
