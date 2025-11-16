/* Diriyah Security Map – v15.0 (Express backend + is.gd + interactive share + clean) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;

function tryBoot() {
  if (__BOOTED__) return true;
  if (window.google && google.maps && document.readyState !== 'loading') {
    __BOOTED__ = true;
    boot();
    return true;
  }
  return false;
}

window.initMap = function () { tryBoot(); };

document.addEventListener('DOMContentLoaded', () => {
  let n = 0, iv = setInterval(() => { if (tryBoot() || ++n > 60) clearInterval(iv); }, 250);
}, { passive: true });

window.addEventListener('load', tryBoot, { once: true, passive: true });

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tryBoot();
  else flushPersist();
}, { passive: true });

/* ---------------- Throttle Function ---------------- */
function throttle(fn, ms) {
  let last = 0, timer = null, pendingArgs = null;
  return function (...args) {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn.apply(this, args);
    } else {
      pendingArgs = args;
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = performance.now();
        fn.apply(this, pendingArgs);
        pendingArgs = null;
      }, ms - (now - last));
    }
  };
}

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin = null;
let editMode = true, shareMode = false, cardPinned = false, addMode = false;
let btnTraffic, btnShare, btnAdd, btnRoute, btnRouteClear;
let btnRoadmap, btnSatellite, btnEdit;
let modeBadge, toast;
let toastTimer = null;

/* Route globals */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;
let routeInfoWin = null;

/* Route information */
let routeDistance = 0;
let routeDuration = 0;

/* Hover state */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

function scheduleCardHide() {
  clearTimeout(cardHideTimer);
  if (cardPinned) return;
  cardHideTimer = setTimeout(() => {
    if (!cardPinned && !cardHovering && !circleHovering && infoWin) {
      infoWin.close();
    }
  }, 120);
}

/* Defaults */
const DEFAULT_CENTER = { lat: 24.7399, lng: 46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND = 'pin';
const BASE_ZOOM = 15;

/* Route style */
let routeStyle = {
  color: '#3344ff',
  weight: 4,
  opacity: 0.95
};

/* Default locations */
const LOCATIONS = [
  { id: 0, name: "بوابة سمحان", lat: 24.742132284177778, lng: 46.569503913805825 },
  { id: 1, name: "منطقة سمحان", lat: 24.74091335108621, lng: 46.571891407130025 },
  { id: 2, name: "دوار البجيري", lat: 24.737521801476476, lng: 46.57406918772067 },
  { id: 3, name: "إشارة البجيري", lat: 24.73766260194535, lng: 46.575429040147306 },
  { id: 4, name: "طريق الملك فيصل", lat: 24.736133848943062, lng: 46.57696607050239 },
  { id: 5, name: "نقطة فرز الشلهوب", lat: 24.73523670533632, lng: 46.57785639752234 },
  { id: 6, name: "المسار الرياضي المديد", lat: 24.735301077804944, lng: 46.58178092599035 },
  { id: 7, name: "ميدان الملك سلمان", lat: 24.73611373368281, lng: 46.58407097038162 },
  { id: 8, name: "دوار الضوء الخافت", lat: 24.739718342668006, lng: 46.58352614787052 },
  { id: 9, name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347 },
  { id: 10, name: "دوار البلدية", lat: 24.739266101368777, lng: 46.58172727078356 },
  { id: 11, name: "مدخل ساحة البلدية الفرعي", lat: 24.738638518378387, lng: 46.579858026042785 },
  { id: 12, name: "مدخل مواقف البجيري (كار بارك)", lat: 24.73826438056506, lng: 46.57789576275729 },
  { id: 13, name: "مواقف الامن", lat: 24.73808736962705, lng: 46.57771858346317 },
  { id: 14, name: "دوار الروقية", lat: 24.741985907266145, lng: 46.56269186990043 },
  { id: 15, name: "بيت مبارك", lat: 24.732609768937607, lng: 46.57827089439368 },
  { id: 16, name: "دوار وادي صفار", lat: 24.72491458984474, lng: 46.57345489743978 },
  { id: 17, name: "دوار راس النعامة", lat: 24.710329841152387, lng: 46.572921959358204 },
  { id: 18, name: "مزرعة الحبيب", lat: 24.709445443672344, lng: 46.593971867951346 },
];

/* SVG icons */
const MARKER_KINDS = [
  { id: 'pin',    label: 'دبوس عام',        svg: pinSvg('#ea4335') },
  { id: 'guard',  label: 'رجل أمن',         svg: guardSvg('#4285f4') },
  { id: 'patrol', label: 'دورية أمنية',     svg: patrolSvg('#34a853') },
  { id: 'camera', label: 'كاميرا مراقبة',   svg: cameraSvg('#fbbc04') },
  { id: 'gate',   label: 'بوابة',           svg: gateSvg('#9aa0a6') },
  { id: 'meet',   label: 'نقطة تجمع',       svg: meetSvg('#e94235') },
];

function pinSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

function guardSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`;
}

function patrolSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`;
}

function cameraSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`;
}

function gateSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`;
}

function meetSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;
}

/* utilities */
const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* convert rgba → hex */
const toHex = (c) => {
  if (!c) return DEFAULT_COLOR;
  if (/^#/.test(c)) return c;
  const m = c && c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return DEFAULT_COLOR;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
};

/* parse recipients */
const parseRecipients = t => String(t)
  .split(/\r?\n/)
  .map(s => s.replace(/[،;،,]+/g, ' ').trim())
  .filter(Boolean);

/* ---------------- Share state (short) ---------------- */

let persistTimer = null;

const persist = () => {
  if (shareMode) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    writeShare(buildState());
  }, 300);
};

