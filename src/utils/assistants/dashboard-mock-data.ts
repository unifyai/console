/**
 * Mock data for the Dashboards pane.
 *
 * When USE_MOCK_DASHBOARDS is true the pane renders pre-built dashboards,
 * tiles and layouts without hitting the backend. Useful for local visual
 * testing and UI iteration.
 *
 * Set USE_MOCK_DASHBOARDS to true, select any assistant, then switch to
 * the Dashboards tab.
 */

import type { DashboardPaneData } from '@/types/assistants/dashboard';

// =============================================================================
// Configuration
// =============================================================================

/** Enable mock dashboard mode — set to true to render simulated data */
export const USE_MOCK_DASHBOARDS = false;

// =============================================================================
// Standalone HTML color palette (rgb format to avoid hex-color lint violations)
// =============================================================================

const C = {
  bg: 'rgb(245,241,234)',
  heading: 'rgb(10,20,16)',
  muted: 'rgb(107,106,100)',
  white: 'rgb(255,250,241)',
  blue: 'rgb(52,120,246)',
  red: 'rgb(217,74,61)',
  violet: 'rgb(133,87,255)',
  amber: 'rgb(255,207,51)',
  emerald: 'rgb(10,138,53)',
  teal: 'rgb(20,200,200)',
  indigo: 'rgb(133,87,255)',
  green600: 'rgb(10,138,53)',
  greenBg: 'rgb(222,245,226)',
  slate300: 'rgb(217,210,196)',
  slate100: 'rgb(235,230,220)',
  slate500: 'rgb(107,106,100)',
  slate200: 'rgb(217,210,196)',
  slate700: 'rgb(26,42,35)',
  amberBg: 'rgb(255,244,199)',
  amberText: 'rgb(112,78,0)',
  orangeBg: 'rgb(255,226,205)',
  orangeText: 'rgb(140,67,8)',
};

// =============================================================================
// Tile HTML Templates
// =============================================================================

const TILE_HTML_REVENUE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Monthly Revenue</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:16px}
.title{font-size:15px;font-weight:700;color:${C.heading};margin-bottom:12px;text-align:center}canvas{width:100%!important}</style>
</head><body>
<div class="title">Monthly Revenue (£k)</div>
<canvas id="c"></canvas>
<script>
new Chart(document.getElementById('c'),{type:'bar',
data:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
datasets:[{label:'Revenue',data:[42,38,45,51,49,55,60,58,63,67,61,72],
backgroundColor:'${C.blue}',borderRadius:4,barPercentage:.65}]},
options:{responsive:true,plugins:{legend:{display:false}},
scales:{y:{beginAtZero:true,ticks:{callback:v=>'£'+v+'k'}},x:{grid:{display:false}}}}});
<\/script></body></html>`;

const TILE_HTML_PRIORITY = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Priority Breakdown</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:16px;display:flex;flex-direction:column;align-items:center}
.title{font-size:15px;font-weight:700;color:${C.heading};margin-bottom:12px;text-align:center}
.chart-wrap{max-width:280px;width:100%}</style>
</head><body>
<div class="title">Work Orders by Priority</div>
<div class="chart-wrap"><canvas id="c"></canvas></div>
<script>
new Chart(document.getElementById('c'),{type:'doughnut',
data:{labels:['Emergency','Planned','Routine','Urgent'],
datasets:[{data:[2036,2005,11003,4956],backgroundColor:['${C.red}','${C.violet}','${C.blue}','${C.amber}'],
borderWidth:2,borderColor:'${C.white}'}]},
options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:10}},
tooltip:{callbacks:{label:function(c){let t=c.dataset.data.reduce((a,b)=>a+b,0);
return c.label+': '+c.raw.toLocaleString()+' ('+(c.raw/t*100).toFixed(1)+'%)'}}}}}});
<\/script></body></html>`;

