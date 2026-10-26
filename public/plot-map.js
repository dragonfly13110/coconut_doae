// ============================================================================
// plot-map.js — แผนที่พิกัดแปลงเกษตรกร (แบบที่ 1)
// Interactive Leaflet map for farmer plot coordinates.
//
// Uses the classic (global) Leaflet build + Leaflet.markercluster, both
// vendored locally under /vendor/leaflet/ (offline-first, field use).
// Loaded before the app module script, so `window.L` is always available.
//
// Coordinates in the DB are UTM Zone 47N (EPSG:32647) easting/northing.
// A self-contained transverse-Mercator (series expansion) conversion is
// implemented below — no external dependencies.
// ============================================================================

const MAP_CONTAINER_ID = 'chalPlotMap';

// Province palette — distinct but harmonised with the app's green/earth theme
const PROVINCE_COLORS = {
  ratchaburi: '#15803d',      // เขียวมะพร้าว
  nakhon_pathom: '#d97706',   // เหลืองอำพัน
  samut_sakhon: '#0369a1',    // น้ำทะเล
  samut_songkhram: '#be185d', // ชมพูอิฐ
};
const DEFAULT_COLOR = '#475569';

const HOME_VIEW = { lat: 13.55, lng: 100.05, zoom: 10 }; // ใจกลาง 4 จังหวัดเป้าหมาย

// ---------------------------------------------------------------------------
// UTM ↔ WGS84 conversion (zone 47N / northern hemisphere)
// Standard USGS / Wikipedia transverse-Mercator series — sub-metre accurate
// well within a single UTM zone, which is all we need (99°E–102°E).
// ---------------------------------------------------------------------------

const UTM_K0 = 0.9996;            // UTM scale factor
const UTM_A = 6378137.0;          // WGS84 semi-major axis
const UTM_E = 0.00669438;         // WGS84 first eccentricity squared
const UTM_E2 = UTM_E * UTM_E;
const UTM_E3 = UTM_E2 * UTM_E;
const UTM_EP2 = UTM_E / (1 - UTM_E); // second eccentricity squared

function parseUtmZone(value) {
  const m = String(value ?? '').match(/\d+/);
  const zone = m ? Number(m[0]) : 47;
  return zone >= 1 && zone <= 60 ? zone : 47;
}

/** UTM (easting, northing) → { lat, lng } in WGS84 degrees. */
function utmToLatLng(easting, northing, zone) {
  const x = easting - 500000; // strip false easting
  const y = northing;         // northern hemisphere: no false northing
  const e1 = (1 - Math.sqrt(1 - UTM_E)) / (1 + Math.sqrt(1 - UTM_E));

  // Footpoint latitude: μ = M / (a·(1 − e²/4 − 3e⁴/64 − 5e⁶/256)), M = y / k₀
  const mu = y / (UTM_K0 * UTM_A * (1 - UTM_E / 4 - 3 * UTM_E2 / 64 - 5 * UTM_E3 / 256));
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const n1 = UTM_A / Math.sqrt(1 - UTM_E * sinPhi1 * sinPhi1);
  const t1 = tanPhi1 * tanPhi1;
  const c1 = UTM_EP2 * cosPhi1 * cosPhi1;
  const r1 = UTM_A * (1 - UTM_E) / Math.pow(1 - UTM_E * sinPhi1 * sinPhi1, 1.5);
  const d = x / (n1 * UTM_K0);

  const lat = phi1 - (n1 * tanPhi1 / r1) * (
    d ** 2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * UTM_EP2) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * UTM_EP2 - 3 * c1 * c1) * d ** 6 / 720
  );
  const dLng = (
    d
    - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * UTM_EP2 + 24 * t1 * t1) * d ** 5 / 120
  ) / cosPhi1;

  return {
    lat: (lat * 180) / Math.PI,
    lng: zone * 6 - 183 + (dLng * 180) / Math.PI,
  };
}