function flushPersist() {
  if (shareMode) return;
  clearTimeout(persistTimer);
  writeShare(buildState());
}

/* Base64URL — encode */
function b64uEncode(s) {
  try {
    const bytes = new TextEncoder().encode(s);
    const binary = String.fromCharCode.apply(null, bytes);
    const b = btoa(binary);
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('Base64 encoding error:', e);
    return '';
  }
}

/* Base64URL — decode */
function b64uDecode(t) {
  try {
    t = String(t || '').replace(/[^A-Za-z0-9\-_]/g, '');
    const pad = t.length % 4 ? '='.repeat(4 - (t.length % 4)) : '';
    const binary = atob(t.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (e) {
    console.error('Base64 decoding error:', e);
    return '';
  }
}

/* Read state from ?x= */
function readShare() {
  const params = new URLSearchParams(location.search);
  const h = params.get('x');
  if (!h) return null;

  try {
    const decoded = b64uDecode(h);
    if (!decoded) return null;
    const s = JSON.parse(decoded);
    return s;
  } catch (e) {
    console.error('Share state parse error:', e);
    return null;
  }
}

/* build compact state to minimize length */
const circles = [];

function buildState() {
  if (!map) return null;

  const center = map.getCenter();
  const zoom = map.getZoom();
  const typeId = map.getMapTypeId();
  const trafficOn = btnTraffic && btnTraffic.getAttribute('aria-pressed') === 'true';

  const st = {
    v: 2, /* version */
    c: [ +center.lat().toFixed(6), +center.lng().toFixed(6) ],
    z: zoom,
    t: typeId,
    tr: trafficOn ? 1 : 0,
    loc: [],
    r: null
  };

  circles.forEach((it) => {
    const pos = it.marker.getPosition();
    const circle = it.circle;
    const m = it.meta;

    st.loc.push([
      +pos.lat().toFixed(6),                 // 0 lat
      +pos.lng().toFixed(6),                 // 1 lng
      Math.round(circle.getRadius()),        // 2 radius
      toHex(circle.get('fillColor')),        // 3 color
      m.name || it.defaultName || '',        // 4 name
      m.kind || DEFAULT_MARKER_KIND,         // 5 kind
      +(m.scale || DEFAULT_MARKER_SCALE),    // 6 scale
      it.fixed ? 1 : 0,                      // 7 fixed flag
      m.recipients || []                     // 8 recipients array
    ]);
  });

  if (currentRouteOverview || routePoints.length) {
    st.r = {
      o: currentRouteOverview || null,
      p: routePoints.map(p => ({
        lat: +p.lat().toFixed(6),
        lng: +p.lng().toFixed(6)
      })),
      s: {
        c: routeStyle.color,
        w: routeStyle.weight,
        o: routeStyle.opacity
      },
      d: routeDistance,
      u: routeDuration
    };
  }

  return st;
}

/* write compact state into ?x=... using history.replaceState */
function writeShare(st) {
  if (!st) return;
  try {
    const json = JSON.stringify(st);
    const encoded = b64uEncode(json);
    const base = location.origin + location.pathname;
    const url = base + '?x=' + encoded;
    history.replaceState(null, '', url);
  } catch (e) {
    console.error('writeShare error:', e);
  }
}

/* restore from state */
function applyState(st) {
  if (!map || !st) return;

  try {
    if (Array.isArray(st.c) && st.c.length === 2) {
      map.setCenter({ lat: st.c[0], lng: st.c[1] });
    }
    if (typeof st.z === 'number') map.setZoom(st.z);
    if (st.t) map.setMapTypeId(st.t);

    if (st.tr && btnTraffic) {
      trafficLayer.setMap(map);
      btnTraffic.setAttribute('aria-pressed', 'true');
    }

    if (Array.isArray(st.loc)) {
      st.loc.forEach((entry, idx) => {
        const [lat, lng, radius, color, name, kind, scale, fixedFlag, recips] = entry;
        let item;

        if (idx < circles.length) {
          item = circles[idx];
          item.marker.setPosition({ lat, lng });
          item.circle.setCenter({ lat, lng });
        } else {
          const data = {
            id: 'sx' + Date.now() + '_' + idx,
            name: name || 'نقطة',
            lat,
            lng,
            fixed: !!fixedFlag
          };
          const marker = createMarker(data);
          const circle = createCircle(data);
          item = {
            id: data.id,
            marker,
            circle,
            fixed: !!fixedFlag,
            defaultName: name || data.name,
            meta: {
              name: name || data.name,
              kind: kind || DEFAULT_MARKER_KIND,
              scale: scale || DEFAULT_MARKER_SCALE,
              recipients: Array.isArray(recips) ? recips : []
            }
          };
          attachListeners(item);
          circles.push(item);
        }

        item.circle.setOptions({
          radius: radius || DEFAULT_RADIUS,
          strokeColor: color || DEFAULT_COLOR,
          fillColor: color || DEFAULT_COLOR,
          fillOpacity: DEFAULT_FILL_OPACITY
        });

        item.meta.name = name || item.meta.name;
        item.meta.kind = kind || item.meta.kind;
        item.meta.scale = scale || item.meta.scale;
        item.meta.recipients = Array.isArray(recips) ? recips : [];

        const iconColor = color || DEFAULT_MARKER_COLOR;
        item.marker.setIcon(buildMarkerIcon(iconColor, item.meta.scale, item.meta.kind));
      });
    }

    if (st.r) {
      const rs = st.r;
      const style = rs.s ? {
        color: rs.s.c || routeStyle.color,
        weight: rs.s.w || routeStyle.weight,
        opacity: rs.s.o || routeStyle.opacity
      } : null;

      restoreRouteFromOverview(
        rs.o || null,
        Array.isArray(rs.p) ? rs.p : null,
        style,
        rs.d || 0,
        rs.u || 0
      );
    }
  } catch (e) {
    console.error('applyState error:', e);
  }
}

/* Format distance/time Arabic */
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} متر`;
  return `${(meters / 1000).toFixed(1)} كم`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours} ساعة` : `${hours} ساعة و ${rem} دقيقة`;
}

