const express = require('express');
const router = express.Router();

// Get all reports from Supabase
router.get('/', async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Missing Supabase configuration." });
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/incidents?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('Supabase fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save a new report to Supabase
router.post('/', async (req, res) => {
  try {
    const report = req.body;
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
      return res.status(500).json({ success: false, error: "Server configuration error: Missing Supabase credentials." });
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
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
      })
    });

    const textRes = await response.text();
    let result;
    try {
      result = JSON.parse(textRes);
    } catch (e) {
      result = textRes;
    }

    if (!response.ok) {
      console.error('Supabase error response:', result);
      return res.status(500).json({ success: false, error: result });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('Unexpected server error during incident save:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;