const TILE_HTML_TOP_TRADES = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Top Trades</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:16px}
.title{font-size:15px;font-weight:700;color:${C.heading};margin-bottom:12px;text-align:center}canvas{width:100%!important}</style>
</head><body>
<div class="title">Job Tickets by Trade (Top 7)</div>
<canvas id="c"></canvas>
<script>
new Chart(document.getElementById('c'),{type:'bar',
data:{labels:['General','Plumbing','Electrical','Carpentry','Roofing','Plastering','Gas'],
datasets:[{label:'Lines',data:[6606,6408,6403,5837,5251,5020,4287],
backgroundColor:['${C.blue}','${C.emerald}','${C.amber}','${C.violet}','${C.red}','${C.teal}','${C.indigo}'],
borderRadius:5,barPercentage:.7}]},
options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},
scales:{x:{grid:{display:false}},y:{grid:{display:false}}}}});
<\/script></body></html>`;

const TILE_HTML_KPI_CARDS = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KPI Summary</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:20px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.card{background:${C.white};border-radius:10px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card .label{font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.card .value{font-size:26px;font-weight:800;color:${C.heading}}
.card .delta{font-size:12px;margin-top:4px}
.up{color:${C.emerald}}.down{color:${C.red}}</style>
</head><body>
<div class="grid">
<div class="card"><div class="label">Completion Rate</div><div class="value">94.2%</div><div class="delta up">▲ 2.1% vs last month</div></div>
<div class="card"><div class="label">Avg Response Time</div><div class="value">1.4 hrs</div><div class="delta up">▲ 12% faster</div></div>
<div class="card"><div class="label">First-Time Fix</div><div class="value">78.6%</div><div class="delta down">▼ 0.8% vs last month</div></div>
<div class="card"><div class="label">Jobs Issued</div><div class="value">3,241</div><div class="delta up">▲ 5.4% vs last month</div></div>
</div>
</body></html>`;

const TILE_HTML_TREND = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Weekly Trend</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:16px}
.title{font-size:15px;font-weight:700;color:${C.heading};margin-bottom:12px;text-align:center}canvas{width:100%!important}</style>
</head><body>
<div class="title">Weekly Job Volume — 12 Weeks</div>
<canvas id="c"></canvas>
<script>
new Chart(document.getElementById('c'),{type:'line',
data:{labels:['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12'],
datasets:[{label:'Jobs',data:[810,785,920,870,905,950,880,960,1020,990,1045,1080],
borderColor:'${C.indigo}',backgroundColor:'rgba(99,102,241,.12)',fill:true,tension:.35,pointRadius:3}]},
options:{responsive:true,plugins:{legend:{display:false}},
scales:{y:{beginAtZero:false},x:{grid:{display:false}}}}});
<\/script></body></html>`;

const TILE_HTML_LIVE_FAULT_RATE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Fault Rate</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:20px}
.header{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.header h3{font-size:15px;font-weight:700;color:${C.heading}}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${C.greenBg};color:${C.green600}}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:${C.green600};animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.kpi{background:${C.white};border-radius:8px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.06);text-align:center}
.kpi .val{font-size:22px;font-weight:800;color:${C.heading}}.kpi .lbl{font-size:10px;color:${C.muted};text-transform:uppercase;margin-top:2px}
canvas{width:100%!important}</style>
</head><body>
<div class="header"><h3>Fault Rate Monitor</h3><span class="badge">LIVE</span></div>
<div class="kpi-row">
<div class="kpi"><div class="val">2.4%</div><div class="lbl">Current Rate</div></div>
<div class="kpi"><div class="val">1.8%</div><div class="lbl">24h Avg</div></div>
<div class="kpi"><div class="val" style="color:${C.green600}">↓ 0.3%</div><div class="lbl">Trend</div></div>
</div>
<canvas id="c"></canvas>
<script>
new Chart(document.getElementById('c'),{type:'line',
data:{labels:['6h ago','5h','4h','3h','2h','1h','Now'],
datasets:[{label:'Fault %',data:[3.1,2.8,2.6,2.9,2.4,2.2,2.4],
borderColor:'${C.red}',backgroundColor:'rgba(239,68,68,.08)',fill:true,tension:.3,pointRadius:4,pointBackgroundColor:'${C.red}'},
{label:'Target',data:[2.5,2.5,2.5,2.5,2.5,2.5,2.5],borderColor:'${C.slate300}',borderDash:[6,4],borderWidth:1,pointRadius:0}]},
options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:11},padding:10}}},
scales:{y:{beginAtZero:true,max:5,ticks:{callback:v=>v+'%'}},x:{grid:{display:false}}}}});
<\/script></body></html>`;