/* SVG icon builder (marker scaling based on zoom) */
function buildMarkerIcon(color, userScale, kindId) {
  const currentZoom = (map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale || DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;

  const kind = MARKER_KINDS.find(k => k.id === kindId) || MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/, `fill="${color || DEFAULT_MARKER_COLOR}"`);
  const encoded = 'image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

  return {
    url: encoded,
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(Math.round(w / 2), Math.round(h))
  };
}

/* ---------------- Route helpers ---------------- */
function ensureDirections() {
  if (!directionsService)
    directionsService = new google.maps.DirectionsService();

  if (!directionsRenderer) {
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { ...routeStyle },
      map
    });
  }
}

function createStopMarker(position, index) {
  const m = new google.maps.Marker({
    position,
    map,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: routeStyle.color,
      strokeWeight: 2
    },
    label: { text: String(index + 1), color: routeStyle.color, fontSize: '11px', fontWeight: '700' },
    clickable: true,
    draggable: !shareMode
  });

  m.addListener('dragend', () => {
    routePoints[index] = m.getPosition();
    requestAndRenderRoute();
    persist();
  });

  m.addListener('rightclick', () => {
    if (shareMode) return;
    removeRoutePoint(index);
  });

  return m;
}

function clearRouteVisuals() {
  routeStopMarkers.forEach(m => m.setMap(null));
  routeStopMarkers = [];

  if (directionsRenderer)
    directionsRenderer.setDirections({ routes: [] });

  if (activeRoutePoly) {
    activeRoutePoly.setMap(null);
    activeRoutePoly = null;
  }

  if (routeInfoWin) {
    routeInfoWin.close();
    routeInfoWin = null;
  }
  if (routeCardWin) {
    routeCardWin.close();
    routeCardWin = null;
  }

  currentRouteOverview = null;
  routePoints = [];
  routeDistance = 0;
  routeDuration = 0;

  persist();
}

function addRoutePoint(latLng) {
  routePoints.push(latLng);
  const idx = routePoints.length - 1;

  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);

  if (routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    persist();
  }
}

function removeRoutePoint(idx) {
  if (idx < 0 || idx >= routePoints.length) return;

  routePoints.splice(idx, 1);

  if (routeStopMarkers[idx])
    routeStopMarkers[idx].setMap(null);

  routeStopMarkers.splice(idx, 1);

  routeStopMarkers.forEach((m, i) => {
    if (m.setLabel) {
      m.setLabel({
        text: String(i + 1),
        color: routeStyle.color,
        fontSize: '11px',
        fontWeight: '700'
      });
    }
  });

  if (routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    clearRouteVisuals();
  }
}

function requestAndRenderRoute() {
  if (!map) return;

  ensureDirections();

  if (routePoints.length < 2) {
    if (directionsRenderer)
      directionsRenderer.setDirections({ routes: [] });

    if (activeRoutePoly) {
      activeRoutePoly.setMap(null);
      activeRoutePoly = null;
    }

    if (routeInfoWin) {
      routeInfoWin.close();
      routeInfoWin = null;
    }

    currentRouteOverview = null;
    routeDistance = 0;
    routeDuration = 0;

    persist();
    return;
  }

  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));

  const req = {
    origin,
    destination,
    waypoints,
    travelMode: google.maps.TravelMode.DRIVING,
    optimizeWaypoints: false
  };

  directionsService.route(req, (result, status) => {
    if (status === 'OK' && result) {
      directionsRenderer.setDirections(result);
      const r = result.routes?.[0];

      /* distance + duration */
      if (r?.legs && r.legs.length > 0) {
        routeDistance = r.legs.reduce((t, leg) => t + (leg.distance?.value || 0), 0);
        routeDuration = r.legs.reduce((t, leg) => t + (leg.duration?.value || 0), 0);
      }

      currentRouteOverview = r?.overview_polyline?.points || null;

      setTimeout(() => {
        extractActivePolyline();
      }, 0);

      flushPersist();
    } else {
      showToast('تعذر حساب المسار: ' + status);
      persist();
    }
  });
}

function extractActivePolyline() {
  if (!directionsRenderer) return;

  const dir = directionsRenderer.getDirections();
  if (!dir?.routes?.[0]) return;

  const path = dir.routes[0].overview_path;
  if (!path?.length) return;

  if (activeRoutePoly)
    activeRoutePoly.setMap(null);

  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997,
    clickable: true
  });

  activeRoutePoly.addListener('click', e => {
    if (shareMode || !editMode) return;
    openRouteCard(e.latLng);
  });

  activeRoutePoly.addListener('mouseover', () => {
    if (shareMode || !editMode) return;
    document.body.style.cursor = 'pointer';
  });

  activeRoutePoly.addListener('mouseout', () => {
    if (shareMode || !editMode) return;
    document.body.style.cursor = '';
  });

  flushPersist();
}