/** WGS84 { lat, lng } → UTM (easting, northing) for the given zone (north). */
function latLngToUtm(lat, lng, zone) {
  const phi = (lat * Math.PI) / 180;
  const lambda = ((lng - (zone * 6 - 183)) * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n = UTM_A / Math.sqrt(1 - UTM_E * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = UTM_EP2 * cosPhi * cosPhi;
  const a = cosPhi * lambda;

  const m = UTM_A * (
    (1 - UTM_E / 4 - 3 * UTM_E2 / 64 - 5 * UTM_E3 / 256) * phi
    - (3 * UTM_E / 8 + 3 * UTM_E2 / 32 + 45 * UTM_E3 / 1024) * Math.sin(2 * phi)
    + (15 * UTM_E2 / 256 + 45 * UTM_E3 / 1024) * Math.sin(4 * phi)
    - (35 * UTM_E3 / 3072) * Math.sin(6 * phi)
  );

  const easting = UTM_K0 * n * (
    a + (1 - t + c) * a ** 3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * UTM_EP2) * a ** 5 / 120
  ) + 500000;
  const northing = UTM_K0 * (
    m + n * tanPhi * (
      a * a / 2
      + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24
      + (61 - 58 * t + t * t + 600 * c - 330 * UTM_EP2) * a ** 6 / 720
    )
  );
  return { easting, northing };
}

/** Treat null / 0 / NaN coordinates as "missing" (0,0 is never a real plot). */
function toCoord(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function plotToLatLng(plot) {
  const x = toCoord(plot.coord_x);
  const y = toCoord(plot.coord_y);
  if (x === null || y === null) return null;
  const { lat, lng } = utmToLatLng(x, y, parseUtmZone(plot.coord_zone));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function plotCornersToLatLngs(plot) {
  const zone = parseUtmZone(plot.coord_zone);
  const pts = [];
  for (let i = 1; i <= 4; i++) {
    const x = toCoord(plot[`coord_x${i}`]);
    const y = toCoord(plot[`coord_y${i}`]);
    if (x === null || y === null) return null; // all 4 corners required
    const { lat, lng } = utmToLatLng(x, y, zone);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    pts.push([lat, lng]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function provinceColor(code) {
  return PROVINCE_COLORS[code] || DEFAULT_COLOR;
}

function displayNameOf(plot) {
  return plot.full_name
    || `${plot.title || ''} ${plot.first_name || ''} ${plot.last_name || ''}`.trim()
    || 'ไม่ระบุชื่อ';
}

function addressOf(plot, provName) {
  if (plot.address) return plot.address;
  const parts = [];
  if (plot.address_no) parts.push(`เลขที่ ${plot.address_no}`);
  if (plot.street) parts.push(`ถ.${plot.street}`);
  if (plot.moo) parts.push(`หมู่ ${plot.moo}`);
  if (plot.subdistrict) parts.push(`ต.${plot.subdistrict}`);
  if (plot.district) parts.push(`อ.${plot.district}`);
  return parts.length > 0 ? parts.join(' ') : provName;
}

function fmtNum(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

/** Marker size scales with productive area (clamped for sanity). */
function markerSize(productiveAreaRai) {
  const area = Number(productiveAreaRai) || 0;
  return Math.round(Math.min(46, Math.max(26, 22 + Math.sqrt(Math.max(area, 0)) * 4)));
}

function plotMatchesSearch(plot, query) {
  if (!query) return true;
  const hay = [
    plot.full_name, plot.title, plot.first_name, plot.last_name,
    plot.plot_label, plot.subdistrict, plot.district, plot.moo,
    plot.province_name, resolveProvinceLabel(plot.province_code),
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(query);
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let map = null;
let clusterLayer = null;
let polygonLayer = null;
let labelsLayer = null;
let boundaryLayer = null;
let baseLayers = null;
let searchQuery = '';
let resolveProvinceLabel = (code) => code || '';
let legendEl = null;
let summaryEl = null;
let coordEl = null;
let emptyEl = null;
let hasFitted = false;

const state = {
  plots: [],        // plots passed in by the Form 1 table (already province-filtered)
  matched: 0,       // plots passing the free-text search
  withCoords: 0,    // plots actually drawn on the map
  missingCoords: 0, // plots skipped (no valid coordinates)
};

// ---------------------------------------------------------------------------
// Public API (wired from challenge.js)
// ---------------------------------------------------------------------------

/** Called once from initChallenge() — pre-warms the map instance. */
export function initPlotMap() {
  ensureMap();
  scheduleInvalidate();
}

/** Called from showChalTab('farmers') — fixes sizing after the panel un-hides. */
export function refreshPlotMap() {
  ensureMap();
  scheduleInvalidate();
}

/**
 * Called from renderFarmersTable() with the currently visible (province
 * filtered) plots so the map always mirrors the table.
 */
export function updatePlotMap(plots, provinceLabelResolver) {
  if (typeof provinceLabelResolver === 'function') {
    resolveProvinceLabel = provinceLabelResolver;
  }
  state.plots = Array.isArray(plots) ? plots : [];
  if (ensureMap()) {
    renderPlotLayers();
    updateSummary();
    updateLegend();
    scheduleInvalidate();
  }
}

// ---------------------------------------------------------------------------
// Map construction
// ---------------------------------------------------------------------------

function ensureMap() {
  if (map) return map;
  const container = document.getElementById(MAP_CONTAINER_ID);
  if (!container || !window.L) return null; // Leaflet vendored globally in index.html

  map = L.map(container, {
    center: [HOME_VIEW.lat, HOME_VIEW.lng],
    zoom: HOME_VIEW.zoom,
    preferCanvas: true,      // canvas renderer for vector layers (polygons)
    zoomControl: true,
    attributionControl: true,
    minZoom: 6,
    maxZoom: 19,
  });

  baseLayers = {
    '🗺️ แผนที่ถนน (OpenStreetMap)': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ผู้สนับสนุน',
    }),
    '🛰️ ภาพถ่ายดาวเทียม (Esri)': L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics' },
    ),
    '⛰️ แผนที่ภูมิประเทศ (Topo)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    }),
  };
  baseLayers['🗺️ แผนที่ถนน (OpenStreetMap)'].addTo(map);

  clusterLayer = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 55,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 16,
    iconCreateFunction: createClusterIcon,
  });
  polygonLayer = L.layerGroup();
  labelsLayer = L.layerGroup(); // off by default — toggle via layer control
  boundaryLayer = L.layerGroup(); // ขอบเขต 4 จังหวัดเป้าหมาย (เส้นบางๆ)

  clusterLayer.addTo(map);
  polygonLayer.addTo(map);
  boundaryLayer.addTo(map); // shown by default

  // Load province boundaries asynchronously (static GeoJSON, offline-friendly).
  loadProvinceBoundaries();

  L.control.layers(
    baseLayers,
    {
      '📍 จุดแปลงเกษตรกร': clusterLayer,
      '▭ ขอบเขตแปลง (ครบ 4 มุม)': polygonLayer,
      '🗺️ เส้นขอบเขตจังหวัด': boundaryLayer,
      '🏷️ ชื่อเกษตรกร (ซูมมากขึ้น)': labelsLayer,
    },
    { collapsed: true, position: 'topright' },
  ).addTo(map);

  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

  map.addControl(createSearchControl());
  map.addControl(createSummaryControl());
  map.addControl(createLegendControl());
  map.addControl(createCoordReadoutControl());
  map.addControl(createViewToolsControl());

  emptyEl = L.DomUtil.create('div', 'pm-empty');
  emptyEl.innerHTML = '<span>🗺️</span><p>ยังไม่มีแปลงที่มีพิกัดในมุมมองนี้<br><small>เพิ่มพิกัด UTM Zone 47N (X, Y) ในแบบฟอร์มที่ 1 เพื่อให้แปลงปรากฏบนแผนที่</small></p>';
  container.appendChild(emptyEl);

  map.on('mousemove', onMapMouseMove);
  map.on('zoomend', () => { if (labelsLayer && map.hasLayer(labelsLayer)) syncLabelZoom(); });
  // Re-apply the zoom gate when the label layer is toggled on/off
  map.on('overlayadd', (e) => { if (e.layer === labelsLayer) syncLabelZoom(); });

  // Safety net: the Form 1 panel starts hidden — Leaflet computes a 0×0 size
  // when initialised inside it. ResizeObserver fires the moment the panel
  // becomes visible (0×0 → real size), and refreshPlotMap() re-runs
  // invalidateSize() whenever the tab is (re)shown. Belt and braces.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (map && isContainerVisible()) map.invalidateSize({ animate: false });
    }).observe(container);
  }

  return map;
}

function isContainerVisible() {
  const el = document.getElementById(MAP_CONTAINER_ID);
  return Boolean(el && el.offsetParent !== null);
}

// ---------------------------------------------------------------------------
// Province boundaries (4 target provinces) — thin overlay lines
// ---------------------------------------------------------------------------
// Static GeoJSON (public/data/thailand-provinces-west.geojson), pre-filtered to
// the 4 target provinces at build time so we ship a ~2KB file instead of the
// whole-country dataset. Loaded once and cached.
const BOUNDARY_GEOJSON_URL = '/data/thailand-provinces-west.geojson';
let boundaryLoadPromise = null;

function loadProvinceBoundaries() {
  if (!boundaryLayer || !map) return;
  if (boundaryLoadPromise) return boundaryLoadPromise;

  boundaryLoadPromise = fetch(BOUNDARY_GEOJSON_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((geojson) => {
      if (!boundaryLayer || !map) return;
      boundaryLayer.clearLayers();
      L.geoJSON(geojson, {
        // Thin, unobtrusive outline — the plots are the stars, not the borders.
        style: {
          color: '#0f766e',       // teal — reads as "admin boundary", distinct
          weight: 1.2,            // hairline
          opacity: 0.7,
          fill: false,            // outline only, never fill the province
          dashArray: '6 4',       // subtle dash so it doesn't compete with roads
          interactive: true,      // allow hover tooltip
        },
        // Keep these lines under the plot markers/polys but above the base map.
        renderer: L.canvas({ padding: 0.5 }),
      })
        .eachLayer((layer) => {
          const name = layer.feature?.properties?.name_en || 'จังหวัด';
          layer.bindTooltip(name, {
            sticky: true,
            direction: 'top',
            className: 'pm-boundary-tooltip',
          });
        })
        .addTo(boundaryLayer);
    })
    .catch(() => {
      // Non-fatal: the map still works without boundary lines.
      // Silently ignore (e.g. offline / file missing).
    });

  return boundaryLoadPromise;
}

function scheduleInvalidate() {
  if (!map) return;
  // Double rAF: let the browser finish un-hiding/relayout before measuring.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!map) return;
    if (isContainerVisible()) {
      map.invalidateSize({ animate: false });
      if (!hasFitted && state.withCoords > 0) fitToPlots();
    }
  }));
}