const TILE_HTML_STANDALONE_TABLE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contractor Leaderboard</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${C.bg};padding:16px}
h3{font-size:15px;font-weight:700;color:${C.heading};margin-bottom:12px;text-align:center}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 10px;background:${C.slate100};color:${C.slate500};font-weight:600;border-bottom:2px solid ${C.slate200}}
td{padding:8px 10px;border-bottom:1px solid ${C.slate100};color:${C.slate700}}
tr:hover td{background:${C.bg}}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.gold{background:${C.amberBg};color:${C.amberText}}.silver{background:${C.slate100};color:${C.slate500}}.bronze{background:${C.orangeBg};color:${C.orangeText}}</style>
</head><body>
<h3>Contractor Leaderboard — Q1 2026</h3>
<table>
<thead><tr><th>#</th><th>Contractor</th><th>Jobs</th><th>Completion</th><th>Rating</th></tr></thead>
<tbody>
<tr><td><span class="badge gold">1</span></td><td>Apex Repairs Ltd</td><td>412</td><td>96.8%</td><td>4.9 ★</td></tr>
<tr><td><span class="badge silver">2</span></td><td>Premier Maintenance Co</td><td>387</td><td>94.2%</td><td>4.7 ★</td></tr>
<tr><td><span class="badge bronze">3</span></td><td>Swift Fix Services</td><td>358</td><td>93.1%</td><td>4.6 ★</td></tr>
<tr><td>4</td><td>Reliable Works Group</td><td>321</td><td>91.5%</td><td>4.5 ★</td></tr>
<tr><td>5</td><td>CityWide Repairs</td><td>298</td><td>89.7%</td><td>4.3 ★</td></tr>
</tbody></table>
</body></html>`;

// =============================================================================
// Mock Tile Records
// =============================================================================

const MOCK_TILES: DashboardPaneData['tiles'] = [
  {
    tileId: 1,
    token: 'mock-tile-revenue',
    title: 'Monthly Revenue',
    description: 'Bar chart showing monthly revenue in £k for the current year',
    htmlContent: TILE_HTML_REVENUE,
    hasDataBindings: false,
    dataBindingContexts: null,
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-15T14:30:00Z',
  },
  {
    tileId: 2,
    token: 'mock-tile-priority',
    title: 'Work Orders by Priority',
    description: 'Doughnut chart showing priority distribution across all work orders',
    htmlContent: TILE_HTML_PRIORITY,
    hasDataBindings: false,
    dataBindingContexts: null,
    createdAt: '2026-03-02T10:00:00Z',
    updatedAt: '2026-03-16T11:00:00Z',
  },
  {
    tileId: 3,
    token: 'mock-tile-trades',
    title: 'Top Trades by Volume',
    description: 'Horizontal bar chart of job ticket lines by trade',
    htmlContent: TILE_HTML_TOP_TRADES,
    hasDataBindings: false,
    dataBindingContexts: null,
    createdAt: '2026-03-03T08:00:00Z',
    updatedAt: '2026-03-17T09:15:00Z',
  },
  {
    tileId: 4,
    token: 'mock-tile-kpi',
    title: 'KPI Summary Cards',
    description: 'Completion rate, response time, first-time fix, and jobs issued',
    htmlContent: TILE_HTML_KPI_CARDS,
    hasDataBindings: true,
    dataBindingContexts: 'RepairsKPIs',
    createdAt: '2026-03-04T11:00:00Z',
    updatedAt: '2026-04-01T16:45:00Z',
  },
  {
    tileId: 5,
    token: 'mock-tile-trend',
    title: 'Weekly Job Volume Trend',
    description: 'Line chart tracking 12-week job volume trend',
    htmlContent: TILE_HTML_TREND,
    hasDataBindings: false,
    dataBindingContexts: null,
    createdAt: '2026-03-10T13:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
  },
  {
    tileId: 6,
    token: 'mock-tile-leaderboard',
    title: 'Contractor Leaderboard',
    description: 'Top contractors ranked by job count, completion rate and rating',
    htmlContent: TILE_HTML_STANDALONE_TABLE,
    hasDataBindings: false,
    dataBindingContexts: null,
    createdAt: '2026-03-12T15:00:00Z',
    updatedAt: null,
  },
  {
    tileId: 7,
    token: 'mock-tile-fault-rate',
    title: 'Live Fault Rate Monitor',
    description: 'Real-time fault rate with 6-hour rolling window — data refreshes automatically',
    htmlContent: TILE_HTML_LIVE_FAULT_RATE,
    hasDataBindings: true,
    dataBindingContexts: 'FaultRateMetrics',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-07T12:30:00Z',
  },
];

// =============================================================================
// Mock Dashboard Records
// =============================================================================

const MOCK_DASHBOARDS: DashboardPaneData['dashboards'] = [
  {
    dashboardId: 1,
    token: 'mock-dash-ops',
    title: 'Operations Overview',
    description: 'Key operational metrics and work order breakdowns',
    layout: JSON.stringify([
      { tileToken: 'mock-tile-kpi', x: 0, y: 0, w: 12, h: 3 },
      { tileToken: 'mock-tile-priority', x: 0, y: 3, w: 6, h: 4 },
      { tileToken: 'mock-tile-trades', x: 6, y: 3, w: 6, h: 4 },
    ]),
    tileCount: 3,
    createdAt: '2026-03-05T09:00:00Z',
    updatedAt: '2026-04-01T17:00:00Z',
  },
  {
    dashboardId: 2,
    token: 'mock-dash-finance',
    title: 'Financial & Trends',
    description: 'Revenue tracking and volume trends',
    layout: JSON.stringify([
      { tileToken: 'mock-tile-revenue', x: 0, y: 0, w: 7, h: 4 },
      { tileToken: 'mock-tile-trend', x: 7, y: 0, w: 5, h: 4 },
    ]),
    tileCount: 2,
    createdAt: '2026-03-08T11:00:00Z',
    updatedAt: '2026-03-25T14:30:00Z',
  },
];

// =============================================================================
// Lazy-loading helpers (token -> full HTML)
// =============================================================================

const MOCK_TILE_HTML_MAP = new Map<string, string>(
  MOCK_TILES.filter((t) => t.htmlContent).map((t) => [t.token, t.htmlContent!])
);

// =============================================================================
// Public API
// =============================================================================

export function getMockDashboardData(): DashboardPaneData {
  return {
    dashboards: MOCK_DASHBOARDS,
    tiles: MOCK_TILES,
  };
}

/**
 * Returns mock metadata without htmlContent — simulates the lightweight
 * `getDashboardMetadata` server action that uses `from_fields` to exclude
 * the heavy HTML payload.
 */
export function getMockDashboardMetadata(): DashboardPaneData {
  return {
    dashboards: MOCK_DASHBOARDS,
    tiles: MOCK_TILES.map(({ htmlContent: _, ...rest }) => rest),
  };
}

/**
 * Simulates `getDashboardTileContent` by looking up the full HTML for a
 * given tile token from the mock data. Adds a 300ms delay to make the
 * loading skeleton visible during local testing.
 */
export function getMockTileContent(token: string): Promise<string | null> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(MOCK_TILE_HTML_MAP.get(token) ?? null), 300)
  );
}
