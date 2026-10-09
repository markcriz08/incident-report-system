const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const incidentData = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing in environment variables');
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
        ir_number: incidentData.irNumber,
        date_time: incidentData.dateTime,
        nature: incidentData.nature,
        place: incidentData.place,
        landmark: incidentData.landmark,
        severity: incidentData.severity,
        gis_coordinates: incidentData.gisCoordinates,
        patients: incidentData.patients,
        photos: incidentData.photos,
        responders: incidentData.responders,
        command_personnel: incidentData.commandPersonnel
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Supabase REST error:', result);
      return res.status(400).json({ success: false, error: result });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('Server error saving incident:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
