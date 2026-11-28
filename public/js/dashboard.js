const SUPABASE = window.IR_SUPABASE_CONFIG || {};

async function fetchIncidentRows() {
  if (!SUPABASE.url || !SUPABASE.anonKey) throw new Error('Database connection is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Netlify environment variables, then redeploy.');
  const response = await fetch(`${SUPABASE.url}/rest/v1/incidents?select=*&order=created_at.desc`, {
    headers: { apikey: SUPABASE.anonKey, Authorization: `Bearer ${SUPABASE.anonKey}` }
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

const colors = ['#4479c7','#e39a25','#4f9d75','#8a67c8','#c9504b','#56a7bd','#7a8799'];
let records = [], map, markerLayer;

async function loadRecords() {
  try {
    const rows = await fetchIncidentRows();
    records = rows.map(row => ({
      id: row.id, irNumber: row.ir_number, dateTime: row.date_time,
      nature: row.nature, place: row.place, landmark: row.landmark,
      severity: row.severity, coordinates: row.gis_coordinates,
      patients: row.patients || []
    }));
  } catch (error) {
    console.error(error);
    const status = document.querySelector('.status strong');
    if (status) status.textContent = 'Configuration needed';
    const recentRows = document.getElementById('recent-rows');
    if (recentRows) recentRows.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
  renderDashboard();
}

function isWithinPeriod(record) {
  const period = document.getElementById('period').value;
  if (period === 'all') return true;
  const date = new Date(record.dateTime);
  const now = new Date();
  return period === 'month'
    ? date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    : date.getFullYear() === now.getFullYear();
}

function getFilteredRecords() {
  const type = document.getElementById('type-filter').value;
  return records.filter(record => isWithinPeriod(record) && (type === 'all' || record.nature === type));
}

function renderDashboard() {
  const filtered = getFilteredRecords();
  const victims = filtered.reduce((sum, record) => sum + record.patients.length, 0);
  const transported = filtered.reduce((sum, record) => sum + record.patients.filter(patient => String(patient.hospitalized).toLowerCase() === 'yes').length, 0);
  const critical = filtered.filter(record => /high|critical|disaster/i.test(record.severity)).length;

  document.getElementById('total-incidents').textContent = filtered.length;
  document.getElementById('total-victims').textContent = victims;
  document.getElementById('hospital-transports').textContent = transported;
  document.getElementById('critical-count').textContent = critical;
  document.getElementById('chart-total').textContent = `${filtered.length} records`;
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

  populateTypes();
  drawChart(filtered);
  drawMap(filtered);
  drawRecent(filtered);
}

function populateTypes() {
  const select = document.getElementById('type-filter');
  const current = select.value;
  const types = [...new Set(records.map(record => record.nature).filter(Boolean))].sort();
  select.innerHTML = '<option value="all">All incident types</option>' + types.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('');
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function drawChart(filtered) {
  const canvas = document.getElementById('incident-chart');
  const context = canvas.getContext('2d');
  const counts = {};
  filtered.forEach(record => { const type = record.nature || 'Unclassified'; counts[type] = (counts[type] || 0) + 1; });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,7);

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 500;
  const height = 260;
  canvas.width = width * ratio; canvas.height = height * ratio;
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,width,height); context.font='10px Arial';

  if (!entries.length) { context.fillStyle='#98a2b3'; context.fillText('No incident records found', 20, 125); return; }
  const max = Math.max(...entries.map(entry => entry[1]), 1);
  const left = 42, bottom = 230, chartWidth = width-left-20, chartHeight=180;
  context.strokeStyle='#edf0f4'; context.beginPath();
  for(let i=0;i<=4;i++){const y=bottom-(chartHeight*i/4);context.moveTo(left,y);context.lineTo(left+chartWidth,y)} context.stroke();

  const gap=18, barWidth=Math.max(18,(chartWidth-gap*(entries.length+1))/entries.length);
  entries.forEach(([label,count],index) => {
    const x=left+gap+index*(barWidth+gap);
    const barHeight=chartHeight*count/max;
    context.fillStyle=colors[index%colors.length]; context.fillRect(x,bottom-barHeight,barWidth,barHeight);
    context.fillStyle='#66758a'; context.textAlign='center'; context.fillText(count,x+barWidth/2,bottom-barHeight-7);
    const short=label.length>12?label.slice(0,11)+'…':label;
    context.fillText(short,x+barWidth/2,bottom+18);
  });
}

function initMap() {
  map = L.map('incident-map').setView([14.435439,121.449593],12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
  markerLayer=L.layerGroup().addTo(map);
}

function drawMap(filtered) {
  if (!map) initMap();
  markerLayer.clearLayers();
  const positions=[];
  filtered.forEach(record => {
    if (!record.coordinates?.lat || !record.coordinates?.lng) return;
    const types=[...new Set(filtered.map(item=>item.nature||'Unclassified'))];
    const index=types.indexOf(record.nature||'Unclassified');
    const color=colors[index%colors.length];
    const icon=L.divIcon({className:'',html:`<div style="width:15px;height:15px;border:3px solid white;border-radius:50%;background:${color};box-shadow:0 2px 7px rgba(0,0,0,.35)"></div>`,iconSize:[15,15]});
    L.marker([record.coordinates.lat,record.coordinates.lng],{icon}).bindPopup(`<b>${escapeHtml(record.irNumber)}</b><br>${escapeHtml(record.nature)}<br>${escapeHtml(record.place||'')}`).addTo(markerLayer);
    positions.push([record.coordinates.lat,record.coordinates.lng]);
  });
  if(positions.length>1)map.fitBounds(positions,{padding:[20,20],maxZoom:14});

  const types=[...new Set(filtered.map(item=>item.nature||'Unclassified'))].slice(0,6);
  document.getElementById('legend').innerHTML=types.map((type,index)=>`<span class="legend-item"><i class="legend-dot" style="background:${colors[index%colors.length]}"></i>${escapeHtml(type)}</span>`).join('');
}

function drawRecent(filtered) {
  const rows=[...filtered].sort((a,b)=>new Date(b.dateTime)-new Date(a.dateTime)).slice(0,6);
  document.getElementById('recent-rows').innerHTML=rows.length?rows.map(record=>`<tr><td><b>${escapeHtml(record.irNumber)}</b></td><td>${escapeHtml(record.nature||'Unclassified')}</td><td>${escapeHtml(record.place||record.landmark||'—')}</td><td><span class="severity">${escapeHtml(record.severity||'Low')}</span></td><td>${record.dateTime?new Date(record.dateTime).toLocaleString([],{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</td></tr>`).join(''):'<tr><td colspan="5">No incident records found.</td></tr>';
}

function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]))}
document.getElementById('refresh').addEventListener('click',loadRecords);
document.getElementById('period').addEventListener('change',renderDashboard);
document.getElementById('type-filter').addEventListener('change',renderDashboard);
window.addEventListener('resize',()=>drawChart(getFilteredRecords()));
loadRecords();
setInterval(loadRecords,60000);
