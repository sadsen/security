/* Diriyah Security Map – v11.14 (with map type selector, no roadmap/satellite buttons) */
'use strict';
/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});
/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
// btnRoadmap و btnSatellite تم إزالتهما
let btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;
let mapTypeSelector;
/* Hover state */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;
function scheduleCardHide(){
  clearTimeout(cardHideTimer);
  if(cardPinned) return;
  cardHideTimer = setTimeout(()=>{
    if(!cardPinned && !cardHovering && !circleHovering && infoWin){
      infoWin.close();
    }
  }, 120);
}
const DEFAULT_CENTER = { lat:24.7399, lng:46.5731 };
const DEFAULT_RADIUS = 20;
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const BASE_ZOOM = 15;
const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
  { id:10, name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356 },
  { id:11, name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785 },
  { id:12, name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506, lng:46.57789576275729 },
  { id:13, name:"مواقف الامن", lat:24.73808736962705, lng:46.57771858346317 },
  { id:14, name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043 },
  { id:15, name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368 },
  { id:16, name:"دوار وادي صفار", lat:24.72491458984474, lng:46.57345489743978 },
  { id:17, name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204 },
  { id:18, name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346 },
];
/* SVG icons */
const MARKER_KINDS = [
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];
function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`; }
function gateSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`; }
function meetSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
/* utilities */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'&quot;');
const toHex=(c)=>{
  if(!c) return DEFAULT_COLOR;
  if(/^#/.test(c)) return c;
  const m=c&&c.match(/rgba?\s*\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if(!m) return DEFAULT_COLOR;
  const [r,g,b]=[+m[1],+m[2],+m[3]];
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
};
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;,]+/g,' ').trim()).filter(Boolean);
let persistTimer=null;
const persist=()=>{ if(shareMode) return; clearTimeout(persistTimer); persistTimer=setTimeout(()=>writeShare(buildState()),180); };
function flushPersist(){ if(shareMode) return; clearTimeout(persistTimer); writeShare(buildState()); }
/* Base64URL */
function b64uEncode(s){ const b=btoa(unescape(encodeURIComponent(s))); return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function b64uDecode(t){
  try{ t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad))); }catch{return '';} }