/* Restore route from saved shared state */
function restoreRouteFromOverview(polyStr, routePointsArray = null, routeStyleData = null, dist = 0, dur = 0) {
  clearRouteVisuals();

  if (routeStyleData) {
    routeStyle = {
      color: routeStyleData.color || routeStyleData.c || routeStyle.color,
      weight: routeStyleData.weight || routeStyleData.w || routeStyle.weight,
      opacity: routeStyleData.opacity || routeStyleData.o || routeStyle.opacity
    };
  }

  routeDistance = dist || 0;
  routeDuration = dur || 0;

  if (Array.isArray(routePointsArray) && routePointsArray.length > 0) {
    routePoints = routePointsArray.map(p => new google.maps.LatLng(p.lat, p.lng));
  }

  if (polyStr) {
    try {
      const path = google.maps.geometry.encoding.decodePath(polyStr);

      activeRoutePoly = new google.maps.Polyline({
        map,
        path,
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity,
        zIndex: 9997,
        clickable: true
      });

      currentRouteOverview = polyStr;

      activeRoutePoly.addListener('click', e => {
        if (shareMode || !editMode) return;
        openRouteCard(e.latLng);
      });

    } catch (e) {
      console.error('decode error', e);
    }
  }

  if (routePoints.length > 0) {
    routeStopMarkers = routePoints.map((pos, i) => {
      const m = new google.maps.Marker({
        position: pos,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: routeStyle.color,
          strokeWeight: 2
        },
        label: {
          text: String(i + 1),
          color: routeStyle.color,
          fontSize: '11px',
          fontWeight: '700'
        },
        draggable: !shareMode
      });

      m.addListener('dragend', () => {
        routePoints[i] = m.getPosition();
        requestAndRenderRoute();
        persist();
      });

      m.addListener('rightclick', () => {
        if (shareMode) return;
        removeRoutePoint(i);
      });

      return m;
    });
  }

  if (directionsRenderer) {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}

/* ---------------- Route Card UI ---------------- */

function openRouteCard(latLng) {
  if (shareMode) return;

  if (routeCardWin) routeCardWin.close();

  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0, -6)
  });

  routeCardWin.open({ map });
  routeCardPinned = true;

  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();
  });
}

