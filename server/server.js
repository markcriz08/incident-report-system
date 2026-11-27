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

// Serve Module 1 dashboard as the default web entry point.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const isDesktopControl = process.env.PC_DESKTOP === 'true';

// The hosted HTML application is read-only. Incident and master-data writes
// are accepted only by the Electron PC control application.
function desktopWriteOnly(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (isDesktopControl) return next();
  return res.status(403).json({
    error: 'Read-only viewer: use the Famy Incident PC application to modify records.'
  });
}

app.use('/api/incidents', desktopWriteOnly);
app.use('/api/incidents', incidentRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: isDesktopControl ? 'desktop-control' : 'web-viewer' });
});

app.listen(PORT, () => {
  console.log(`🚀 Famy MDRRMO IR System server running at http://localhost:${PORT}`);
});