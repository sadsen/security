/* Diriyah Security Map – v15.1 (Full interactive + route sharing + glass style + is.gd) */
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
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else {
      pendingArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, pendingArgs);
          pendingArgs = null;
        }, remaining);
      }
    }
  };
}

/* ---------------- Persistent state via URL ---------------- */
const st = {
  markers: [],
  r: null, // route polyline points
  shareMode: false
};

function flushPersist() {
  try {
    const data = {
      m: st.markers.map(m => ({
        n: m.name, p: m.position.toJSON(),
        r: m.radius, c: m.color, s: m.security || []
      })),
      r: st.r
    };
    const encoded = btoa(JSON.stringify(data));
    history.replaceState(null, '', `?x=${encoded}`);
  } catch (err) {
    console.warn('Flush failed', err);
  }
}

function loadPersistedState() {
  const urlParams = new URLSearchParams(location.search);
  const encoded = urlParams.get('x');
  if (!encoded) return;
  try {
    const data = JSON.parse(atob(encoded));
    if (data?.m) st.markers = data.m;
    if (data?.r) st.r = data.r;
    st.shareMode = true;
  } catch (err) {
    console.warn('Invalid persisted state', err);
  }
}
/* ---------------- Boot Function ---------------- */
let map, bounds, circles = [], routePath = null;

function boot() {
  loadPersistedState();

  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 24.737, lng: 46.634 },
    zoom: 15,
    mapTypeId: 'roadmap',
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    clickableIcons: false
  });

  bounds = new google.maps.LatLngBounds();

  if (st.markers.length) {
    st.markers.forEach(drawCircleFromData);
  }

  if (st.r) {
    routePath = new google.maps.Polyline({
      path: st.r.map(p => ({ lat: p.lat, lng: p.lng })),
      geodesic: true,
      strokeColor: '#2196F3',
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map
    });
    st.r.forEach(p => bounds.extend(p));
    addRouteInfoCard(st.r);
  }

  if (st.markers.length || st.r) map.fitBounds(bounds);

  if (st.shareMode) {
    document.getElementById('addBtn').style.display = 'none';
    document.getElementById('drawBtn').style.display = 'none';
    document.getElementById('shareBtn').style.display = 'none';
  } else {
    setupEditTools();
  }
}

function drawCircleFromData(data) {
  const center = new google.maps.LatLng(data.p.lat, data.p.lng);
  const circle = new google.maps.Circle({
    strokeColor: data.c,
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: data.c,
    fillOpacity: 0.35,
    map,
    center,
    radius: data.r,
    clickable: true
  });
  circles.push(circle);
  bounds.extend(center);

  const card = createInfoCard(data.n, data.s);
  const infoWin = new google.maps.InfoWindow({ content: card });
  circle.addListener('click', () => infoWin.open(map, new google.maps.Marker({ position: center, map: null })));
}

function createInfoCard(name, securityList) {
  const secHtml = (securityList || []).map(n => `<li>${n}</li>`).join('');
  return `
    <div style="backdrop-filter: blur(8px); background: rgba(255,255,255,0.7); padding: 12px; border-radius: 12px; font-family: 'Cairo', sans-serif; max-width: 300px;">
      <img src="./img/diriyah-logo.png" alt="Diriyah" style="height: 32px; margin-bottom: 6px;" />
      <div style="font-weight: bold; font-size: 18px;">${name}</div>
      ${secHtml ? `<ul style="margin: 8px 0; padding-left: 20px; font-size: 14px;">${secHtml}</ul>` : ''}
    </div>
  `;
}