function fitToPlots() {
  if (!map) return;
  const points = [];
  clusterLayer.eachLayer((l) => { if (l.getLatLng) points.push(l.getLatLng()); });
  if (points.length === 0) {
    map.setView([HOME_VIEW.lat, HOME_VIEW.lng], HOME_VIEW.zoom);
    return;
  }
  hasFitted = true;
  map.fitBounds(L.latLngBounds(points), { padding: [46, 46], maxZoom: 15 });
}

// ---------------------------------------------------------------------------
// Rendering plots (markers, polygons, labels)
// ---------------------------------------------------------------------------

function renderPlotLayers() {
  if (!map) return;
  clusterLayer.clearLayers();
  polygonLayer.clearLayers();
  labelsLayer.clearLayers();

  const markers = [];
  state.matched = 0;
  state.withCoords = 0;
  state.missingCoords = 0;

  state.plots.forEach((plot) => {
    if (!plotMatchesSearch(plot, searchQuery)) return;
    state.matched += 1;

    const ll = plotToLatLng(plot);
    if (!ll) { state.missingCoords += 1; return; }
    state.withCoords += 1;

    const color = provinceColor(plot.province_code);
    const size = markerSize(plot.productive_area_rai);

    const marker = L.marker([ll.lat, ll.lng], {
      icon: buildPinIcon(color, size),
      riseOnHover: true,
      keyboard: false,
      plotProvince: plot.province_code, // consumed by iconCreateFunction()
    });
    marker.bindTooltip(buildTooltipHtml(plot, color), {
      direction: 'top',
      sticky: true,
      opacity: 1,
      className: 'pm-tooltip',
    });
    marker.bindPopup(buildPopupHtml(plot, color), {
      className: 'pm-popup',
      maxWidth: 340,
      minWidth: 250,
      closeButton: true,
    });
    markers.push(marker);

    const corners = plotCornersToLatLngs(plot);
    if (corners) {
      L.polygon(corners, {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.18,
        smoothFactor: 1,
      }).addTo(polygonLayer);
    }

    // Name label (permanent tooltip-style div, toggled via layer control)
    L.marker([ll.lat, ll.lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'pm-label-icon',
        html: `<span style="--pin:${color}">${escapeHtml(displayNameOf(plot))}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }).addTo(labelsLayer);
  });

  clusterLayer.addLayers(markers);
  syncLabelZoom();
  updateEmptyState();
}

function buildPinIcon(color, size) {
  return L.divIcon({
    className: 'pm-pin-wrap',
    html: `<div class="pm-pin" style="--pin:${color}; width:${size}px; height:${size}px;">
             <span class="pm-pin-emoji">🥥</span>
           </div>`,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 4)],
    tooltipAnchor: [0, -(size + 6)],
  });
}

function buildTooltipHtml(plot, color) {
  const name = escapeHtml(displayNameOf(plot));
  const label = escapeHtml(plot.plot_label || 'แปลง');
  const prov = escapeHtml(resolveProvinceLabel(plot.province_code));
  const rows = [
    ['พื้นที่ให้ผลผลิต', `${fmtNum(plot.productive_area_rai)} ไร่`],
    ['ต้น/ไร่', plot.trees_per_rai ? `${escapeHtml(plot.trees_per_rai)} ต้น` : '-'],
    ['อายุต้น', plot.plant_age_years ? `${escapeHtml(plot.plant_age_years)} ปี` : '-'],
    ['ชุดดิน', escapeHtml(plot.soil_series || '-')],
    ['มาตรฐาน', escapeHtml(plot.production_standard || '-')],
  ];
  return `<div class="pm-tip" style="--pin:${color}">
    <div class="pm-tip-head"><span class="pm-tip-dot"></span><strong>${name}</strong></div>
    <div class="pm-tip-sub">${label} · ${prov}</div>
    <div class="pm-tip-grid">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>
  </div>`;
}

function buildPopupHtml(plot, color) {
  const id = Number(plot.id) || 0;
  const name = escapeHtml(displayNameOf(plot));
  const label = escapeHtml(plot.plot_label || 'แปลง');
  const prov = escapeHtml(resolveProvinceLabel(plot.province_code));
  const addr = escapeHtml(addressOf(plot, prov));
  const phone = escapeHtml(plot.phone || '-');
  const age = plot.age ? `${escapeHtml(plot.age)} ปี` : '-';
  const zone = escapeHtml(plot.coord_zone || '47');
  const x = toCoord(plot.coord_x);
  const y = toCoord(plot.coord_y);
  const coordText = x !== null && y !== null
    ? `Zone ${zone} · X ${x.toFixed(0)} · Y ${y.toFixed(0)}`
    : 'ยังไม่บันทึกพิกัด';
  const rows = [
    ['📞 โทรศัพท์', phone],
    ['🏠 ที่อยู่', addr],
    ['👤 อายุ', age],
    ['🌱 พื้นที่ปลูก', `${fmtNum(plot.total_area_rai)} ไร่`],
    ['🥥 พื้นที่ให้ผลผลิต', `<b>${fmtNum(plot.productive_area_rai)} ไร่</b>`],
    ['🌳 ต้น/ไร่', plot.trees_per_rai ? `${escapeHtml(plot.trees_per_rai)} ต้น` : '-'],
    ['⏳ อายุต้น', plot.plant_age_years ? `${escapeHtml(plot.plant_age_years)} ปี` : '-'],
    ['🏷️ มาตรฐาน', escapeHtml(plot.production_standard || '-')],
    ['🪨 ชุดดิน', escapeHtml(plot.soil_series || '-')],
    ['💰 ต้นทุน/ไร่', `${fmtNum(plot.production_cost_per_rai)} บ.`],
    ['📈 รายได้/ไร่', `${fmtNum(plot.avg_income_per_rai)} บ.`],
  ];
  return `<div class="pm-pop" style="--pin:${color}">
    <div class="pm-pop-head">
      <span class="pm-pop-dot"></span>
      <div>
        <strong>${name}</strong>
        <div class="pm-pop-sub">${label} · ${prov}</div>
      </div>
    </div>
    <div class="pm-pop-coord">📍 ${coordText}</div>
    <div class="pm-pop-grid">${rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('')}</div>
    <div class="pm-pop-actions">
      <button type="button" onclick="window.chalEditPlot(${id})">✏️ แก้ไข</button>
      <button type="button" onclick="window.chalGoForecast(${id})">🎯 คาดการณ์</button>
      <button type="button" onclick="window.chalGoHarvest(${id})">🥥 รอบตัด</button>
      <button type="button" onclick="window.chalViewOfficialForm(${id})">📄 แบบฟอร์ม</button>
    </div>
  </div>`;
}

function createClusterIcon(cluster) {
  const childMarkers = cluster.getAllChildMarkers();
  const counts = {};
  childMarkers.forEach((mk) => {
    const pc = mk.options.plotProvince || 'other';
    counts[pc] = (counts[pc] || 0) + 1;
  });
  let dominant = null;
  let best = 0;
  Object.entries(counts).forEach(([code, n]) => {
    if (n > best) { best = n; dominant = code; }
  });
  const count = cluster.getChildCount();
  const size = count < 10 ? 42 : count < 25 ? 50 : count < 60 ? 58 : 66;
  return L.divIcon({
    html: `<div class="pm-cluster" style="--pin:${provinceColor(dominant)}; width:${size}px; height:${size}px;"><span>${count}</span></div>`,
    className: 'pm-cluster-wrap',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function updateEmptyState() {
  if (!emptyEl) return;
  let message = '';
  if (state.matched === 0 && searchQuery) {
    message = '<span>🔍</span><p>ไม่พบแปลงที่ค้นหา<br><small>ลองค้นหาด้วยชื่อเกษตรกร ชื่อแปลง หรืออำเภอ</small></p>';
  } else if (state.matched > 0 && state.withCoords === 0) {
    message = '<span>🗺️</span><p>ยังไม่มีแปลงที่มีพิกัด<br><small>เพิ่มพิกัดในแบบฟอร์มที่ 1 (Zone 47N · X · Y) เพื่อให้แปลงปรากฏบนแผนที่</small></p>';
  }
  emptyEl.innerHTML = message;
  emptyEl.classList.toggle('visible', Boolean(message));
}

function syncLabelZoom() {
  // Labels are only legible when zoomed in — hide them below zoom 13.
  if (!map || !labelsLayer) return;
  const show = map.getZoom() >= 13;
  labelsLayer.eachLayer((l) => {
    const el = l.getElement && l.getElement();
    if (el) el.classList.toggle('pm-label-hidden', !show);
  });
}

// ---------------------------------------------------------------------------
// Custom controls
// ---------------------------------------------------------------------------

function createSearchControl() {
  return L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const div = L.DomUtil.create('div', 'pm-control pm-search');
      div.innerHTML = '<span class="pm-search-icon">🔍</span>'
        + '<input type="search" placeholder="ค้นหา: ชื่อ / แปลง / อำเภอ" autocomplete="off" aria-label="ค้นหาแปลงบนแผนที่">';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const input = div.querySelector('input');
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          searchQuery = input.value.trim().toLowerCase();
          renderPlotLayers();
          updateSummary();
          updateLegend();
        }, 150);
      });
      return div;
    },
  });
}

function createSummaryControl() {
  return L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      summaryEl = L.DomUtil.create('div', 'pm-control pm-summary');
      L.DomEvent.disableClickPropagation(summaryEl);
      L.DomEvent.disableScrollPropagation(summaryEl);
      summaryEl.innerHTML = '<span class="pm-summary-loading">กำลังเตรียมแผนที่…</span>';
      return summaryEl;
    },
  });
}

function updateSummary() {
  if (!summaryEl) return;
  let totalRai = 0;
  state.plots.forEach((plot) => {
    if (!plotMatchesSearch(plot, searchQuery)) return;
    if (!plotToLatLng(plot)) return;
    totalRai += Number(plot.productive_area_rai) || 0;
  });
  const missingNote = state.missingCoords > 0
    ? `<div class="pm-summary-missing">⚠️ ไม่มีพิกัด ${state.missingCoords} แปลง (ข้าม)</div>`
    : '';
  summaryEl.innerHTML = `
    <div class="pm-summary-title">📊 ภาพรวมในแผนที่</div>
    <div class="pm-summary-line">แสดง <b>${state.withCoords}</b> / ${state.matched} แปลง</div>
    <div class="pm-summary-line">พื้นที่ให้ผลผลิตรวม <b>${fmtNum(Math.round(totalRai * 100) / 100)}</b> ไร่</div>
    ${missingNote}
  `;
}

function createLegendControl() {
  return L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      legendEl = L.DomUtil.create('div', 'pm-control pm-legend');
      L.DomEvent.disableClickPropagation(legendEl);
      L.DomEvent.disableScrollPropagation(legendEl);
      return legendEl;
    },
  });
}

function updateLegend() {
  if (!legendEl) return;
  const counts = {};
  state.plots.forEach((plot) => {
    if (!plotMatchesSearch(plot, searchQuery)) return;
    if (!plotToLatLng(plot)) return;
    counts[plot.province_code] = (counts[plot.province_code] || 0) + 1;
  });
  const entries = Object.keys(PROVINCE_COLORS).map((code) => {
    const label = escapeHtml(resolveProvinceLabel(code));
    const n = counts[code] || 0;
    return `<div class="pm-legend-row ${n === 0 ? 'is-empty' : ''}">
      <span class="pm-legend-swatch" style="--pin:${PROVINCE_COLORS[code]}"></span>
      <span class="pm-legend-label">${label}</span>
      <b class="pm-legend-count">${n}</b>
    </div>`;
  }).join('');
  legendEl.innerHTML = `<div class="pm-legend-title">สีตามจังหวัด</div>${entries}`;
}

function createCoordReadoutControl() {
  return L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd() {
      coordEl = L.DomUtil.create('div', 'pm-control pm-coords');
      coordEl.innerHTML = '<span class="pm-coords-hint">เลื่อนเมาส์บนแผนที่เพื่อดูพิกัด</span>';
      L.DomEvent.disableClickPropagation(coordEl);
      L.DomEvent.disableScrollPropagation(coordEl);
      return coordEl;
    },
  });
}

let coordFrame = null;
function onMapMouseMove(e) {
  if (!coordEl) return;
  if (coordFrame) return; // rAF-throttle: at most one DOM write per frame
  coordFrame = requestAnimationFrame(() => {
    coordFrame = null;
    if (!coordEl) return;
    const utm = latLngToUtm(e.latlng.lat, e.latlng.lng, 47);
    coordEl.innerHTML = `<span class="pm-coords-geo">🌐 ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</span>`
      + `<span class="pm-coords-utm">📐 UTM 47N — X ${utm.easting.toFixed(1)} / Y ${utm.northing.toFixed(1)}</span>`;
  });
}

function createViewToolsControl() {
  return L.Control.extend({
    options: { position: 'bottomright' },
    onAdd() {
      const div = L.DomUtil.create('div', 'pm-control pm-view-tools');
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      div.innerHTML = `
        <button type="button" class="pm-tool-btn" data-act="fit" title="ปรับมุมมองให้เห็นทุกแปลง">⟳ แสดงทุกแปลง</button>
        <button type="button" class="pm-tool-btn" data-act="fullscreen" title="ขยายแผนที่เต็มจอ">⛶ เต็มจอ</button>
      `;
      div.querySelector('[data-act="fit"]').addEventListener('click', () => fitToPlots());
      div.querySelector('[data-act="fullscreen"]').addEventListener('click', (ev) => {
        const container = document.getElementById(MAP_CONTAINER_ID);
        if (!container) return;
        container.classList.toggle('pm-fullscreen');
        const btn = ev.currentTarget;
        btn.textContent = container.classList.contains('pm-fullscreen') ? '✕ ออกจากเต็มจอ' : '⛶ เต็มจอ';
        setTimeout(() => { if (map) map.invalidateSize({ animate: false }); }, 220);
      });
      return div;
    },
  });
}
