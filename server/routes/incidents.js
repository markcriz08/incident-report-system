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

// Get master data from Neon PostgreSQL
router.get('/master-data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_master_data');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching master data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save/Sync master data to Neon PostgreSQL
router.post('/master-data', async (req, res) => {
  try {
    const { category, itemValue } = req.body;
    const query = `
      INSERT INTO system_master_data (category, item_value) 
      VALUES ($1, $2) RETURNING *;
    `;
    const result = await pool.query(query, [category, itemValue]);
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving master data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete master data item
router.delete('/master-data/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM system_master_data WHERE id = $1', [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting master data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete an incident report from Neon PostgreSQL
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM incidents WHERE id = $1', [id]);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting incident:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;