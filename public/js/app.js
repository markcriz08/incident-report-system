/* ==========================================================================
   Famy MDRRMO - Full Application Client Logic (Modules 1 to 5)
   ========================================================================== */

// Helper Function: Sanitize strings from GLTF or input
function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[^\x20-\x7E]/g, '') // Strips non-printable/corrupted unicode characters
    .replace(/\s+/g, ' ')
    .trim();
}

function getIncidentColorClass(nature) {
  if (!nature) return 'bg-slate-500';
  const n = nature.toLowerCase();
  if (n.includes('vehicle') || n.includes('collision') || n.includes('road')) return 'bg-rose-600';
  if (n.includes('medical') || n.includes('assistance')) return 'bg-emerald-600';
  if (n.includes('fire')) return 'bg-amber-600';
  if (n.includes('drowning') || n.includes('water') || n.includes('flooding') || n.includes('typhoon')) return 'bg-sky-600';
  return 'bg-indigo-600';
}

// Global System State
let currentModule = 1;
let currentStep = 1;
let currentLayer = 'skin'; // 'skin' or 'skeleton'

let gisCoords = { lat: 14.435439, lng: 121.449593 };
let leafMap = null;
let leafMarker = null;

let allIncidentsMap = null;
let allIncidentsMarkersGroup = null;

// Dynamic Lists State
let patientsList = [];
let activePatientId = null;
let docPhotos = []; // Photos array
let respondersList = [];
let commandList = [];

let pendingPinVector = null;
let pendingPinRegion = '';

// Three.js Core Variables
let scene, camera, renderer, controls, raycaster, mouse;
let skinModelGroup = null;
let skeletonModelGroup = null;
let pinMarkersGroup = new THREE.Group();

// Master Reference Data & System Storage
let savedReports = JSON.parse(localStorage.getItem('aegis_reports') || '[]');
let masterData = JSON.parse(localStorage.getItem('aegis_master_data') || JSON.stringify({
  responders: ['Markee De Vera (Team Leader)', 'BFP Rescue Alpha', 'MDRRMO Medic Unit 1', 'Red Cross Rescue'],
  agencies: ['Famy MDRRMO', 'BFP Famy Station', 'Philippine Red Cross', 'PNP Famy', 'PCG Laguna'],
  operators: ['Engr. Juan Dela Cruz (Duty Commander)', 'Dispatcher Maria Santos'],
  incidentTypes: ['Road / Vehicle Collision', 'Fire Incident', 'Drowning / Water Rescue', 'Landslide / Structure Collapse', 'Severe Flooding / Typhoon', 'Medical Assistance'],
  hospitals: ['Siniloan District Hospital', 'General Cailles Memorial Hospital', 'Laguna Medical Center'],
  settings: { prefix: 'IR-2026-', coords: '14.435439, 121.449593', agency: 'MDRRMO Famy Command Center' }
}));

// Fallback for agencies if loading from older local storage
if (!masterData.agencies) {
  masterData.agencies = ['Famy MDRRMO', 'BFP Famy Station', 'Philippine Red Cross', 'PNP Famy', 'PCG Laguna'];
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) {}
  }

  // Initialize Core Systems
  initGISMap();
  init3DScene();
  populateDropdownsFromMaster();

  // Populate Default Patient Records with Full Vitals & Specific Models
  addPatient(
    'John Jalani Laki Kulani', 
    'Caballero Famy', 
    '43', 
    'Male', 
    '110', 
    '120/80', 
    '96', 
    'Alert (GCS 15)', 
    'Hirap sa paghinga / Wounds', 
    'Oxygen Inhalation (2L/min), Vitals Monitored, Spine Boarding', 
    'Yes', 
    masterData.hospitals[1] || 'General Cailles Memorial Hospital',
    'skin'
  );

  addPatient(
    'Patient #2', 
    'Famy, Laguna', 
    '30', 
    'Male', 
    '88', 
    '110/70', 
    '98', 
    'Alert (GCS 15)', 
    'Trauma / Bone Fracture', 
    'Wound Cleaning, Sterile Dressing, Cold Compress, Splinting', 
    'Yes', 
    masterData.hospitals[0] || 'Siniloan District Hospital',
    'skeleton'
  );

  addResponder(masterData.responders[0], masterData.agencies[0], 'Team Leader');
  addCommandPerson(masterData.operators[0], 'Duty Commander', 'On-Duty');

  // Set default Incident Date/Time
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const dateInput = document.getElementById('inc-time');
  if (dateInput) dateInput.value = now.toISOString().slice(0, 16);

  renderMasterLists();
  renderReportsTable();
});

/* ==========================================================================
   MODULE NAVIGATION & WIZARD STEPS
   ========================================================================== */
async function switchModule(modNumber) {
  currentModule = modNumber;
  [1, 2, 3, 4, 5].forEach(m => {
    const section = document.getElementById(`module-${m}`);
    const navBtn = document.getElementById(`nav-mod-${m}`);
    if (section && navBtn) {
      if (m === modNumber) {
        section.classList.remove('hidden');
        navBtn.className = "px-3 py-2 rounded-lg transition bg-white text-rose-600 shadow-sm flex items-center space-x-1.5 font-bold";
      } else {
        section.classList.add('hidden');
        navBtn.className = "px-3 py-2 rounded-lg transition text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 font-medium";
      }
    }
  });

  if (modNumber === 1 && leafMap) setTimeout(() => leafMap.invalidateSize(), 200);
  
  if (modNumber === 2) {
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        const rows = await res.json();
        savedReports = rows.map(row => ({
          id: row.id,
          irNumber: row.ir_number,
          dateTime: row.date_time,
          nature: row.nature,
          place: row.place,
          landmark: row.landmark,
          severity: row.severity,
          gisCoordinates: row.gis_coordinates,
          patients: row.patients || [],
          photos: row.photos || [],
          responders: row.responders || [],
          commandPersonnel: row.command_personnel || []
        }));
        localStorage.setItem('aegis_reports', JSON.stringify(savedReports));
      }
    } catch (err) {
      console.error('Error fetching live incidents:', err);
    }
    renderReportsTable();
  }

  if (modNumber === 3) initAllIncidentsMap();
  if (modNumber === 4) renderSummaryReportsModule();
  if (modNumber === 5) renderMasterLists();
}

function goToStep(step) {
  currentStep = step;

  for (let i = 1; i <= 6; i++) {
    const btn = document.getElementById(`step-btn-${i}`);
    const content = document.getElementById(`step-content-${i}`);

    if (!btn || !content) continue;

    if (i === step) {
      content.classList.remove('hidden');
      btn.className = "w-full flex items-center space-x-3 p-2.5 rounded-xl text-left transition font-semibold text-sky-600 bg-sky-50 border border-sky-200 shadow-sm";
    } else {
      content.classList.add('hidden');
      btn.className = "w-full flex items-center space-x-3 p-2.5 rounded-xl text-left transition font-medium text-slate-600 hover:bg-slate-50 border border-transparent";
    }
  }

  if (step === 1 && leafMap) setTimeout(() => leafMap.invalidateSize(), 200);
  if (step === 3) {
    updateActivePatientSelectDropdown();
    render3DPinsForActivePatient();
    if (renderer && camera) setTimeout(() => onWindowResize(), 100);
  }
  if (step === 6) buildOverviewReport();
}

