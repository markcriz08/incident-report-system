const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const incidentRoutes = require('./routes/incidents');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/incidents', incidentRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Famy MDRRMO IR System server running at http://localhost:${PORT}`);
});