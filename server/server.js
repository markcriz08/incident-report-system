const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const incidentRoutes = require('./routes/incidents');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your Netlify frontend and local development
app.use(cors({
  origin: [
    'https://incident-report-system.netlify.app',
    'http://localhost:3000',
    'http://localhost:5000'
  ],
  credentials: true
}));

// Increase body parser payload size limit to handle photos and 3D model snapshots
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/incidents', incidentRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Famy MDRRMO IR System server running at http://localhost:${PORT}`);
});