/* ==========================================================================
   GIS LEAFLET MAP INTEGRATION (MODULE 1 & MODULE 3)
   ========================================================================== */
function initGISMap() {
  const container = document.getElementById('gis-map');
  if (!container || typeof L === 'undefined') return;

  const googleRoadmap = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google Maps'
  });
  const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
    maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google Maps'
  });
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  });

  leafMap = L.map('gis-map', {
    center: [gisCoords.lat, gisCoords.lng], zoom: 16, layers: [googleRoadmap]
  });

  L.control.layers({ "Google Maps Roadmap": googleRoadmap, "Google Satellite Hybrid": googleHybrid, "OpenStreetMap": osmLayer }).addTo(leafMap);
  leafMarker = L.marker([gisCoords.lat, gisCoords.lng], { draggable: true }).addTo(leafMap);

  function updateCoords(lat, lng) {
    gisCoords = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) };
    const label = document.getElementById('map-coords-label');
    if (label) label.innerText = `GPS Coords: ${gisCoords.lat}, ${gisCoords.lng}`;
  }

  leafMarker.on('dragend', (e) => updateCoords(e.target.getLatLng().lat, e.target.getLatLng().lng));
  leafMap.on('click', (e) => { leafMarker.setLatLng(e.latlng); updateCoords(e.latlng.lat, e.latlng.lng); });
}

/* MODULE 3: MASTER INCIDENT MAP */
function initAllIncidentsMap() {
  const container = document.getElementById('all-incidents-map');
  if (!container || typeof L === 'undefined') return;

  if (!allIncidentsMap) {
    const googleRoadmap = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google Maps'
    });
    const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google Maps'
    });

    allIncidentsMap = L.map('all-incidents-map', {
      center: [gisCoords.lat, gisCoords.lng], zoom: 14, layers: [googleRoadmap]
    });

    L.control.layers({ "Google Roadmap": googleRoadmap, "Google Hybrid": googleHybrid }).addTo(allIncidentsMap);
    allIncidentsMarkersGroup = L.layerGroup().addTo(allIncidentsMap);
  }

  setTimeout(() => allIncidentsMap.invalidateSize(), 200);
  renderAllIncidentsMapMarkers();
}

