const express = require('express');
const router = express.Router();
const supabase = require('../config/db');

// Get all reports
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a new report
router.post('/', async (req, res) => {
  try {
    const report = req.body;
    const { data, error } = await supabase.from('incidents').insert([
      {
        id: report.id || Date.now(),
        ir_number: report.irNumber,
        date_time: report.dateTime,
        nature: report.nature,
        place: report.place,
        landmark: report.landmark,
        severity: report.severity,
        gis_coordinates: report.gisCoordinates,
        patients: report.patients,
        photos: report.photos,
        responders: report.responders,
        command_personnel: report.commandPersonnel
      }
    ]);

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;