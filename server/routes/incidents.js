const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Get all reports from Neon PostgreSQL
router.get('/', async (req, res) => {
  try {
    const query = 'SELECT * FROM incidents ORDER BY created_at DESC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Database fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save a new report to Neon PostgreSQL
router.post('/', async (req, res) => {
  try {
    const report = req.body;
    const query = `
      INSERT INTO incidents (
        ir_number, date_time, nature, place, landmark, severity, 
        gis_coordinates, patients, photos, responders, command_personnel
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      report.irNumber,
      report.dateTime,
      report.nature,
      report.place,
      report.landmark,
      report.severity,
      report.gisCoordinates,
      JSON.stringify(report.patients),
      JSON.stringify(report.photos),
      JSON.stringify(report.responders),
      JSON.stringify(report.commandPersonnel)
    ];

    const result = await pool.query(query, values);
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Database insert error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;