function renderRouteCard() {
  const color   = routeStyle.color   || '#3344ff';
  const weight  = routeStyle.weight  || 4;
  const opacity = routeStyle.opacity || 0.95;

  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);

  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93);
                backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06);
                border-radius:18px;
                padding:14px;
                color:#111;">
      
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <img src="img/diriyah-logo.png" style="width:40px;height:40px;">
        <div style="font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>

      <div style="background:rgba(0,0,0,0.03);
                  border-radius:12px;padding:12px;margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center;">
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">المسافة</div>
            <div style="font-weight:700;font-size:13px;">${distanceText}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">الوقت المتوقع</div>
            <div style="font-weight:700;font-size:13px;">${durationText}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        
        <div>
          <label style="font-size:12px;">اللون:</label>
          <input id="route-color" type="color" value="${color}"
                 style="width:100%;height:28px;border:none;background:transparent;">
        </div>

        <div>
          <label style="font-size:12px;">السماكة:</label>
          <input id="route-weight" type="range" min="1" max="12" step="1" value="${weight}" style="width:100%;">
          <span id="route-weight-lbl" style="font-size:12px;color:#666">${weight}</span>
        </div>

        <div>
          <label style="font-size:12px;">الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="${opacity}" style="width:100%;">
          <span id="route-opacity-lbl" style="font-size:12px;color:#666">${opacity.toFixed(2)}</span>
        </div>

      </div>

      <div style="display:flex;gap:6px;margin-top:14px;">
        <button id="route-save"
                style="flex:1;border:1px solid #ccc;border-radius:10px;padding:6px;background:white;cursor:pointer;">
          حفظ
        </button>

        <button id="route-close"
                style="flex:1;border:1px solid #ccc;border-radius:10px;padding:6px;background:white;cursor:pointer;">
          إغلاق
        </button>
      </div>

    </div>
  </div>`;
}

function attachRouteCardEvents() {
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');

  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');

  function apply() {
    const clr = colorEl.value;
    const w   = +weightEl.value;
    const o   = +opacityEl.value;

    routeStyle = { color: clr, weight: w, opacity: o };

    if (activeRoutePoly) {
      activeRoutePoly.setOptions({
        strokeColor: clr,
        strokeWeight: w,
        strokeOpacity: o
      });
    }

    routeStopMarkers.forEach(m => {
      m.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: clr,
        strokeWeight: 2
      });
      m.setLabel({ text: m.getLabel().text, color: clr, fontSize:'11px', fontWeight:'700' });
    });

    if (directionsRenderer) {
      directionsRenderer.setOptions({
        polylineOptions: { strokeColor: clr, strokeWeight: w, strokeOpacity: o }
      });
    }

    flushPersist();
  }

  colorEl.addEventListener('input', apply);
  weightEl.addEventListener('input', () => {
    weightLbl.textContent = weightEl.value;
    apply();
  });

  opacityEl.addEventListener('input', () => {
    opacityLbl.textContent = (+opacityEl.value).toFixed(2);
    apply();
  });

  saveBtn.addEventListener('click', () => {
    flushPersist();
    if (routeCardWin) routeCardWin.close();
    routeCardPinned = false;
    showToast('✓ تم حفظ إعدادات المسار');
  });

  closeBtn.addEventListener('click', () => {
    if (routeCardWin) routeCardWin.close();
    routeCardPinned = false;
  });
}

/* ---------------- Route info card (view mode) ---------------- */

function openRouteInfoCard(latLng, pinned = false) {
  if (!routeInfoWin) {
    routeInfoWin = new google.maps.InfoWindow({
      maxWidth: 320,
      pixelOffset: new google.maps.Size(0, -6)
    });
  }

  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);

  const pointCount = routePoints.length;

  const content = `
  <div dir="rtl" style="min-width:280px">
    <div style="background:rgba(255,255,255,0.95);
                border-radius:16px;
                padding:16px;
                color:#111;">
      
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="width:36px;height:36px;background:${routeStyle.color};
                    border-radius:10px;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
            <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/>
          </svg>
        </div>

        <div style="flex:1;">
          <div style="font-weight:800;font-size:16px;">معلومات المسار</div>
          <div style="font-size:12px;color:#666;">${pointCount} نقطة</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
        <div style="text-align:center;">
          <div style="font-size:12px;color:#666;">المسافة</div>
          <div style="font-weight:700;font-size:14px;">${distanceText}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:12px;color:#666;">الوقت المتوقع</div>
          <div style="font-weight:700;font-size:14px;">${durationText}</div>
        </div>
      </div>

      ${!shareMode ? `
        <div style="text-align:center;font-size:11px;color:#777;margin-top:12px;">
          انقر على الخط لتعديل الإعدادات
        </div>` : ''}
    </div>
  </div>`;

  routeInfoWin.setContent(content);
  routeInfoWin.setPosition(latLng);
  routeInfoWin.open({ map });

  routeCardPinned = pinned;

  if (pinned) {
    google.maps.event.addListenerOnce(routeInfoWin, 'closeclick', () => {
      routeCardPinned = false;
    });
  }
}

/* ---------------- InfoWindow Card (Markers & Circles) ---------------- */

function openCard(item) {
  if (infoWin) infoWin.close();

  infoWin = new google.maps.InfoWindow({
    content: renderCard(item),
    position: item.marker.getPosition(),
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0, -32)
  });

  infoWin.open({ map, anchor: item.marker });
  cardPinned = true;

  google.maps.event.addListenerOnce(infoWin, 'domready', () => {
    attachCardEvents(item);
  });

  google.maps.event.addListenerOnce(infoWin, 'closeclick', () => {
    cardPinned = false;
    scheduleCardHide();
  });
}

function showHoverCard(item) {
  if (cardPinned) return;
  circleHovering = true;
  clearTimeout(cardHideTimer);

  if (!infoWin) {
    infoWin = new google.maps.InfoWindow({
      maxWidth: 380,
      pixelOffset: new google.maps.Size(0, -32)
    });
  }

  infoWin.setContent(renderCard(item, true));
  infoWin.open({ map, anchor: item.marker });

  const root = infoWin.getContent();
  if (root && root.addEventListener) {
    root.addEventListener('mouseenter', () => {
      cardHovering = true;
      clearTimeout(cardHideTimer);
    });
    root.addEventListener('mouseleave', () => {
      cardHovering = false;
      scheduleCardHide();
    });
  }
}

function renderCard(item, isHover = false) {
  const m = item.meta;
  const c = item.circle;

  const pos = item.marker.getPosition();
  const name = m.name || item.defaultName;
  const radius = c.getRadius();
  const color = toHex(c.get('fillColor'));

  const lat = pos.lat().toFixed(6);
  const lng = pos.lng().toFixed(6);

  const kind  = m.kind  || DEFAULT_MARKER_KIND;
  const scale = m.scale || DEFAULT_MARKER_SCALE;

  const recipients = m.recipients.join('\n');

  /* بطاقات الهوفر في وضع العرض فقط */
  if (isHover && !editMode) {
    return `
    <div dir="rtl" style="min-width:200px">
      <div style="background:rgba(255,255,255,0.93);
                  border-radius:18px;
                  padding:12px 16px;
                  color:#111;">
        
        <div style="font-weight:800;font-size:16px;margin-bottom:4px;">${escapeHtml(name)}</div>
        <div style="font-size:12px;color:#555;">النطاق: ${radius.toFixed(0)} متر</div>

        ${m.recipients.length > 0 ? `
        <div style="font-size:12px;color:#555;margin-top:6px;border-top:1px solid #eee;padding-top:4px;">
          <strong>المستلمون:</strong> ${escapeHtml(m.recipients.join(', '))}
        </div>` : ''}
      </div>
    </div>`;
  }

  /* قائمة أنواع الأيقونات */
  const markerKindOptions = MARKER_KINDS.map(k =>
    `<option value="${k.id}" ${k.id === kind ? 'selected' : ''}>${k.label}</option>`
  ).join('');

  return `
  <div id="info-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93);
                border-radius:18px;
                padding:14px;
                color:#111;">
      
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <img src="img/diriyah-logo.png" style="width:40px;height:40px;">
        <div style="font-weight:800;font-size:16px;">تعديل النقطة</div>
      </div>

      <!-- الاسم -->
      <div>
        <label>الاسم:</label>
        <input id="card-name" type="text" value="${escapeHtml(name)}"
               style="width:100%;border:1px solid #ddd;border-radius:6px;padding:4px 6px;">
      </div>

      <!-- اللون + النطاق + الحجم -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;">

        <div>
          <label>اللون:</label>
          <input id="card-color" type="color" value="${color}" style="width:100%;height:30px;border:none;">
        </div>

        <div>
          <label>النطاق (م):</label>
          <input id="card-radius" type="range" min="5" max="500" step="5" value="${radius}"
                 style="width:100%;">
          <span id="card-radius-lbl" style="font-size:12px;color:#555;">${radius.toFixed(0)}م</span>
        </div>

        <div>
          <label>حجم الأيقونة:</label>
          <input id="card-scale" type="range" min="0.5" max="2" step="0.1" value="${scale}"
                 style="width:100%;">
          <span id="card-scale-lbl" style="font-size:12px;color:#555;">${scale.toFixed(1)}x</span>
        </div>

      </div>

      <!-- نوع الأيقونة -->
      <div style="margin-top:10px;">
        <label>نوع الأيقونة:</label>
        <select id="card-kind"
                style="width:100%;border:1px solid #ddd;border-radius:6px;padding:4px 6px;">
          ${markerKindOptions}
        </select>
      </div>

      <!-- المستلمون -->
      <div style="margin-top:10px;">
        <label>المستلمون (كل اسم في سطر):</label>
        <textarea id="card-recipients" rows="2"
                  style="width:100%;border:1px solid #ddd;border-radius:6px;padding:4px 6px;">${escapeHtml(recipients)}</textarea>
      </div>

      <!-- أزرار التحكم -->
      <div style="display:flex;gap:6px;margin-top:14px;">
        <button id="card-save"
                style="flex:1;border:1px solid #ddd;border-radius:10px;padding:6px;background:white;cursor:pointer;">
          حفظ
        </button>

        <button id="card-del"
                style="flex:1;border:1px solid #ddd;border-radius:10px;padding:6px;background:white;color:#c00;cursor:pointer;">
          حذف
        </button>

        <button id="card-close"
                style="flex:1;border:1px solid #ddd;border-radius:10px;padding:6px;background:white;cursor:pointer;">
          إغلاق
        </button>
      </div>

      <div style="font-size:11px;color:#999;margin-top:10px;text-align:center;">
        ${lat}, ${lng}
      </div>
    </div>
  </div>`;
}

function attachCardEvents(item) {
  const nameEl   = document.getElementById('card-name');
  const colorEl  = document.getElementById('card-color');
  const radiusEl = document.getElementById('card-radius');
  const radiusLbl= document.getElementById('card-radius-lbl');
  const scaleEl  = document.getElementById('card-scale');
  const scaleLbl = document.getElementById('card-scale-lbl');
  const kindEl   = document.getElementById('card-kind');
  const recipEl  = document.getElementById('card-recipients');

  const saveBtn  = document.getElementById('card-save');
  const delBtn   = document.getElementById('card-del');
  const closeBtn = document.getElementById('card-close');

  function apply() {
    const r = +radiusEl.value;
    const c = colorEl.value;
    const s = +scaleEl.value;
    const k = kindEl.value;

    item.circle.setOptions({
      radius: r,
      strokeColor: c,
      fillColor: c,
      fillOpacity: DEFAULT_FILL_OPACITY
    });

    item.marker.setIcon(buildMarkerIcon(c, s, k));

    item.meta.name = nameEl.value.trim();
    item.meta.kind = k;
    item.meta.scale = s;

    item.meta.recipients = parseRecipients(recipEl.value);

    applyShapeVisibility(item);

    persist();
  }

  colorEl.addEventListener('input', apply);
  radiusEl.addEventListener('input', () => {
    radiusLbl.textContent = (+radiusEl.value).toFixed(0) + 'م';
    apply();
  });
  scaleEl.addEventListener('input', () => {
    scaleLbl.textContent = (+scaleEl.value).toFixed(1) + 'x';
    apply();
  });
  kindEl.addEventListener('change', apply);
  nameEl.addEventListener('input', apply);
  recipEl.addEventListener('input', apply);

  saveBtn.addEventListener('click', () => {
    apply();
    if (infoWin) infoWin.close();
    cardPinned = false;
    showToast('✓ تم حفظ التعديلات');
  });

  closeBtn.addEventListener('click', () => {
    if (infoWin) infoWin.close();
    cardPinned = false;
  });

  delBtn.addEventListener('click', () => {
    if (confirm(`هل تريد حذف "${item.meta.name}"؟`)) {
      deleteItem(item);
      if (infoWin) infoWin.close();
      cardPinned = false;
      persist();
    }
  });
}

function deleteItem(item) {
  item.marker.setMap(null);
  item.circle.setMap(null);
  const idx = circles.findIndex(x => x.id === item.id);
  if (idx >= 0) circles.splice(idx, 1);
}

/* ---------------- Shape Visibility ---------------- */
function applyShapeVisibility(item) {
  const r = item.circle.getRadius();
  item.circle.setVisible(r >= 5);
}

/* ---------------- Object creation ---------------- */

function createMarker(item) {
  const pos = { lat: item.lat, lng: item.lng };
  return new google.maps.Marker({
    position: pos,
    map: map,
    icon: buildMarkerIcon(DEFAULT_MARKER_COLOR, DEFAULT_MARKER_SCALE, DEFAULT_MARKER_KIND),
    draggable: editMode && !item.fixed,
    title: item.name
  });
}

function createCircle(item) {
  const pos = { lat: item.lat, lng: item.lng };
  return new google.maps.Circle({
    map: map,
    center: pos,
    radius: DEFAULT_RADIUS,
    strokeColor: DEFAULT_COLOR,
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    draggable: editMode && !item.fixed,
    editable: false,         // إلغاء تعديل الحجم مباشرة من الخريطة
    clickable: true
  });
}

function attachListeners(item) {
  const { marker, circle } = item;

  if (!item.fixed) {
    marker.addListener('drag', throttle(() => {
      circle.setCenter(marker.getPosition());
    }, 50));

    marker.addListener('dragend', () => {
      circle.setCenter(marker.getPosition());
      persist();
    });

    circle.addListener('drag', throttle(() => {
      marker.setPosition(circle.getCenter());
    }, 50));

    circle.addListener('dragend', () => {
      marker.setPosition(circle.getCenter());
      persist();
    });
  }

  // سيعمل عند التغيير من الكرت فقط (لا يوجد handles على الخريطة)
  circle.addListener('radius_changed', throttle(() => {
    applyShapeVisibility(item);
    persist();
  }, 250));

  const clickHandler = () => {
    if (addMode || routeMode) return;
    if (editMode) openCard(item);
    else showHoverCard(item);
  };

  marker.addListener('click', clickHandler);
  circle.addListener('click', clickHandler);

  /* hover */
  const hoverOn = () => {
    if (addMode || routeMode || cardPinned) return;
    showHoverCard(item);
  };
  const hoverOff = () => {
    circleHovering = false;
    scheduleCardHide();
  };

  marker.addListener('mouseover', hoverOn);
  circle.addListener('mouseover', hoverOn);
  marker.addListener('mouseout', hoverOff);
  circle.addListener('mouseout', hoverOff);
}

/* ---------------- Add new marker ---------------- */
function addNewMarker(latLng) {
  if (!editMode || shareMode) return;

  const newId = 'n' + Date.now();

  const newItem = {
    id: newId,
    name: "نقطة جديدة",
    lat: latLng.lat(),
    lng: latLng.lng(),
    fixed: false
  };

  const marker = createMarker(newItem);
  const circle = createCircle(newItem);

  const item = {
    id: newId,
    marker,
    circle,
    fixed: false,
    defaultName: "نقطة جديدة",
    meta: {
      name: "نقطة جديدة",
      kind: DEFAULT_MARKER_KIND,
      scale: DEFAULT_MARKER_SCALE,
      recipients: []
    }
  };

  attachListeners(item);
  circles.push(item);

  openCard(item);
  persist();
}

/* ---------------- Toast ---------------- */

function initToast() {
  if (toast) return;
  toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.style.cssText = `
    position: fixed;
    bottom: -100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30,30,30,0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 14px;
    z-index: 99999;
    transition: bottom .5s;
  `;
  document.body.appendChild(toast);
}

function showToast(msg, duration = 3000) {
  if (!toast) initToast();
  toast.textContent = msg;
  toast.style.bottom = '20px';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.style.bottom = '-100px';
  }, duration);
}

/* ---------------- Mode switching ---------------- */

function updateEditability() {
  circles.forEach(it => {
    const canEdit = editMode && !it.fixed && !shareMode;
    if (it.marker.setDraggable) it.marker.setDraggable(canEdit);
    if (it.circle.setDraggable) it.circle.setDraggable(canEdit);
    if (it.circle.setEditable) it.circle.setEditable(false); // دائماً بدون handles
  });
}

function setMode(mode) {
  if (shareMode) mode = 'view';

  if (mode === 'view') {
    editMode = false;
    addMode = false;
    routeMode = false;
  } else {
    editMode = true;
    addMode = (mode === 'add');
    routeMode = (mode === 'route');
  }

  map.setOptions({
    draggableCursor: addMode ? 'crosshair' : (routeMode ? 'copy' : null)
  });

  if (modeBadge) {
    if (shareMode || !editMode) {
      modeBadge.style.display = shareMode ? 'none' : 'inline-block';
      if (!shareMode) modeBadge.textContent = 'وضع العرض';
    } else if (addMode) {
      modeBadge.textContent = 'إضافة نقطة';
      modeBadge.style.display = 'inline-block';
    } else if (routeMode) {
      modeBadge.textContent = 'رسم مسار';
      modeBadge.style.display = 'inline-block';
    } else {
      modeBadge.textContent = 'وضع التحرير';
      modeBadge.style.display = 'inline-block';
    }
  }

  if (btnRouteClear)
    btnRouteClear.style.display = routeMode ? 'flex' : 'none';

  if (btnAdd)
    btnAdd.setAttribute('aria-pressed', addMode ? 'true' : 'false');

  if (btnRoute)
    btnRoute.setAttribute('aria-pressed', routeMode ? 'true' : 'false');

  if (btnEdit && !shareMode) {
    btnEdit.textContent = editMode ? 'وضع العرض' : 'تحرير';
  }

  if (infoWin) infoWin.close();
  cardPinned = false;

  updateEditability();
}

/* ---------------- Boot ---------------- */

function boot() {
  console.log("Booting Diriyah Map v15.0...");

  const sharedState = readShare();
  if (sharedState) {
    shareMode = true;
    editMode = false;
    document.body.classList.add('share-mode'); // وضع المشاركة دائماً عرض فقط
  }

  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: BASE_ZOOM,
    mapTypeId: 'roadmap',
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] }
    ]
  });

  trafficLayer = new google.maps.TrafficLayer();

  /* fixed locations */
  LOCATIONS.forEach(loc => {
    const marker = createMarker(loc);
    const circle = createCircle(loc);

    const item = {
      id: loc.id,
      marker,
      circle,
      fixed: true,
      defaultName: loc.name,
      meta: {
        name: loc.name,
        kind: DEFAULT_MARKER_KIND,
        scale: DEFAULT_MARKER_SCALE,
        recipients: []
      }
    };

    attachListeners(item);
    applyShapeVisibility(item);
    circles.push(item);
  });

  /* toolbar elements */
  btnTraffic    = document.getElementById('btnTraffic');
  btnShare      = document.getElementById('btnShare');
  btnAdd        = document.getElementById('btnAdd');
  btnRoute      = document.getElementById('btnRoute');
  btnRouteClear = document.getElementById('btnRouteClear');
  modeBadge     = document.getElementById('modeBadge');
  btnRoadmap    = document.getElementById('btnRoadmap');
  btnSatellite  = document.getElementById('btnSatellite');
  btnEdit       = document.getElementById('btnEdit');

  if (sharedState) applyState(sharedState);

  /* zoom-based marker scaling */
  map.addListener('zoom_changed', throttle(() => {
    circles.forEach(it => {
      const clr = toHex(it.circle.get('fillColor'));
      it.marker.setIcon(buildMarkerIcon(clr, it.meta.scale, it.meta.kind));
    });
    persist();
  }, 200));

  map.addListener('center_changed', throttle(persist, 1000));
  map.addListener('maptypeid_changed', persist);

  map.addListener('click', (e) => {
    if (shareMode) return;

    if (addMode) {
      addNewMarker(e.latLng);
      setMode('edit');
    }
    else if (routeMode) {
      addRoutePoint(e.latLng);
    }
    else {
      if (!editMode && activeRoutePoly &&
          google.maps.geometry.poly.isLocationOnEdge(e.latLng, activeRoutePoly, 1e-3)) {
        openRouteInfoCard(e.latLng, true);
      }
    }
  });

  map.addListener('mousemove', throttle(e => {
    if (shareMode || editMode) return;

    if (activeRoutePoly &&
        google.maps.geometry.poly.isLocationOnEdge(e.latLng, activeRoutePoly, 1e-3)) {
      if (!routeCardPinned) openRouteInfoCard(e.latLng, false);
    } else {
      if (routeInfoWin && !routeCardPinned) routeInfoWin.close();
    }
  }, 120));

  /* ---------------- Top buttons ---------------- */

  if (btnTraffic)
    btnTraffic.addEventListener('click', () => {
      if (shareMode) return;
      const enabled = btnTraffic.getAttribute('aria-pressed') === 'true';
      if (enabled) {
        trafficLayer.setMap(null);
        btnTraffic.setAttribute('aria-pressed', 'false');
      } else {
        trafficLayer.setMap(map);
        btnTraffic.setAttribute('aria-pressed', 'true');
      }
      persist();
    });

  if (btnShare)
    btnShare.addEventListener('click', async () => {
      if (shareMode) return;
      flushPersist();
      const longUrl = location.href;

      try {
        const resp = await fetch('/api/shorten?url=' + encodeURIComponent(longUrl));
        if (!resp.ok) throw new Error('shorten failed');
        const data = await resp.json();
        const shortUrl = (data && data.shortUrl) || longUrl;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shortUrl);
          showToast('✓ تم نسخ الرابط المختصر');
        } else {
          showToast('الرابط المختصر: ' + shortUrl);
        }
      } catch (err) {
        console.error(err);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(longUrl);
          showToast('✓ تم نسخ الرابط (بدون اختصار)');
        } else {
          showToast('تعذر إنشاء رابط مختصر');
        }
      }
    });

  if (btnAdd)
    btnAdd.addEventListener('click', () => {
      if (!editMode || shareMode) return;
      setMode('add');
      persist();
    });

  if (btnRoute)
    btnRoute.addEventListener('click', () => {
      if (!editMode || shareMode) return;
      setMode('route');
      ensureDirections();
      persist();
    });

  if (btnRouteClear)
    btnRouteClear.addEventListener('click', () => {
      if (shareMode) return;
      if (confirm("حذف المسار؟")) {
        clearRouteVisuals();
        setMode('edit');
        showToast("تم حذف المسار");
      }
    });

  if (btnRoadmap && btnSatellite) {
    btnRoadmap.addEventListener('click', () => {
      if (shareMode) return;
      map.setMapTypeId('roadmap');
      btnRoadmap.setAttribute('aria-pressed', 'true');
      btnSatellite.setAttribute('aria-pressed', 'false');
      persist();
    });

    btnSatellite.addEventListener('click', () => {
      if (shareMode) return;
      map.setMapTypeId('hybrid');
      btnSatellite.setAttribute('aria-pressed', 'true');
      btnRoadmap.setAttribute('aria-pressed', 'false');
      persist();
    });
  }

  if (btnEdit) {
    btnEdit.addEventListener('click', () => {
      if (shareMode) return;
      setMode(editMode ? 'view' : 'edit');
      persist();
    });
  }

  if (shareMode) {
    // في وضع المشاركة: عرض فقط لكن تفاعلي (Hover + Route Info)
    editMode = false;
    addMode = false;
    routeMode = false;
    if (modeBadge) modeBadge.style.display = 'none';
  } else {
    setMode('edit');
  }

  console.log("✓ Map boot complete");
}