function readShare(){ const h=(location.hash||'').trim(); if(!/^#x=/.test(h)) return null; try{return JSON.parse(b64uDecode(h.slice(3)));}catch{return null;} }
/* SVG icon builder */
function buildMarkerIcon(color, userScale, kindId){
  const currentZoom = (map && typeof map.getZoom === 'function') ? map.getZoom() : BASE_ZOOM;
  const zoomScale = Math.pow(1.6, (currentZoom - BASE_ZOOM) / 1.0);
  const base = 28;
  const w = Math.max(12, Math.round(base * (userScale||DEFAULT_MARKER_SCALE) * zoomScale));
  const h = w;
  const kind = MARKER_KINDS.find(k=>k.id===kindId)||MARKER_KINDS[0];
  const svg = kind.svg.replace(/fill="([^"]*)"/,`fill="${color||DEFAULT_MARKER_COLOR}"`);
  const encoded = 'image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  return { url: encoded, scaledSize: new google.maps.Size(w, h), anchor: new google.maps.Point(Math.round(w/2), Math.round(h)) };
}
/* circles & markers arrays */
const circles = [];
/* ---------- Route (Directions) feature ---------- */
let directionsService = null;
let directionsRenderer = null;
let routeMode = false;
let routePoints = [];
let routeStopMarkers = [];
let currentRouteOverview = null;
let activeRoutePoly = null;
let routeCardWin = null;
let routeCardPinned = false;
let btnRoute, btnRouteClear;
let routeStyle = {
  color: '#3344ff',
  weight: 4,
  opacity: 0.95
};
function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      },
      map
    });
  } else {
    directionsRenderer.setOptions({
      polylineOptions: {
        strokeColor: routeStyle.color,
        strokeWeight: routeStyle.weight,
        strokeOpacity: routeStyle.opacity
      }
    });
  }
}
function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#3344ff', strokeWeight: 2 },
    label: { text: String(index+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ routePoints[index] = m.getPosition(); requestAndRenderRoute(); persist(); });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); persist(); });
  return m;
}
function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  currentRouteOverview = null;
}
function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  requestAndRenderRoute();
  persist();
}
function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{ if(m.getLabel) m.setLabel({ text:String(i+1), color:'#3344ff', fontSize:'11px', fontWeight:'700' }); });
  requestAndRenderRoute();
}
function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    currentRouteOverview = null;
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
      const r = result.routes && result.routes[0];
      currentRouteOverview = r && r.overview_polyline ? r.overview_polyline.points : null;
      setTimeout(()=>{ extractActivePolyline(); },0);
    } else {
      showToast('تعذر حساب المسار: ' + status);
    }
  });
}
function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir || !dir.routes || !dir.routes[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path || !path.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);
  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997
  });
  activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
}
function restoreRouteFromOverview(polyStr){
  if(!polyStr) return;
  try{
    const path = google.maps.geometry.encoding.decodePath(polyStr);
    clearRouteVisuals();
    activeRoutePoly = new google.maps.Polyline({
      map,
      path,
      strokeColor: routeStyle.color,
      strokeWeight: routeStyle.weight,
      strokeOpacity: routeStyle.opacity,
      zIndex: 9997
    });
    currentRouteOverview = polyStr;
    activeRoutePoly.addListener('click', (e)=>{ openRouteCard(e.latLng); });
  }catch(e){ console.warn('restoreRouteFromOverview failed', e); }
}
/* ---------------- Route Card (live-preview) ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();
  routeCardWin = new google.maps.InfoWindow({
    content: renderRouteCard(),
    position: latLng,
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0,-6)
  });
  routeCardWin.open({ map });
  routeCardPinned = true;
  google.maps.event.addListenerOnce(routeCardWin, 'domready', () => {
    attachRouteCardEvents();
    setTimeout(()=>{
      const root=document.getElementById('route-card-root');
      if(!root) return;
      const iw=root.closest('.gm-style-iw');
      if(iw && iw.parentElement){
        iw.parentElement.style.background='transparent';
        iw.parentElement.style.boxShadow='none';
        const tail=iw.parentElement.previousSibling;
        if(tail && tail.style) tail.style.display='none';
      }
    },0);
  });
}
function renderRouteCard(){
  const poly = activeRoutePoly;
  if(poly){
    const c = poly.get('strokeColor');
    const w = poly.get('strokeWeight');
    const o = poly.get('strokeOpacity');
    if(c) routeStyle.color = c;
    if(Number.isFinite(w)) routeStyle.weight = w;
    if(Number.isFinite(o)) routeStyle.opacity = o;
  }
  const color   = routeStyle.color   || '#3344ff';
  const weight  = Number.isFinite(routeStyle.weight)  ? routeStyle.weight  : 4;
  const opacity = Number.isFinite(routeStyle.opacity) ? routeStyle.opacity : 0.95;
  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="field"><label style="font-size:12px;color:#333;">اللون:</label>
          <input id="route-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        <div class="field"><label style="font-size:12px;color:#333;">سماكة الخط:</label>
          <input id="route-weight" type="range" min="1" max="12" step="1" value="${weight}" style="width:100%;">
          <span id="route-weight-lbl" style="font-size:12px;color:#666">${weight}</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">الشفافية:</label>
          <input id="route-opacity" type="range" min="0.1" max="1" step="0.05" value="${opacity}" style="width:100%;">
          <span id="route-opacity-lbl" style="font-size:12px;color:#666">${opacity.toFixed(2)}</span></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}
function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');
  function apply(){
    if(!colorEl || !weightEl || !opacityEl) return;
    const clr = colorEl.value || '#3344ff';
    const w   = +weightEl.value || 1;
    const o   = +opacityEl.value || 1;
    if(weightLbl) weightLbl.textContent = w;
    if(opacityLbl) opacityLbl.textContent = o.toFixed(2);
    routeStyle.color   = clr;
    routeStyle.weight  = w;
    routeStyle.opacity = o;
    if(activeRoutePoly){
      activeRoutePoly.setOptions({ strokeColor: clr, strokeWeight: w, strokeOpacity: o });
    }
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: clr,
          strokeWeight: w,
          strokeOpacity: o
        }
      });
    }
    persist();
  }
  if(colorEl){
    colorEl.addEventListener('input', apply, {passive:true});
    colorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(weightEl){
    weightEl.addEventListener('input', apply, {passive:true});
    weightEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(opacityEl){
    opacityEl.addEventListener('input', apply, {passive:true});
    opacityEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(saveBtn){
    saveBtn.addEventListener('click', ()=>{
      flushPersist();
      showToast('تم حفظ إعدادات المسار ✅');
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
  if(closeBtn){
    closeBtn.addEventListener('click', ()=>{
      if(routeCardWin){ routeCardWin.close(); routeCardWin = null; }
      routeCardPinned = false;
    }, {passive:true});
  }
}
/* ---------------- State write/read (hash) ---------------- */
function writeShare(state){
  if(shareMode) return;
  let payload = state;
  let tok = b64uEncode(JSON.stringify(payload));
  if(tok.length > 1800){
    payload = { c: state.c || [], n: state.n || [], r: state.r || null };
    tok = b64uEncode(JSON.stringify(payload));
  }
  const newHash = `#x=${tok}`;
  if(location.hash !== newHash){ history.replaceState(null,'',newHash); }
}
function applyState(s){
  if(!s) return;
  if(Array.isArray(s.p) && s.p.length === 2){ map.setCenter({lat:s.p[1], lng:s.p[0]}); }
  if(Number.isFinite(s.z)){ map.setZoom(s.z); }
  if(typeof s.m === 'string'){
    let mapTypeId = s.m;
    if (s.m === 'r') mapTypeId = 'roadmap';
    else if (s.m === 's') mapTypeId = 'satellite';
    else if (s.m === 'h') mapTypeId = 'hybrid';
    else if (s.m === 't') mapTypeId = 'terrain';
    if(['roadmap','satellite','hybrid','terrain'].includes(mapTypeId)){
      map.setMapTypeId(mapTypeId);
      if(mapTypeSelector) mapTypeSelector.value = mapTypeId;
    }
  }
  if (s.t === 1){ trafficLayer.setMap(map); btnTraffic.setAttribute('aria-pressed','true'); }
  else if (s.t === 0){ trafficLayer.setMap(null); btnTraffic.setAttribute('aria-pressed','false'); }
  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id,r,sc,fo,sw,rec,name,useMarker,mc,ms,mk] = row;
      const it=circles.find(x=>x.id===id);
      if(!it) return;
      it.circle.setOptions({
        radius:Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity:Number.isFinite(fo)?(fo/100):DEFAULT_FILL_OPACITY,
        strokeWeight:Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT
      });
      if(typeof name==='string' && name.trim()){ it.meta.name = name.trim(); }
      it.meta.recipients = rec ? rec.split('~').map(s=>s.trim()).filter(Boolean) : [];
      const meta = it.meta;
      meta.useMarker = (useMarker === 1);
      if(mc) meta.markerColor = '#'+mc;
      if(Number.isFinite(ms)) meta.markerScale = ms;
      if(mk) meta.markerKind = mk;
      applyShapeVisibility(it);
    });
  }
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id,lat,lng,name,r,sc,fo,sw,rec,useMarker,mc,ms,mk] = row;
      if(circles.some(x=>x.id===id)) return;
      const circle = new google.maps.Circle({
        map,
        center:{lat:+lat,lng:+lng},
        radius:Number.isFinite(r)?r:DEFAULT_RADIUS,
        strokeColor:sc?`#${sc}`:DEFAULT_COLOR,
        strokeOpacity:.95,
        strokeWeight:Number.isFinite(sw)?sw:DEFAULT_STROKE_WEIGHT,
        fillColor:sc?`#${sc}`:DEFAULT_COLOR,
        fillOpacity:Number.isFinite(fo)?(fo/100):DEFAULT_FILL_OPACITY,
        clickable:true,
        draggable:false,
        editable:false,
        zIndex:9999
      });
      const meta = {
        name:(name||'موقع جديد'),
        origName:(name||'موقع جديد'),
        recipients: rec?rec.split('~').filter(Boolean):[],
        isNew:true,
        useMarker: (useMarker === 1),
        markerColor: mc ? '#'+mc : undefined,
        markerScale: Number.isFinite(ms) ? ms : undefined,
        markerKind: mk || DEFAULT_MARKER_KIND
      };
      const item = { id, circle, marker:null, meta };
      circles.push(item);
      bindCircleEvents(item);
      applyShapeVisibility(item);
    });
  }
  if(s && s.r && s.r.ov){ restoreRouteFromOverview(s.r.ov); }
}
/* ---------------- Boot ---------------- */
function boot(){
  // btnRoadmap و btnSatellite لم تعد تُستخدم
  btnTraffic  = document.getElementById('btnTraffic');
  btnShare    = document.getElementById('btnShare');
  btnEdit     = document.getElementById('btnEdit');
  btnAdd      = document.getElementById('btnAdd');
  btnRoute    = document.getElementById('btnRoute');
  btnRouteClear = document.getElementById('btnRouteClear');
  modeBadge   = document.getElementById('modeBadge');
  toast       = document.getElementById('toast');

  // --- إنشاء القائمة المنسدلة ---
  const mapControlsDiv = document.createElement('div');
  mapControlsDiv.id = 'mapControls';
  mapControlsDiv.style.cssText = `
    position: absolute; top: 10px; left: 10px; z-index: 1000; background: white; padding: 8px; 
    border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-family: Tajawal, sans-serif;
    display: flex; flex-direction: column; gap: 4px; max-width: 200px;
  `;
  const label = document.createElement('label');
  label.htmlFor = 'mapTypeSelector';
  label.textContent = 'نوع الخريطة:';
  label.style.cssText = 'font-size: 12px; margin-bottom: 2px; color: #333;';
  mapTypeSelector = document.createElement('select');
  mapTypeSelector.id = 'mapTypeSelector';
  mapTypeSelector.style.cssText = 'font-size: 14px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; background: white;';
  mapTypeSelector.innerHTML = `
    <option value="roadmap">الطرق</option>
    <option value="satellite">الأقمار الصناعية</option>
    <option value="hybrid">مختلط</option>
    <option value="terrain">التضاريس</option>
  `;
  mapControlsDiv.appendChild(label);
  mapControlsDiv.appendChild(mapTypeSelector);
  document.body.appendChild(mapControlsDiv);

  // ربط الحدث لتغيير نوع الخريطة
  mapTypeSelector.addEventListener('change', () => {
    const type = mapTypeSelector.value;
    map.setMapTypeId(type);
    persist();
  }, {passive:true});

  map = new google.maps.Map(document.getElementById('map'), {
    center:DEFAULT_CENTER,
    zoom:15,
    mapTypeId:'roadmap',
    disableDefaultUI:true,
    clickableIcons:false,
    gestureHandling:'greedy'
  });

  // تحديث القائمة عند تغيير الخريطة من خارجها
  map.addListener('maptypeid_changed', () => {
    const type = map.getMapTypeId();
    if(mapTypeSelector && ['roadmap','satellite','hybrid','terrain'].includes(type)) {
      mapTypeSelector.value = type;
    }
  });

  trafficLayer = new google.maps.TrafficLayer();
  map.addListener('zoom_changed', throttle(updateMarkersScale, 80));

  // --- أزرار متبقية فقط ---
  btnTraffic.addEventListener('click', ()=>{
    const on=btnTraffic.getAttribute('aria-pressed')==='true';
    if(on) trafficLayer.setMap(null); else trafficLayer.setMap(map);
    btnTraffic.setAttribute('aria-pressed', String(!on));
    persist();
  }, {passive:true});

  if(btnRoute){
    btnRoute.addEventListener('click', ()=>{
      if(shareMode){ showToast('وضع المشاركة لا يسمح بالتحرير'); return; }
      routeMode = !routeMode;
      btnRoute.setAttribute('aria-pressed', String(routeMode));
      if(routeMode){
        showToast('وضع المسار مفعل — انقر على الخريطة لإضافة نقاط.');
        addMode = false; btnAdd.setAttribute('aria-pressed','false'); document.body.classList.remove('add-cursor');
      } else { showToast('تم إيقاف وضع المسار'); }
    }, {passive:true});
  }
  if(btnRouteClear){
    btnRouteClear.addEventListener('click', ()=>{
      routePoints = []; clearRouteVisuals(); persist(); showToast('تم مسح المسار');
    }, {passive:true});
  }
  btnShare.addEventListener('click', async ()=>{
    await nextTick(); flushPersist(); await nextTick(); await copyShareLink();
  }, {passive:true});
  btnEdit.addEventListener('click', ()=>{
    if(shareMode) return;
    editMode=!editMode; cardPinned=false; if(infoWin) infoWin.close();
    modeBadge.textContent=editMode?'Edit':'Share';
    setDraggableForAll(editMode);
    if(!editMode){ addMode=false; btnAdd.setAttribute('aria-pressed','false'); document.body.classList.remove('add-cursor'); }
    persist();
  }, {passive:true});
  btnAdd.addEventListener('click', ()=>{
    if(shareMode) return;
    if(!editMode){ showToast('فعّل وضع التحرير أولاً'); return; }
    addMode=!addMode;
    btnAdd.setAttribute('aria-pressed', String(addMode));
    document.body.classList.toggle('add-cursor', addMode);
    showToast(addMode?'انقر على الخريطة لإضافة موقع جديد':'تم إلغاء الإضافة');
  }, {passive:true});

  map.addListener('click', (e)=>{
    cardHovering = false; circleHovering = false;
    if (cardPinned && infoWin) { infoWin.close(); cardPinned = false; }
    if (routeCardPinned && routeCardWin) { routeCardWin.close(); routeCardPinned = false; }
    if(routeMode && editMode && !shareMode){
      addRoutePoint(e.latLng);
      return;
    }
    if(addMode && editMode && !shareMode){
      const id = genNewId();
      const circle = new google.maps.Circle({
        map, center:e.latLng, radius:DEFAULT_RADIUS,
        strokeColor:DEFAULT_COLOR, strokeOpacity:.95, strokeWeight:DEFAULT_STROKE_WEIGHT,
        fillColor:DEFAULT_COLOR, fillOpacity:DEFAULT_FILL_OPACITY,
        clickable:true, draggable:true, editable:false, zIndex:9999
      });
      const meta = {
        name:'موقع جديد', origName:'موقع جديد', recipients:[], isNew:true,
        useMarker:false, markerColor:undefined, markerScale:undefined, markerKind:DEFAULT_MARKER_KIND
      };
      const item = { id, circle, marker:null, meta };
      circles.push(item);
      bindCircleEvents(item);
      openCard(item, true);
      cardPinned=true;
      persist();
      addMode=false; btnAdd.setAttribute('aria-pressed','false'); document.body.classList.remove('add-cursor');
      updateMarkersScale();
    }
  });

  const openCardThrottled = throttle((item, pin)=>openCard(item, pin), 120);
  LOCATIONS.forEach(loc=>{
    const circle = new google.maps.Circle({
      map, center:{lat:loc.lat,lng:loc.lng}, radius:DEFAULT_RADIUS,
      strokeColor:DEFAULT_COLOR, strokeOpacity:.95, strokeWeight:DEFAULT_STROKE_WEIGHT,
      fillColor:DEFAULT_COLOR, fillOpacity:DEFAULT_FILL_OPACITY,
      clickable:true, draggable:false, editable:false, zIndex:9999
    });
    const meta = { name:loc.name, origName:loc.name, recipients:[], isNew:false, useMarker:false };
    const item = { id:loc.id, circle, marker:null, meta };
    circles.push(item);
    circle.addListener('mouseover', ()=>{ circleHovering = true; if(!cardPinned) openCardThrottled(item, false); });
    circle.addListener('mouseout',  ()=>{ circleHovering = false; scheduleCardHide(); });
    circle.addListener('click',     ()=>{ openCard(item, true); });
  });

  const S = readShare();
  shareMode = !!S;
  if(S){ applyState(S); setViewOnly(); }
  else { writeShare(buildState()); }
  updateMarkersScale();
  map.addListener('idle', persist);
  window.addEventListener('beforeunload', ()=>{ flushPersist(); });
}
/* helper to bind circle events */
function bindCircleEvents(item){
  const openCardThrottled = throttle((it, pin)=>openCard(it, pin), 120);
  const c = item.circle;
  c.addListener('mouseover', ()=>{ circleHovering = true; if(!cardPinned) openCardThrottled(item, false); });
  c.addListener('mouseout',  ()=>{ circleHovering = false; scheduleCardHide(); });
  c.addListener('click',     ()=>{ openCard(item, true); });
  google.maps.event.addListener(c,'center_changed', ()=>{
    if(item.marker){ item.marker.setPosition(c.getCenter()); }
    persist();
  });
}
/* ---------------- Card (locations) ---------------- */
function openCard(item, pin = true){
  if(!infoWin) infoWin = new google.maps.InfoWindow({ content:'', maxWidth:520, pixelOffset:new google.maps.Size(0,-6) });
  infoWin.setContent(renderCard(item));
  infoWin.setPosition(item.circle.getCenter());
  infoWin.open({ map });
  cardPinned = !!pin;
  setTimeout(()=>{
    const root=document.getElementById('iw-root'); if(!root) return;
    const close=root.parentElement?.querySelector('.gm-ui-hover-effect'); if(close) close.style.display='none';
    const iw=root.closest('.gm-style-iw');
    if(iw && iw.parentElement){
      iw.parentElement.style.background='transparent';
      iw.parentElement.style.boxShadow='none';
      const tail=iw.parentElement.previousSibling;
      if(tail && tail.style) tail.style.display='none';
    }
    attachCardEvents(item);
  },0);
}
function renderCard(item){
  const c=item.circle, meta=item.meta;
  const names=Array.isArray(meta.recipients)?meta.recipients:[];
  const namesHtml = names.length
    ? `<ol style="margin:6px 0 0; padding-inline-start:20px;">${names.map(n=>`<li>${escapeHtml(n)}</li>`).join('')}</ol>`
    : `<div style="font-size:12px;color:#666">لا توجد أسماء مضافة</div>`;
  const center=c.getCenter();
  const radius=Math.round(c.getRadius());
  const color =toHex(c.get('strokeColor')||DEFAULT_COLOR);
  const stroke=c.get('strokeWeight')||DEFAULT_STROKE_WEIGHT;
  const fillO =Number(c.get('fillOpacity')??DEFAULT_FILL_OPACITY);
  const useMarker = !!meta.useMarker;
  const markerColor = meta.markerColor || DEFAULT_MARKER_COLOR;
  const markerScale = Number.isFinite(meta.markerScale) ? meta.markerScale : DEFAULT_MARKER_SCALE;
  const markerKind  = meta.markerKind || DEFAULT_MARKER_KIND;
  const optionsHtml = MARKER_KINDS.map(k=>`<option value="${k.id}" ${k.id===markerKind?'selected':''}>${k.label}</option>`).join('');
  return `
  <div id="iw-root" dir="rtl" style="min-width:360px;max-width:520px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:50px;height:50px;object-fit:contain;">
        <div style="flex:1 1 auto; min-width:0">
          ${(!shareMode && editMode) ? `
            <input id="ctl-name" value="${escapeHtml(meta.name||'')}" placeholder="اسم الموقع"
              style="width:100%;border:1px solid #ddd;border-radius:10px;padding:6px 8px;font-weight:700;font-size:16px;">
          ` : `
            <div style="font-weight:800;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(meta.name)}</div>
          `}
        </div>
        ${(!shareMode && editMode) ? `<button id="btn-card-share" title="نسخ الرابط"
            style="margin-inline-start:6px;border:1px solid #ddd;background:#fff;border-radius:10px;padding:4px 8px;cursor:pointer;">نسخ الرابط</button>` : ``}
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:6px">
        الإحداثيات: ${center.lat().toFixed(6)}, ${center.lng().toFixed(6)}
      </div>
      <div style="border-top:1px dashed #e7e7e7; padding-top:8px;">
        <div style="font-weight:700; margin-bottom:4px;">المستلمون:</div>
        ${namesHtml}
      </div>
      ${(!shareMode && editMode) ? `
      <div style="margin-top:12px;border-top:1px dashed #e7e7e7;padding-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">أدوات التمثيل:</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <label style="font-size:12px;color:#333;white-space:nowrap;">نوع التمثيل:</label>
          <select id="ctl-shape" style="flex:1;border:1px solid #ddd;border-radius:8px;padding:4px 6px;">
            <option value="circle" ${useMarker?'':'selected'}>دائرة</option>
            <option value="marker" ${useMarker?'selected':''}>أيقونة</option>
          </select>
        </div>
        <div id="circle-tools" style="${useMarker?'display:none;':''}">
          <div style="font-weight:700; margin-bottom:6px;">أدوات الدائرة:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">نصف القطر (م):</label>
              <input id="ctl-radius" type="range" min="5" max="300" step="1" value="${radius}" style="width:100%;">
              <span id="lbl-radius" style="font-size:12px;color:#666">${radius}</span></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">اللون:</label>
              <input id="ctl-color" type="color" value="${color}" style="width:38px;height:28px;border:none;background:transparent;padding:0"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">حدّ الدائرة:</label>
              <input id="ctl-stroke" type="number" min="0" max="8" step="1" value="${stroke}" style="width:70px;"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">شفافية التعبئة:</label>
              <input id="ctl-fill" type="range" min="0" max="0.95" step="0.02" value="${fillO}" style="width:100%;">
              <span id="lbl-fill" style="font-size:12px;color:#666">${fillO.toFixed(2)}</span></div>
          </div>
        </div>
        <div id="marker-tools" style="margin-top:10px;${useMarker?'':'display:none;'}">
          <div style="font-weight:700; margin-bottom:6px;">أدوات الأيقونة:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">نوع الأيقونة:</label>
              <select id="ctl-marker-kind" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:4px 6px;">
                ${optionsHtml}
              </select>
            </div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">لون الأيقونة:</label>
              <input id="ctl-marker-color" type="color" value="${markerColor}"
                     style="width:38px;height:28px;border:none;background:transparent;padding:0"></div>
            <div class="field"><label style="font-size:12px;color:#333;white-space:nowrap;">حجم الأيقونة:</label>
              <input id="ctl-marker-scale" type="range" min="0.6" max="2.4" step="0.1" value="${markerScale}" style="width:100%;">
              <span id="lbl-marker-scale" style="font-size:12px;color:#666">${markerScale.toFixed(1)}</span></div>
          </div>
        </div>
        <div style="margin-top:8px;">
          <label style="font-size:12px;color:#666">أسماء المستلمين (سطر لكل اسم):</label>
          <textarea id="ctl-names" rows="4" style="width:100%; background:#fff; border:1px solid #ddd; border-radius:10px; padding:8px; white-space:pre;">${escapeHtml(names.join("\n"))}</textarea>
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button id="btn-save"  style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حفظ</button>
            <button id="btn-clear" style="border:1px solid #ddd; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الأسماء</button>
            <button id="btn-del"   style="border:1px solid #f33; color:#f33; background:#fff; border-radius:10px; padding:6px 10px; cursor:pointer;">حذف الموقع</button>
          </div>
          <div style="margin-top:6px;font-size:12px;color:#666">يمكن سحب الدائرة لتغيير الموقع، والأيقونة تتحرك تلقائيًا.</div>
        </div>
      </div>` : ``}
    </div>
  </div>`;
}
function attachCardEvents(item){
  if(shareMode || !editMode) return;
  const c=item.circle;
  const root = document.getElementById('iw-root');
  if(root){
    root.addEventListener('mouseenter', ()=>{ cardHovering = true; }, {passive:true});
    root.addEventListener('mouseleave', ()=>{ cardHovering = false; scheduleCardHide(); }, {passive:true});
  }
  const inShare=document.getElementById('btn-card-share');
  if(inShare) inShare.addEventListener('click', async ()=>{
    flushPersist(); await nextTick(); await copyShareLink();
  }, {passive:true});
  const nameEl=document.getElementById('ctl-name');
  const r=document.getElementById('ctl-radius');
  const lr=document.getElementById('lbl-radius');
  const col=document.getElementById('ctl-color');
  const sw=document.getElementById('ctl-stroke');
  const fo=document.getElementById('ctl-fill');
  const lf=document.getElementById('lbl-fill');
  const names=document.getElementById('ctl-names');
  const save=document.getElementById('btn-save');
  const clr=document.getElementById('btn-clear');
  const del=document.getElementById('btn-del');
  const shapeSel=document.getElementById('ctl-shape');
  const circleTools=document.getElementById('circle-tools');
  const markerTools=document.getElementById('marker-tools');
  const markerColorEl=document.getElementById('ctl-marker-color');
  const markerScaleEl=document.getElementById('ctl-marker-scale');
  const markerScaleLbl=document.getElementById('lbl-marker-scale');
  const markerKindSel=document.getElementById('ctl-marker-kind');
  const persistBoth=(fn)=>(...a)=>{ fn(...a); persist(); };
  if(nameEl){
    const h=()=>{ item.meta.name = nameEl.value.trim(); };
    nameEl.addEventListener('input', persistBoth(h), {passive:true});
    nameEl.addEventListener('change', persistBoth(h), {passive:true});
  }
  if(r){
    r.addEventListener('input', ()=>{
      const v=+r.value||DEFAULT_RADIUS;
      lr.textContent=v;
      c.setRadius(v);
      persist();
    }, {passive:true});
    r.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(col){
    col.addEventListener('input', ()=>{
      const v=col.value||DEFAULT_COLOR;
      c.setOptions({strokeColor:v, fillColor:v});
      persist();
    }, {passive:true});
    col.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(sw){
    sw.addEventListener('input', ()=>{
      const v=clamp(+sw.value,0,8);
      sw.value=v;
      c.setOptions({strokeWeight:v});
      persist();
    }, {passive:true});
    sw.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(fo){
    fo.addEventListener('input', ()=>{
      const v=clamp(+fo.value,0,0.95);
      lf.textContent=v.toFixed(2);
      c.setOptions({fillOpacity:v});
      persist();
    }, {passive:true});
    fo.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(shapeSel){
    shapeSel.addEventListener('change', ()=>{
      const useMarker = (shapeSel.value === 'marker');
      item.meta.useMarker = useMarker;
      if(circleTools) circleTools.style.display = useMarker ? 'none' : '';
      if(markerTools) markerTools.style.display = useMarker ? '' : 'none';
      applyShapeVisibility(item);
      flushPersist();
      updateMarkersScale();
    }, {passive:true});
  }
  if(markerKindSel){
    markerKindSel.addEventListener('change', ()=>{
      const kind = markerKindSel.value || DEFAULT_MARKER_KIND;
      item.meta.markerKind = kind;
      if(item.meta.useMarker){
        const m = ensureMarker(item);
        m.setIcon(buildMarkerIcon(item.meta.markerColor || DEFAULT_MARKER_COLOR, item.meta.markerScale || DEFAULT_MARKER_SCALE, kind));
      }
      flushPersist();
    }, {passive:true});
  }
  if(markerColorEl){
    markerColorEl.addEventListener('input', ()=>{
      const v = markerColorEl.value || DEFAULT_MARKER_COLOR;
      item.meta.markerColor = v;
      if(item.meta.useMarker){
        const m = ensureMarker(item);
        m.setIcon(buildMarkerIcon(v, item.meta.markerScale || DEFAULT_MARKER_SCALE, item.meta.markerKind || DEFAULT_MARKER_KIND));
      }
      persist();
    }, {passive:true});
    markerColorEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(markerScaleEl){
    markerScaleEl.addEventListener('input', ()=>{
      const scale = +markerScaleEl.value || DEFAULT_MARKER_SCALE;
      markerScaleEl.value = scale;
      if(markerScaleLbl) markerScaleLbl.textContent = scale.toFixed(1);
      item.meta.markerScale = scale;
      if(item.meta.useMarker){
        const m = ensureMarker(item);
        m.setIcon(buildMarkerIcon(item.meta.markerColor || DEFAULT_MARKER_COLOR, scale, item.meta.markerKind || DEFAULT_MARKER_KIND));
      }
      persist();
    }, {passive:true});
    markerScaleEl.addEventListener('change', ()=>{ flushPersist(); }, {passive:true});
  }
  if(save){
    save.addEventListener('click', ()=>{
      item.meta.recipients = parseRecipients(names.value);
      flushPersist();
      if(infoWin){ infoWin.close(); cardPinned = false; }
      showToast('تم الحفظ ✅');
    });
  }
  if(clr){
    clr.addEventListener('click',  ()=>{
      item.meta.recipients=[];
      openCard(item, true);
      flushPersist();
      showToast('تم حذف الأسماء');
    });
  }
  if(del){
    del.addEventListener('click',  ()=>{
      if(confirm('تأكيد حذف الموقع؟')){
        c.setMap(null);
        if(item.marker) item.marker.setMap(null);
        const idx=circles.findIndex(x=>x===item);
        if(idx>=0) circles.splice(idx,1);
        if(infoWin) infoWin.close();
        cardPinned=false;
        flushPersist();
        showToast('تم الحذف');
      }
    });
  }
}
/* ---------------- View-only ---------------- */
function setViewOnly(){
  editMode=false;
  document.body.setAttribute('data-viewonly','1');
  modeBadge.textContent='Share';
  setDraggableForAll(false);
}
/* ---------------- Share ---------------- */
async function copyShareLink(){
  try{
    await navigator.clipboard.writeText(location.href);
    showToast('تم نسخ الرابط ✅');
  }catch{
    const tmp=document.createElement('input'); tmp.value=location.href; document.body.appendChild(tmp);
    tmp.select(); document.execCommand('copy'); tmp.remove(); showToast('تم النسخ');
  }
}
/* ---------------- Helpers ---------------- */
function showToast(msg){ if(!toast) return; toast.textContent=msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'),1600); }
function throttle(fn,ms){
  let last=0, t=null, pending=null;
  return function(...args){
    const now=performance.now();
    if(now-last>=ms){ last=now; fn.apply(this,args); }
    else {
      pending=args;
      clearTimeout(t);
      t=setTimeout(()=>{
        last=performance.now();
        fn.apply(this,pending);
        pending=null;
      }, ms-(now-last));
    }
  };
}
function setDraggableForAll(on){ circles.forEach(it=> it.circle.setDraggable(on)); }
function genNewId(){ let id = -Date.now(); while(circles.some(x=>x.id===id)) id--; return id; }
function nextTick(){ return new Promise(res=> requestAnimationFrame(()=> requestAnimationFrame(res))); }
/* ---------------- Marker & state helpers ---------------- */
function ensureMarker(item){
  if (item.meta && item.meta.useMarker) {
    if (!item.marker) {
      item.marker = new google.maps.Marker({
        map,
        position: item.circle.getCenter(),
        icon: buildMarkerIcon(
          item.meta.markerColor || DEFAULT_MARKER_COLOR,
          item.meta.markerScale || DEFAULT_MARKER_SCALE,
          item.meta.markerKind  || DEFAULT_MARKER_KIND
        ),
        zIndex: 10000
      });
    }
  } else {
    if (item.marker) {
      item.marker.setMap(null);
      item.marker = null;
    }
  }
  return item.marker;
}
function applyShapeVisibility(item){
  const useMarker = !!item.meta.useMarker;
  item.circle.setVisible(true);
  if (useMarker) {
    const m = ensureMarker(item);
    if (m) m.setMap(map);
  } else {
    if (item.marker) item.marker.setMap(null);
  }
}
function updateMarkersScale(){
  const zoom = map.getZoom ? map.getZoom() : BASE_ZOOM;
  circles.forEach(it=>{
    if(it.marker && it.meta && it.meta.useMarker){
      it.marker.setIcon(
        buildMarkerIcon(
          it.meta.markerColor || DEFAULT_MARKER_COLOR,
          it.meta.markerScale || DEFAULT_MARKER_SCALE,
          it.meta.markerKind  || DEFAULT_MARKER_KIND
        )
      );
    }
  });
}
function buildState(){
  const center = map.getCenter();
  const zoom   = map.getZoom();
  const cRows = [];
  const nRows = [];
  circles.forEach(it=>{
    const ctr = it.circle.getCenter();
    const r  = Math.round(it.circle.getRadius());
    const sc = (it.circle.get('strokeColor') || DEFAULT_COLOR).replace('#','');
    const fo = Math.round((it.circle.get('fillOpacity') ?? DEFAULT_FILL_OPACITY) * 100);
    const sw = it.circle.get('strokeWeight') || DEFAULT_STROKE_WEIGHT;
    const rec = (it.meta.recipients || []).join('~');
    const name = it.meta.name || '';
    const useMarker = it.meta.useMarker ? 1 : 0;
    const mc = (it.meta.markerColor || '').replace('#','');
    const ms = it.meta.markerScale || DEFAULT_MARKER_SCALE;
    const mk = it.meta.markerKind || DEFAULT_MARKER_KIND;
    if(it.meta.isNew){
      nRows.push([it.id, ctr.lat(), ctr.lng(), name, r, sc, fo, sw, rec, useMarker, mc, ms, mk]);
    }else{
      cRows.push([it.id, r, sc, fo, sw, rec, name, useMarker, mc, ms, mk]);
    }
  });
  const typ = map.getMapTypeId && map.getMapTypeId();
  let m = 'r';
  if(typ === 'roadmap') m = 'r';
  else if(typ === 'satellite') m = 's';
  else if(typ === 'hybrid') m = 'h';
  else if(typ === 'terrain') m = 't';
  const t = (trafficLayer && trafficLayer.getMap && trafficLayer.getMap()) ? 1 : 0;
  const r = currentRouteOverview ? { ov: currentRouteOverview } : null;
  return {
    p:[center.lng(), center.lat()],
    z:zoom,
    m,
    t,
    c:cRows,
    n:nRows,
    r
  };
}
