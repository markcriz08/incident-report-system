const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const incidentData = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

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