function addRouteInfoCard(points) {
  const dist = google.maps.geometry.spherical.computeLength(points.map(p => new google.maps.LatLng(p.lat, p.lng))) / 1000;
  const duration = (dist / 30) * 60;
  const content = `
    <div style="backdrop-filter: blur(8px); background: rgba(255,255,255,0.7); padding: 12px; border-radius: 12px; font-family: 'Cairo', sans-serif; max-width: 260px;">
      <img src="./img/diriyah-logo.png" alt="Diriyah" style="height: 30px; margin-bottom: 6px;" />
      <div style="font-weight: bold; font-size: 16px;">معلومات المسار</div>
      <div style="margin-top: 8px; font-size: 14px;">
        <strong>المسافة:</strong> ${dist.toFixed(2)} كم<br>
        <strong>المدة:</strong> ${Math.round(duration)} دقيقة (تقديري)
      </div>
    </div>
  `;
  const midpoint = points[Math.floor(points.length / 2)];
  const infoWin = new google.maps.InfoWindow({ content, position: midpoint });
  infoWin.open(map);
}
/* ---------------- Editing tools ---------------- */
function setupEditTools() {
  const addBtn = document.getElementById('addBtn');
  const drawBtn = document.getElementById('drawBtn');
  const shareBtn = document.getElementById('shareBtn');
  let drawingRoute = false;
  let tempRoute = [];

  addBtn.addEventListener('click', () => {
    drawingRoute = false;
    map.setOptions({ draggableCursor: 'crosshair' });
    const listener = map.addListener('click', (e) => {
      google.maps.event.removeListener(listener);
      map.setOptions({ draggableCursor: null });

      const name = prompt('اسم الموقع:');
      if (!name) return;
      const radius = parseInt(prompt('نصف القطر بالمتر:', '50')) || 50;
      const color = prompt('لون الدائرة (مثلاً red أو #2196F3):', '#f44336') || '#f44336';
      const personnel = prompt('أسماء المستلمين (افصلها بفاصلة):', '').split(',').map(s => s.trim()).filter(Boolean);

      const newMarker = {
        n: name,
        p: e.latLng.toJSON(),
        r: radius,
        c: color,
        s: personnel
      };

      st.markers.push(newMarker);
      flushPersist();
      location.reload();
    });
  });

  drawBtn.addEventListener('click', () => {
    drawingRoute = true;
    tempRoute = [];
    map.setOptions({ draggableCursor: 'crosshair' });
    const routeLine = new google.maps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#2196F3',
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map
    });

    const listener = map.addListener('click', (e) => {
      const pt = e.latLng.toJSON();
      tempRoute.push(pt);
      routeLine.setPath(tempRoute);
    });

    const finish = () => {
      if (tempRoute.length > 1) {
        st.r = tempRoute;
        flushPersist();
        location.reload();
      } else {
        routeLine.setMap(null);
      }
      google.maps.event.removeListener(listener);
      map.setOptions({ draggableCursor: null });
      drawingRoute = false;
    };

    setTimeout(() => {
      if (drawingRoute && confirm('هل ترغب بإنهاء رسم المسار؟')) finish();
    }, 15000);
  });

  shareBtn.addEventListener('click', async () => {
    flushPersist();
    await new Promise(resolve => setTimeout(resolve, 300));
    const shortURL = await shortenURL(location.href);
    try {
      await navigator.clipboard.writeText(shortURL);
      alert('📎 تم نسخ رابط المشاركة القصير للحافظة!');
    } catch {
      prompt('📎 انسخ الرابط التالي:', shortURL);
    }
  });
}

/* ---------------- Shorten URL via /api/shorten (Express backend) ---------------- */
async function shortenURL(longUrl) {
  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: longUrl })
    });
    const json = await res.json();
    return json.short || longUrl;
  } catch (err) {
    console.warn('Shorten failed', err);
    return longUrl;
  }
}
/* ---------------- Optional: keyboard shortcuts ---------------- */
// document.addEventListener('keydown', (e) => {
//   if (e.key === 's' && e.ctrlKey) {
//     e.preventDefault();
//     flushPersist();
//     alert('✅ تم حفظ التعديلات');
//   }
// });

/* ---------------- Optional: force dark theme for map ---------------- */
// const styledMapType = new google.maps.StyledMapType([
//   { elementType: 'geometry', stylers: [{ color: '#212121' }] },
//   { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
//   { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
//   { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
//   { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
//   { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
//   { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#383838' }] },
//   { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212121' }] },
//   { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
//   { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
//   { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] }
// ], { name: 'Dark Mode' });
// map.mapTypes.set('dark', styledMapType);
// map.setMapTypeId('dark');

/* ---------------- Done. Diriyah Security Map v15.1 ---------------- */