function renderAllIncidentsMapMarkers() {
  if (!allIncidentsMarkersGroup) return;
  allIncidentsMarkersGroup.clearLayers();

  const totalTag = document.getElementById('map-total-incidents-tag');
  if (totalTag) totalTag.innerText = `Total Incidents: ${savedReports.length}`;

  const latLngs = [];

  savedReports.forEach(r => {
    if (r.gisCoordinates && r.gisCoordinates.lat && r.gisCoordinates.lng) {
      const lat = r.gisCoordinates.lat;
      const lng = r.gisCoordinates.lng;
      latLngs.push([lat, lng]);

      const bgColor = getIncidentColorClass(r.nature);

      const customIcon = L.divIcon({
        className: 'custom-incident-pin',
        html: `<div class="w-6 h-6 rounded-full ${bgColor} text-white flex items-center justify-center shadow-md border-2 border-white text-[10px] font-bold">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.bindTooltip(`
        <div class="text-xs space-y-0.5 p-1 font-sans">
          <strong class="text-rose-600 font-mono font-bold">${r.irNumber}</strong><br/>
          <span class="font-bold text-slate-800">${r.nature}</span><br/>
          <span class="text-[10px] text-slate-500">${new Date(r.dateTime).toLocaleString()}</span>
        </div>
      `, { direction: 'top', offset: [0, -10], opacity: 0.95 });

      marker.bindPopup(`
        <div class="text-xs space-y-1 p-1 font-sans">
          <strong class="text-rose-600 font-mono font-bold">${r.irNumber}</strong>
          <div class="font-bold text-slate-800">${r.nature}</div>
          <div class="text-slate-500">${r.place} (${r.landmark})</div>
          <div class="text-sky-700 font-semibold">${r.patients ? r.patients.length : 0} Patient(s) | Severity: ${r.severity}</div>
          <div class="text-[10px] text-slate-400">${new Date(r.dateTime).toLocaleString()}</div>
        </div>
      `);

      allIncidentsMarkersGroup.addLayer(marker);
    }
  });

  if (latLngs.length > 0) {
    allIncidentsMap.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 16 });
  }
}

/* ==========================================================================
   STEP 2: PATIENT INFORMATION & VITALS ASSESSMENTS LOGIC
   ========================================================================== */
function addPatient(name = '', address = '', age = '', gender = 'Male', hr = '88', bp = '120/80', spo2 = '98', gcs = 'Alert (GCS 15)', injury = '', firstAid = '', hospitalized = 'Yes', hospital = '', activeLayer = 'skin') {
  const pId = Date.now() + Math.floor(Math.random() * 1000);
  patientsList.push({
    id: pId,
    name: name || `Patient #${patientsList.length + 1}`,
    address: address || 'Famy, Laguna',
    age: age || '30',
    gender: gender,
    hr: hr || '88',
    bp: bp || '120/80',
    spo2: spo2 || '98',
    gcs: gcs || 'Alert (GCS 15)',
    injury: injury || 'Trauma / Minor Wounds',
    firstAid: firstAid || 'Sterile Dressing, Cold Compress, Vitals Monitored',
    hospitalized: hospitalized,
    hospital: hospital || (masterData.hospitals[0] || 'Siniloan District Hospital'),
    activeLayer: activeLayer, // 'skin' or 'skeleton'
    injuryPins: []
  });

  if (!activePatientId) activePatientId = pId;
  renderPatientsList();
  updateActivePatientSelectDropdown();
  updateSidebarStats();
}

function removePatient(id) {
  if (patientsList.length <= 1) return alert("At least one patient is required.");
  patientsList = patientsList.filter(p => p.id !== id);
  if (activePatientId === id) activePatientId = patientsList[0].id;
  renderPatientsList();
  updateActivePatientSelectDropdown();
  render3DPinsForActivePatient();
  updateSidebarStats();
}

function getActivePatient() {
  return patientsList.find(p => p.id === activePatientId) || patientsList[0];
}

function setActivePatient(id) {
  activePatientId = parseInt(id);
  const activePatient = getActivePatient();
  if (activePatient) {
    currentLayer = activePatient.activeLayer || 'skin';
  }
  updateLayerButtonsUI();
  updateActivePatientSelectDropdown();
  render3DPinsForActivePatient();
  updateSidebarStats();
}

function updatePatientField(id, field, value) {
  const p = patientsList.find(item => item.id === id);
  if (p) {
    p[field] = value;
    if (field === 'name') updateActivePatientSelectDropdown();
  }
}

function updateActivePatientSelectDropdown() {
  const select = document.getElementById('active-patient-select');
  const tag = document.getElementById('canvas-patient-tag');
  if (!select) return;

  select.innerHTML = patientsList.map((p, idx) => `
    <option value="${p.id}" ${p.id === activePatientId ? 'selected' : ''}>
      Patient #${idx + 1}: ${p.name} (${p.activeLayer ? p.activeLayer.toUpperCase() : 'SKIN'}) - (${p.injuryPins.length} Pins)
    </option>
  `).join('');

  const active = getActivePatient();
  if (tag && active) tag.innerText = `Mapping: ${active.name} [${(active.activeLayer || 'skin').toUpperCase()}] (${active.injuryPins.length} Pins)`;
}

function renderPatientsList() {
  const container = document.getElementById('patients-container');
  if (!container) return;

  container.innerHTML = patientsList.map((p, idx) => `
    <div class="bg-slate-50 border ${p.id === activePatientId ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'} rounded-2xl p-4 shadow-sm space-y-3 text-xs">
      <div class="flex justify-between items-center border-b border-slate-200 pb-2">
        <span class="font-bold text-slate-800">Patient #${idx + 1} Assessment & Details</span>
        <div class="flex space-x-2">
          <button onclick="setActivePatient(${p.id}); goToStep(3);" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg text-xs transition flex items-center space-x-1">
            <i data-lucide="pin" class="w-3.5 h-3.5"></i>
            <span>Pin 3D Injuries (${p.injuryPins.length})</span>
          </button>
          <button onclick="removePatient(${p.id})" class="text-rose-600 hover:text-rose-800 font-bold">Remove</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Full Name</label>
          <input type="text" title="Full Name" aria-label="Full Name" value="${p.name}" onchange="updatePatientField(${p.id}, 'name', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Address</label>
          <input type="text" title="Address" aria-label="Address" value="${p.address}" onchange="updatePatientField(${p.id}, 'address', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Age</label>
          <input type="number" title="Age" aria-label="Age" value="${p.age}" onchange="updatePatientField(${p.id}, 'age', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Gender</label>
          <select title="Gender" aria-label="Gender" onchange="updatePatientField(${p.id}, 'gender', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
            <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 bg-sky-50/70 p-3 rounded-xl border border-sky-100">
        <div>
          <label class="block font-bold text-sky-800 mb-0.5">Heart Rate (BPM)</label>
          <input type="text" title="Heart Rate BPM" aria-label="Heart Rate BPM" value="${p.hr || ''}" onchange="updatePatientField(${p.id}, 'hr', this.value)" placeholder="e.g. 110" class="w-full border border-sky-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none bg-white">
        </div>
        <div>
          <label class="block font-bold text-sky-800 mb-0.5">Blood Pressure (BP)</label>
          <input type="text" title="Blood Pressure" aria-label="Blood Pressure" value="${p.bp || ''}" onchange="updatePatientField(${p.id}, 'bp', this.value)" placeholder="e.g. 120/80" class="w-full border border-sky-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none bg-white">
        </div>
        <div>
          <label class="block font-bold text-sky-800 mb-0.5">SpO2 Saturation (%)</label>
          <input type="text" title="SpO2 Saturation" aria-label="SpO2 Saturation" value="${p.spo2 || ''}" onchange="updatePatientField(${p.id}, 'spo2', this.value)" placeholder="e.g. 96" class="w-full border border-sky-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none bg-white">
        </div>
        <div>
          <label class="block font-bold text-sky-800 mb-0.5">Consciousness (GCS / AVPU)</label>
          <input type="text" title="Consciousness GCS AVPU" aria-label="Consciousness GCS AVPU" value="${p.gcs || ''}" onchange="updatePatientField(${p.id}, 'gcs', this.value)" placeholder="e.g. Alert (GCS 15)" class="w-full border border-sky-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none bg-white">
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Anatomical Model Type</label>
          <select title="3D Model Type" aria-label="3D Model Type" onchange="updatePatientField(${p.id}, 'activeLayer', this.value); if (${p.id} === activePatientId) switch3DLayer(this.value);" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold focus:ring-2 focus:ring-sky-500 outline-none bg-sky-50 text-sky-800">
            <option value="skin" ${(p.activeLayer || 'skin') === 'skin' ? 'selected' : ''}>External Skin (Wounds/Burns)</option>
            <option value="skeleton" ${p.activeLayer === 'skeleton' ? 'selected' : ''}>Internal Skeleton (Fractures)</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Primary Injury / Assessment</label>
          <input type="text" title="Primary Injury Assessment" aria-label="Primary Injury Assessment" value="${p.injury}" onchange="updatePatientField(${p.id}, 'injury', this.value)" placeholder="e.g. Laceration, Hirap sa paghinga" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Hospitalized?</label>
          <select title="Hospitalized Status" aria-label="Hospitalized Status" onchange="updatePatientField(${p.id}, 'hospitalized', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
            <option value="Yes" ${p.hospitalized === 'Yes' ? 'selected' : ''}>Yes</option>
            <option value="No" ${p.hospitalized === 'No' ? 'selected' : ''}>No</option>
          </select>
        </div>
        <div>
          <label class="block font-semibold text-slate-600 mb-1">Name of Hospital</label>
          <select title="Name of Hospital" aria-label="Name of Hospital" onchange="updatePatientField(${p.id}, 'hospital', this.value)" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none">
            ${masterData.hospitals.map(h => `<option value="${h}" ${p.hospital === h ? 'selected' : ''}>${h}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="bg-white p-3 rounded-xl border border-slate-200">
        <label class="block font-bold text-rose-600 mb-1">First Aid / Medical Interventions Given</label>
        <input type="text" title="First Aid Medical Interventions" aria-label="First Aid Medical Interventions" value="${p.firstAid}" onchange="updatePatientField(${p.id}, 'firstAid', this.value)" placeholder="e.g. Oxygen inhalation (2L/min), Wound dressing, Spine Boarding, Splinting" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-rose-500 outline-none font-medium">
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function updateSidebarStats() {
  const irNumEl = document.getElementById('sidebar-ir-num');
  const countEl = document.getElementById('sidebar-total-patients');
  const incNumInput = document.getElementById('inc-number');

  if (irNumEl && incNumInput) irNumEl.innerText = incNumInput.value || 'IR-2026-001';
  if (countEl) countEl.innerText = patientsList.length;
}

/* ==========================================================================
   STEP 4: FIXED PHOTO DOCUMENTATION ENGINE
   ========================================================================== */
function handlePhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      docPhotos.push({ id: Date.now() + Math.random(), url: e.target.result });
      renderPhotosGrid();
    };
    reader.readAsDataURL(file);
  });
}

function deletePhoto(id) {
  docPhotos = docPhotos.filter(p => p.id !== id);
  renderPhotosGrid();
}

function renderPhotosGrid() {
  const container = document.getElementById('photos-grid');
  if (!container) return;

  if (docPhotos.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic col-span-full text-center py-4">No documentation photos uploaded yet.</p>`;
    return;
  }

  container.innerHTML = docPhotos.map(p => `
    <div class="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm aspect-square">
      <img src="${p.url}" class="w-full h-full object-cover group-hover:opacity-85 transition" alt="Documentation photo">
      <button onclick="deletePhoto(${p.id})" class="absolute top-2 right-2 bg-rose-600 text-white p-1.5 rounded-lg opacity-90 hover:opacity-100 transition shadow-md" title="Delete Image">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

/* ==========================================================================
   STEP 5: RESPONDERS & COMMAND PERSONNEL LOGIC (SELECTABLE DROPDOWNS)
   ========================================================================== */
function addResponder(name = '', agency = '', role = 'Team Leader') {
  const rId = Date.now() + Math.floor(Math.random() * 1000);
  respondersList.push({
    id: rId,
    name: name || (masterData.responders[0] || 'Unit 1'),
    agency: agency || (masterData.agencies[0] || 'Famy MDRRMO'),
    role: role || 'Team Leader'
  });
  renderRespondersList();
}

function removeResponder(id) {
  respondersList = respondersList.filter(r => r.id !== id);
  renderRespondersList();
}

function renderRespondersList() {
  const container = document.getElementById('responders-container');
  if (!container) return;

  container.innerHTML = respondersList.map(r => `
    <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
      <select title="Responder Name" aria-label="Responder Name" onchange="updateItemInList(respondersList, ${r.id}, 'name', this.value)" class="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none bg-white font-medium">
        ${masterData.responders.map(res => `<option value="${res}" ${r.name === res ? 'selected' : ''}>${res}</option>`).join('')}
      </select>

      <select title="Agency" aria-label="Agency" onchange="updateItemInList(respondersList, ${r.id}, 'agency', this.value)" class="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none bg-white font-medium">
        ${masterData.agencies.map(ag => `<option value="${ag}" ${r.agency === ag ? 'selected' : ''}>${ag}</option>`).join('')}
      </select>

      <input type="text" title="Role" aria-label="Role" value="${r.role}" onchange="updateItemInList(respondersList, ${r.id}, 'role', this.value)" placeholder="Role (e.g. Team Leader)" class="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none bg-white">

      <button onclick="removeResponder(${r.id})" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1">Delete</button>
    </div>
  `).join('');
}

function addCommandPerson(name = '', role = 'Incident Commander', status = 'On-Duty') {
  const cId = Date.now() + Math.floor(Math.random() * 1000);
  commandList.push({
    id: cId,
    name: name || (masterData.operators[0] || 'Command Staff'),
    role: role || 'Incident Commander',
    status: status
  });
  renderCommandList();
}

function removeCommandPerson(id) {
  commandList = commandList.filter(c => c.id !== id);
  renderCommandList();
}

function renderCommandList() {
  const container = document.getElementById('command-container');
  if (!container) return;

  container.innerHTML = commandList.map(c => `
    <div class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs">
      <select title="Operator Name" aria-label="Operator Name" onchange="updateItemInList(commandList, ${c.id}, 'name', this.value)" class="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium">
        ${masterData.operators.map(op => `<option value="${op}" ${c.name === op ? 'selected' : ''}>${op}</option>`).join('')}
      </select>

      <input type="text" title="Operator Role" aria-label="Operator Role" value="${c.role}" onchange="updateItemInList(commandList, ${c.id}, 'role', this.value)" placeholder="Role (e.g. Duty Commander)" class="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">

      <select title="Operator Status" aria-label="Operator Status" onchange="updateItemInList(commandList, ${c.id}, 'status', this.value)" class="border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
        <option value="On-Duty" ${c.status === 'On-Duty' ? 'selected' : ''}>On-Duty</option>
        <option value="Standby" ${c.status === 'Standby' ? 'selected' : ''}>Standby</option>
      </select>

      <button onclick="removeCommandPerson(${c.id})" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1">Delete</button>
    </div>
  `).join('');
}

function updateItemInList(list, id, field, value) {
  const item = list.find(i => i.id === id);
  if (item) item[field] = value;
}

/* ==========================================================================
   THREE.JS 3D ANATOMICAL MODEL & INJURY PINNING
   ========================================================================== */
function init3DScene() {
  const container = document.getElementById('three-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x718096);

  camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0.85, 3.2);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.65;
  renderer.outputEncoding = THREE.sRGBEncoding;

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.8, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  scene.add(keyLight);

  scene.add(pinMarkersGroup);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  loadAnatomicalModels();
  window.addEventListener('resize', onWindowResize);
  renderer.domElement.addEventListener('dblclick', onModelDoubleClick);

  animate();
}

function loadAnatomicalModels() {
  const loader = (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader !== 'undefined') ? new THREE.GLTFLoader() : null;

  if (loader) {
    loader.load('/assets/models/skin/human_skin.gltf', (gltf) => {
      skinModelGroup = formatGLTFModel(gltf.scene, 'skin');
      scene.add(skinModelGroup);
    }, undefined, () => {
      skinModelGroup = buildSeamlessStudioMannequin('skin');
      scene.add(skinModelGroup);
    });

    loader.load('/assets/models/skeleton/human_skeleton.gltf', (gltf) => {
      skeletonModelGroup = formatGLTFModel(gltf.scene, 'skeleton');
      skeletonModelGroup.visible = false;
      scene.add(skeletonModelGroup);
    }, undefined, () => {
      skeletonModelGroup = buildSeamlessStudioMannequin('skeleton');
      skeletonModelGroup.visible = false;
      scene.add(skeletonModelGroup);
    });
  } else {
    skinModelGroup = buildSeamlessStudioMannequin('skin');
    scene.add(skinModelGroup);
    skeletonModelGroup = buildSeamlessStudioMannequin('skeleton');
    skeletonModelGroup.visible = false;
    scene.add(skeletonModelGroup);
  }
}

function formatGLTFModel(modelScene, layerType) {
  const group = new THREE.Group();
  const box = new THREE.Box3().setFromObject(modelScene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  modelScene.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scaleFactor = 1.8 / (maxDim || 1);
  modelScene.scale.set(scaleFactor, scaleFactor, scaleFactor);
  modelScene.position.y += (size.y * scaleFactor) / 2 - 0.1;

  modelScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      child.name = sanitizeText(child.name);
      if (!child.material) child.material = new THREE.MeshStandardMaterial({ color: layerType === 'skin' ? 0xc8d0dc : 0xdde7f5, roughness: 0.6 });
    }
  });

  group.add(modelScene);
  return group;
}

function buildSeamlessStudioMannequin(type) {
  const bodyGroup = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: type === 'skin' ? 0xbdc5d0 : 0xdbe5f5, roughness: 0.6 });

  function createMesh(geometry, name) {
    const mesh = new THREE.Mesh(geometry, clayMat);
    mesh.castShadow = true;
    mesh.name = sanitizeText(name);
    return mesh;
  }

  const head = createMesh(new THREE.SphereGeometry(0.13, 32, 32), "Head / Cranium");
  head.position.set(0, 1.68, 0);
  bodyGroup.add(head);

  const chest = createMesh(new THREE.CylinderGeometry(0.19, 0.15, 0.36, 24), "Torso / Chest");
  chest.position.set(0, 1.28, 0);
  bodyGroup.add(chest);

  bodyGroup.position.y = -0.55;
  return bodyGroup;
}

function switch3DLayer(layer) {
  currentLayer = layer;
  const activePatient = getActivePatient();
  if (activePatient) {
    activePatient.activeLayer = layer;
  }

  updateLayerButtonsUI();
  updateActivePatientSelectDropdown();
  render3DPinsForActivePatient();
}

function updateLayerButtonsUI() {
  const btnSkin = document.getElementById('btn-layer-skin');
  const btnSkeleton = document.getElementById('btn-layer-skeleton');

  if (currentLayer === 'skin') {
    if (skinModelGroup) skinModelGroup.visible = true;
    if (skeletonModelGroup) skeletonModelGroup.visible = false;
    if (btnSkin) btnSkin.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-white text-sky-600 shadow-sm flex items-center space-x-1.5";
    if (btnSkeleton) btnSkeleton.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 flex items-center space-x-1.5";
  } else {
    if (skinModelGroup) skinModelGroup.visible = false;
    if (skeletonModelGroup) skeletonModelGroup.visible = true;
    if (btnSkeleton) btnSkeleton.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-white text-indigo-600 shadow-sm flex items-center space-x-1.5";
    if (btnSkin) btnSkin.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition text-slate-600 flex items-center space-x-1.5";
  }
}

function render3DPinsForActivePatient() {
  pinMarkersGroup.clear();
  const activePatient = getActivePatient();
  if (!activePatient) { updatePinListUI(); return; }

  const layerToRender = activePatient.activeLayer || currentLayer || 'skin';

  if (skinModelGroup) skinModelGroup.visible = (layerToRender === 'skin');
  if (skeletonModelGroup) skeletonModelGroup.visible = (layerToRender === 'skeleton');

  activePatient.injuryPins.forEach(pin => {
    if (pin.layer === layerToRender) {
      const pinGroup = new THREE.Group();
      const pinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c }));
      pinGroup.add(pinMesh);
      pinGroup.position.set(parseFloat(pin.position.x), parseFloat(pin.position.y), parseFloat(pin.position.z));
      pinGroup.userData = { id: pin.id, layer: pin.layer };
      pinMarkersGroup.add(pinGroup);
    }
  });

  updatePinListUI();
}

function onModelDoubleClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const activeTarget = currentLayer === 'skin' ? skinModelGroup : skeletonModelGroup;
  if (!activeTarget) return;

  const intersects = raycaster.intersectObjects(activeTarget.children, true);
  if (intersects.length > 0) {
    const hit = intersects[0];
    pendingPinVector = hit.point.clone();
    
    let rawRegionName = hit.object.name || (currentLayer === 'skin' ? 'External Surface' : 'Bone Structure');
    pendingPinRegion = sanitizeText(rawRegionName) || (currentLayer === 'skin' ? 'External Surface' : 'Bone Structure');

    const activePatient = getActivePatient();
    document.getElementById('modal-region').value = `${pendingPinRegion} (${currentLayer.toUpperCase()})`;
    document.getElementById('modal-patient-label').innerText = `Target: ${activePatient ? activePatient.name : 'Unknown Patient'}`;
    document.getElementById('pin-modal').classList.remove('hidden');
  }
}

function closePinModal() {
  document.getElementById('pin-modal').classList.add('hidden');
  pendingPinVector = null;
}

function savePinDetails() {
  if (!pendingPinVector) return;
  const activePatient = getActivePatient();
  if (!activePatient) return alert("No active patient selected.");

  const typeInput = document.getElementById('modal-injury-type');
  const notesInput = document.getElementById('modal-pin-notes');

  activePatient.injuryPins.push({
    id: Date.now(),
    layer: currentLayer,
    region: pendingPinRegion,
    type: typeInput ? typeInput.value : 'Bone Fracture',
    notes: notesInput && notesInput.value ? sanitizeText(notesInput.value) : 'No notes specified',
    position: { x: pendingPinVector.x.toFixed(2), y: pendingPinVector.y.toFixed(2), z: pendingPinVector.z.toFixed(2) }
  });

  render3DPinsForActivePatient();
  renderPatientsList();
  updateActivePatientSelectDropdown();
  updateSidebarStats();
  closePinModal();
  if (notesInput) notesInput.value = '';
}

function removePin(id) {
  const activePatient = getActivePatient();
  if (!activePatient) return;

  activePatient.injuryPins = activePatient.injuryPins.filter(p => p.id !== id);
  render3DPinsForActivePatient();
  renderPatientsList();
  updateActivePatientSelectDropdown();
  updateSidebarStats();
}

function updatePinListUI() {
  const container = document.getElementById('pins-list');
  const count = document.getElementById('pins-count');
  const activePatient = getActivePatient();
  if (!activePatient) return;

  if (count) count.innerText = `${activePatient.injuryPins.length} Pin(s)`;
  if (!container) return;

  if (activePatient.injuryPins.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-6">Double-click 3D body model to mark injury location.</p>`;
    return;
  }

  container.innerHTML = activePatient.injuryPins.map(pin => `
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs flex justify-between items-start gap-2 shadow-sm">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-800 truncate">${pin.region}</div>
        <div class="text-rose-600 font-semibold text-[11px]">${pin.type} (${pin.layer})</div>
        <div class="text-slate-500 text-[10px]">${pin.notes}</div>
      </div>
      <button onclick="removePin(${pin.id})" class="text-slate-400 hover:text-rose-600 p-1">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch (e) {}
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function onWindowResize() {
  const container = document.getElementById('three-container');
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

/* ==========================================================================
   STEP 6: OVERVIEW & COMPACT PRINT ENGINE WITH MAP & MULTI-PATIENT 3D SNAPS
   ========================================================================== */
function buildOverviewReport() {
  const container = document.getElementById('printable-report');
  if (!container) return;

  const irNumber = document.getElementById('inc-number')?.value || 'IR-2026-001';
  const dateTime = document.getElementById('inc-time')?.value || new Date().toLocaleString();
  const nature = document.getElementById('inc-nature')?.value || 'Road Collision';
  const place = document.getElementById('inc-place')?.value || 'Caballero Famy';
  const landmark = document.getElementById('inc-landmark')?.value || 'Near in Youmi Sari sari';
  const severity = document.getElementById('inc-severity')?.value || 'Low';

  // 1. GENERATE PER-PATIENT 3D BODY SNAPSHOTS USING EACH PATIENT'S MODEL LAYER
  const initialActiveId = activePatientId;
  const patient3dSnapshots = patientsList.map((p) => {
    activePatientId = p.id;
    const pLayer = p.activeLayer || 'skin';
    currentLayer = pLayer;

    if (skinModelGroup) skinModelGroup.visible = (pLayer === 'skin');
    if (skeletonModelGroup) skeletonModelGroup.visible = (pLayer === 'skeleton');

    render3DPinsForActivePatient();

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
    const snapUrl = renderer ? renderer.domElement.toDataURL('image/png') : '';
    return {
      name: p.name,
      layer: pLayer,
      pinsCount: p.injuryPins.length,
      imgUrl: snapUrl
    };
  });

  // Restore initial active patient state
  activePatientId = initialActiveId;
  const initialPatient = getActivePatient();
  currentLayer = initialPatient ? (initialPatient.activeLayer || 'skin') : 'skin';
  updateLayerButtonsUI();
  render3DPinsForActivePatient();

  container.innerHTML = `
    <div class="border-b-2 border-slate-800 pb-3 mb-3 flex justify-between items-center">
      <div>
        <h1 class="text-base font-bold text-slate-900 uppercase tracking-tight">${masterData.settings.agency || 'MDRRMO FAMY EMERGENCY COMMAND CENTER'}</h1>
        <p class="text-[10px] text-slate-500">Official Disaster Risk Response Emergency Incident Report</p>
      </div>
      <div class="text-right">
        <span class="text-sm font-bold font-mono text-rose-600">${irNumber}</span>
        <p class="text-[10px] text-slate-400">Date/Time: ${dateTime}</p>
      </div>
    </div>

    <!-- Incident Context Summary -->
    <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] mb-3">
      <div><strong>Nature / Type:</strong> ${nature}</div>
      <div><strong>Severity:</strong> ${severity}</div>
      <div><strong>Place / Location:</strong> ${place}</div>
      <div><strong>Landmark:</strong> ${landmark}</div>
      <div><strong>GPS Coords:</strong> ${gisCoords.lat}, ${gisCoords.lng}</div>
    </div>

    <!-- GIS Incident Map Snapshot -->
    <div class="border border-slate-200 rounded-lg p-2 bg-slate-50 mb-3 page-break-inside-avoid">
      <h4 class="font-bold text-[11px] text-slate-800 mb-1 flex items-center justify-between">
        <span>Pinned GIS Accident Location Map</span>
        <span class="text-[10px] font-mono text-rose-600 font-semibold">Coords: ${gisCoords.lat}, ${gisCoords.lng}</span>
      </h4>
      <div id="overview-leaflet-map" class="h-44 w-full rounded overflow-hidden border border-slate-300 relative bg-slate-200"></div>
    </div>

    <!-- Patients Assessment, Vitals & First Aid Table -->
    <div class="mb-3">
      <h3 class="font-bold text-slate-800 border-b border-slate-300 pb-1 mb-1.5 text-[11px] uppercase">Patient Assessments, Vitals, First Aid & Hospital Transport</h3>
      <table class="w-full text-left text-[10px] border-collapse">
        <thead>
          <tr class="bg-slate-100 border-b border-slate-300">
            <th class="p-1 font-bold">#</th>
            <th class="p-1 font-bold">Name</th>
            <th class="p-1 font-bold">Age/Sex</th>
            <th class="p-1 font-bold">Vitals (BP/HR/SpO2/GCS)</th>
            <th class="p-1 font-bold">Primary Injury</th>
            <th class="p-1 font-bold">First Aid Interventions</th>
            <th class="p-1 font-bold">Hospitalized</th>
            <th class="p-1 font-bold">Hospital Name</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${patientsList.map((p, i) => `
            <tr>
              <td class="p-1">${i + 1}</td>
              <td class="p-1 font-bold text-slate-900">${p.name}</td>
              <td class="p-1">${p.age} /${p.gender}</td>
              <td class="p-1 font-mono text-sky-800">BP: ${p.bp || '120/80'} | HR: ${p.hr || '80'}bpm | SpO2: ${p.spo2 || '98'}% | ${p.gcs || 'Alert'}</td>
              <td class="p-1">${p.injury} (${p.injuryPins.length} pins)</td>
              <td class="p-1 text-rose-700 font-semibold">${p.firstAid || 'N/A'}</td>
              <td class="p-1 font-semibold">${p.hospitalized}</td>
              <td class="p-1">${p.hospital}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- MULTI-PATIENT 3D BODY MARKING SNAPSHOTS -->
    <div class="mb-3 page-break-inside-avoid">
      <h4 class="font-bold text-[11px] text-slate-800 border-b border-slate-300 pb-1 mb-2 uppercase">Per-Patient 3D Anatomical Injury Snapshots (${patientsList.length} Patients)</h4>
      <div class="grid grid-cols-${Math.min(patientsList.length, 3)} gap-3">
        ${patient3dSnapshots.map((snap, idx) => `
          <div class="border border-slate-200 rounded-lg p-2 bg-slate-50 text-center">
            <div class="font-bold text-[10px] text-slate-800 mb-0.5">Patient #${idx + 1}:${snap.name}</div>
            <div class="text-[9px] text-sky-700 font-bold uppercase mb-0.5">Model: ${snap.layer}</div>
            <div class="text-[9px] text-rose-600 font-semibold mb-1">${snap.pinsCount} Injury Pin(s) Mapped</div>${snap.imgUrl ? `<img src="${snap.imgUrl}" class="h-36 w-full object-contain rounded bg-slate-700 shadow-inner" alt="3D Anatomical Snapshot for ${snap.name}">` : '<p class="text-[10px] text-slate-400">No 3D snapshot</p>'}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Documentation Photos -->
    <div class="border border-slate-200 rounded-lg p-2 bg-slate-50 mb-3 page-break-inside-avoid">
      <h4 class="font-bold text-[10px] text-slate-700 mb-1">Documentation Photos (${docPhotos.length})</h4>
      <div class="grid grid-cols-4 gap-2">
        ${docPhotos.length > 0 ? docPhotos.slice(0, 4).map(photo => `<img src="${photo.url}" class="h-20 w-full object-cover rounded border border-slate-300" alt="Incident documentation photo">`).join('') : '<p class="text-[10px] text-slate-400 italic col-span-4 text-center py-2">No photos attached</p>'}
      </div>
    </div>

    <!-- Responders & Command Staff -->
    <div class="grid grid-cols-2 gap-3 text-[10px]">
      <div>
        <h4 class="font-bold border-b border-slate-300 pb-0.5 mb-1">Field Responders</h4>
        ${respondersList.map(r => `<div>• <strong>${r.name}</strong> (${r.agency} -${r.role})</div>`).join('')}
      </div>
      <div>
        <h4 class="font-bold border-b border-slate-300 pb-0.5 mb-1">FSLRS Command Operators</h4>
        ${commandList.map(c => `<div>• <strong>${c.name}</strong> (${c.role})</div>`).join('')}
      </div>
    </div>
  `;

  // Initialize mini Leaflet map centered precisely on the pinned GPS coordinates
  setTimeout(() => {
    const mapEl = document.getElementById('overview-leaflet-map');
    if (mapEl && typeof L !== 'undefined') {
      if (mapEl._leaflet_id) { mapEl._leaflet_id = null; }
      const overviewMap = L.map('overview-leaflet-map', {
        center: [gisCoords.lat, gisCoords.lng],
        zoom: 16,
        dragging: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        attributionControl: false
      });
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(overviewMap);
      L.marker([gisCoords.lat, gisCoords.lng]).addTo(overviewMap);
      overviewMap.invalidateSize();
    }
  }, 150);
}

function printReport() {
  buildOverviewReport();
  window.print();
}

function resetIncidentForm() {
  patientsList = [];
  docPhotos = [];
  respondersList = [];
  commandList = [];
  activePatientId = null;

  addPatient(
    '', 
    'Famy, Laguna', 
    '', 
    'Male', 
    '', 
    '', 
    '', 
    'Alert (GCS 15)', 
    '', 
    '', 
    'Yes', 
    masterData.hospitals[0] || 'Siniloan District Hospital',
    'skin'
  );

  const placeInput = document.getElementById('inc-place');
  const landmarkInput = document.getElementById('inc-landmark');
  if (placeInput) placeInput.value = '';
  if (landmarkInput) landmarkInput.value = '';

  const prefix = masterData.settings?.prefix || 'IR-2026-';
  const nextNum = String(savedReports.length + 1).padStart(3, '0');
  const incNumInput = document.getElementById('inc-number');
  if (incNumInput) incNumInput.value = `${prefix}${nextNum}`;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const dateInput = document.getElementById('inc-time');
  if (dateInput) dateInput.value = now.toISOString().slice(0, 16);

  renderPatientsList();
  renderPhotosGrid();
  renderRespondersList();
  renderCommandList();
  updateSidebarStats();
  goToStep(1);
}

async function saveIncidentReport() {
  const irNumber = document.getElementById('inc-number')?.value || 'IR-2026-001';
  const dateTime = document.getElementById('inc-time')?.value || new Date().toISOString();

  const newReport = {
    id: Date.now(),
    irNumber: irNumber,
    dateTime: dateTime,
    nature: document.getElementById('inc-nature')?.value || 'Road Collision',
    place: document.getElementById('inc-place')?.value || 'Caballero Famy',
    landmark: document.getElementById('inc-landmark')?.value || 'Near in Youmi Sari sari',
    severity: document.getElementById('inc-severity')?.value || 'Low',
    gisCoordinates: gisCoords,
    patients: JSON.parse(JSON.stringify(patientsList)),
    photos: JSON.parse(JSON.stringify(docPhotos)),
    responders: JSON.parse(JSON.stringify(respondersList)),
    commandPersonnel: JSON.parse(JSON.stringify(commandList))
  };

  try {
    const response = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    });
    if (!response.ok) throw new Error('Cloud sync failed');
  } catch (err) {
    console.error('Database sync error:', err);
  }

  savedReports.unshift(newReport);
  localStorage.setItem('aegis_reports', JSON.stringify(savedReports));

  alert(`Incident Report ${irNumber} Saved Successfully!`);
  resetIncidentForm();
  switchModule(2);
}

/* ==========================================================================
   MODULE 2: VIEW & EXPORT REPORTS ENGINE
   ========================================================================== */
function renderReportsTable() {
  const container = document.getElementById('reports-table-body');
  if (!container) return;

  const filtered = filterReportsData();

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 italic">No matching incident reports found.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3"><input type="checkbox" title="Select Report" aria-label="Select Report" class="report-checkbox" value="${r.id}"></td>
      <td class="p-3 font-mono font-bold text-rose-600">${r.irNumber}</td>
      <td class="p-3">${new Date(r.dateTime).toLocaleString()}</td>
      <td class="p-3 font-semibold">${r.nature}</td>
      <td class="p-3">${r.place} <span class="text-slate-400">(${r.landmark})</span></td>
      <td class="p-3">${r.patients.length} Patient(s)</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded-md font-bold ${r.severity === 'Low' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${r.severity}</span></td>
      <td class="p-3 text-right space-x-1">
        <button onclick="exportSingleCSV(${r.id})" class="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-bold">CSV</button>
        <button onclick="deleteReportRecord(${r.id})" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold">Delete</button>
      </td>
    </tr>
  `).join('');
}

function filterReportsData() {
  const period = document.getElementById('filter-period')?.value || 'all';
  const type = document.getElementById('filter-incident-type')?.value || 'all';
  const gender = document.getElementById('filter-gender')?.value || 'all';
  const search = document.getElementById('filter-search')?.value.toLowerCase() || '';

  const now = new Date();

  return savedReports.filter(r => {
    const date = new Date(r.dateTime);
    if (period === 'month' && (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear())) return false;
    if (period === 'year' && date.getFullYear() !== now.getFullYear()) return false;
    if (type !== 'all' && r.nature !== type) return false;
    if (gender !== 'all' && !r.patients.some(p => p.gender === gender)) return false;
    if (search && !r.irNumber.toLowerCase().includes(search) && !r.place.toLowerCase().includes(search) && !r.landmark.toLowerCase().includes(search)) return false;
    return true;
  });
}

function applyReportFilters() {
  renderReportsTable();
}

function toggleSelectAllReports(checked) {
  document.querySelectorAll('.report-checkbox').forEach(cb => cb.checked = checked);
}

function deleteReportRecord(id) {
  if (!confirm("Are you sure you want to delete this incident report record?")) return;
  savedReports = savedReports.filter(r => r.id !== id);
  localStorage.setItem('aegis_reports', JSON.stringify(savedReports));
  renderReportsTable();
}

// CSV EXPORT ENGINE
function exportSingleCSV(id) {
  const report = savedReports.find(r => r.id === id);
  if (!report) return;
  generateCSVDownload([report], `${report.irNumber}_Report.csv`);
}

function exportSelectedCSV() {
  const checkedIds = Array.from(document.querySelectorAll('.report-checkbox:checked')).map(cb => parseInt(cb.value));
  if (checkedIds.length === 0) return alert("Please select at least one report to export.");
  const selected = savedReports.filter(r => checkedIds.includes(r.id));
  generateCSVDownload(selected, `Selected_Incidents_Export.csv`);
}

function exportFilteredCSV() {
  const filtered = filterReportsData();
  if (filtered.length === 0) return alert("No reports available to export.");
  generateCSVDownload(filtered, `Filtered_Incidents_Export.csv`);
}

function generateCSVDownload(reports, filename) {
  let csv = 'IR Number,Date Time,Nature,Place,Landmark,Severity,Patients Count,Patients Details,Vitals,First Aid Interventions\n';
  reports.forEach(r => {
    const pDetails = r.patients.map(p => `${p.name} (${p.age}/${p.gender} - Hospitalized: ${p.hospitalized})`).join('; ');
    const vitalsDetails = r.patients.map(p => `${p.name}: [BP: ${p.bp || '120/80'}, HR: ${p.hr || '80'}bpm, SpO2: ${p.spo2 || '98'}%, GCS: ${p.gcs || 'Alert'}]`).join('; ');
    const faDetails = r.patients.map(p => `${p.name}: ${p.firstAid || 'None'}`).join('; ');
    csv += `"${r.irNumber}","${r.dateTime}","${r.nature}","${r.place}","${r.landmark}","${r.severity}",${r.patients.length},"${pDetails}","${vitalsDetails}","${faDetails}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.click();
}

/* ==========================================================================
   MODULE 4: SUMMARY REPORTS & DASHBOARD METRICS
   ========================================================================== */
function renderSummaryReportsModule() {
  const totalIncidents = savedReports.length;
  let totalPatients = 0;
  let totalHospitalized = 0;
  let criticalCount = 0;

  const natureCounts = {};
  const severityCounts = {};

  savedReports.forEach(r => {
    if (r.patients) {
      totalPatients += r.patients.length;
      totalHospitalized += r.patients.filter(p => p.hospitalized === 'Yes').length;
    }

    if (r.severity && (r.severity.includes('High') || r.severity.includes('Critical') || r.severity.includes('Disaster'))) {
      criticalCount++;
    }

    const n = r.nature || 'Unclassified';
    natureCounts[n] = (natureCounts[n] || 0) + 1;

    const s = r.severity || 'Low';
    severityCounts[s] = (severityCounts[s] || 0) + 1;
  });

  const elTotalInc = document.getElementById('stat-total-incidents');
  const elTotalPat = document.getElementById('stat-total-patients');
  const elTotalHosp = document.getElementById('stat-hospitalized');
  const elCritCount = document.getElementById('stat-critical-count');

  if (elTotalInc) elTotalInc.innerText = totalIncidents;
  if (elTotalPat) elTotalPat.innerText = totalPatients;
  if (elTotalHosp) elTotalHosp.innerText = totalHospitalized;
  if (elCritCount) elCritCount.innerText = criticalCount;

  const natureContainer = document.getElementById('summary-nature-list');
  if (natureContainer) {
    if (Object.keys(natureCounts).length === 0) {
      natureContainer.innerHTML = `<p class="text-slate-400 italic">No incidents recorded yet.</p>`;
    } else {
      natureContainer.innerHTML = Object.entries(natureCounts).map(([type, count]) => `
        <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
          <span class="font-semibold text-slate-700">${type}</span>
          <span class="px-2 py-0.5 bg-sky-100 text-sky-800 font-bold rounded-md">${count}</span>
        </div>
      `).join('');
    }
  }

  const severityContainer = document.getElementById('summary-severity-list');
  if (severityContainer) {
    if (Object.keys(severityCounts).length === 0) {
      severityContainer.innerHTML = `<p class="text-slate-400 italic">No incidents recorded yet.</p>`;
    } else {
      severityContainer.innerHTML = Object.entries(severityCounts).map(([sev, count]) => `
        <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
          <span class="font-semibold text-slate-700">${sev}</span>
          <span class="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md">${count}</span>
        </div>
      `).join('');
    }
  }
}

/* ==========================================================================
   MODULE 5: SYSTEM DATA & MASTER SETTINGS LOGIC
   ========================================================================== */
function populateDropdownsFromMaster() {
  const natureSelect = document.getElementById('inc-nature');
  const filterTypeSelect = document.getElementById('filter-incident-type');

  if (natureSelect) {
    natureSelect.innerHTML = masterData.incidentTypes.map(t => `<option value="${t}">${t}</option>`).join('');
  }
  if (filterTypeSelect) {
    filterTypeSelect.innerHTML = `<option value="all">All Incident Types</option>` + masterData.incidentTypes.map(t => `<option value="${t}">${t}</option>`).join('');
  }
}

function renderMasterLists() {
  const respEl = document.getElementById('master-responders-list');
  const agencyEl = document.getElementById('master-agencies-list');
  const opEl = document.getElementById('master-operators-list');
  const incEl = document.getElementById('master-incidents-list');
  const hospEl = document.getElementById('master-hospitals-list');

  if (respEl) {
    respEl.innerHTML = masterData.responders.map((item, i) => `
      <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
        <span>${item}</span>
        <button onclick="deleteMasterItem('responders', ${i})" class="text-rose-600 hover:underline font-bold">Delete</button>
      </div>
    `).join('');
  }

  if (agencyEl) {
    agencyEl.innerHTML = (masterData.agencies || []).map((item, i) => `
      <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
        <span>${item}</span>
        <button onclick="deleteMasterItem('agencies', ${i})" class="text-rose-600 hover:underline font-bold">Delete</button>
      </div>
    `).join('');
  }

  if (opEl) {
    opEl.innerHTML = masterData.operators.map((item, i) => `
      <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
        <span>${item}</span>
        <button onclick="deleteMasterItem('operators', ${i})" class="text-rose-600 hover:underline font-bold">Delete</button>
      </div>
    `).join('');
  }

  if (incEl) {
    incEl.innerHTML = masterData.incidentTypes.map((item, i) => `
      <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
        <span>${item}</span>
        <button onclick="deleteMasterItem('incidentTypes', ${i})" class="text-rose-600 hover:underline font-bold">Delete</button>
      </div>
    `).join('');
  }

  if (hospEl) {
    hospEl.innerHTML = masterData.hospitals.map((item, i) => `
      <div class="flex justify-between items-center bg-white p-2 rounded-lg border text-xs">
        <span>${item}</span>
        <button onclick="deleteMasterItem('hospitals', ${i})" class="text-rose-600 hover:underline font-bold">Delete</button>
      </div>
    `).join('');
  }
}

function addMasterItem(category) {
  const val = prompt(`Enter new entry for ${category}:`);
  if (!val || !val.trim()) return;
  masterData[category].push(val.trim());
  localStorage.setItem('aegis_master_data', JSON.stringify(masterData));
  
  renderMasterLists();
  populateDropdownsFromMaster();
  renderRespondersList();
  renderCommandList();
}

function deleteMasterItem(category, index) {
  if (!confirm("Delete this reference item?")) return;
  masterData[category].splice(index, 1);
  localStorage.setItem('aegis_master_data', JSON.stringify(masterData));
  
  renderMasterLists();
  populateDropdownsFromMaster();
  renderRespondersList();
  renderCommandList();
}

function saveSystemSettings() {
  masterData.settings = {
    prefix: document.getElementById('sys-prefix')?.value || 'IR-2026-',
    coords: document.getElementById('sys-coords')?.value || '14.435439, 121.449593',
    agency: document.getElementById('sys-agency')?.value || 'MDRRMO Famy Command Center'
  };
  localStorage.setItem('aegis_master_data', JSON.stringify(masterData));
  alert("System Configurations Saved Successfully!");
}
