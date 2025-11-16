/* Diriyah Security Map – v13.1 (✅ fixed: share btn logic, circle edit mode) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;

function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google.maps && document.readyState !== 'loading'){
    __BOOTED__ = true;
    boot();
    return true;
  }
  return false;
}

window.initMap = function(){ tryBoot(); };

document.addEventListener('DOMContentLoaded', ()=>{
  let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250);
}, {passive:true});

window.addEventListener('load', tryBoot, {once:true, passive:true});

document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden) tryBoot();
  else flushPersist();
}, {passive:true});

/* ---------------- Throttle Function ---------------- */
function throttle(fn, ms){
  let last = 0, timer = null, pendingArgs = null;
  return function(...args){
    const now = performance.now();
    if(now - last >= ms){
      last = now;
      fn.apply(this, args);
    } else {
      pendingArgs = args;
      clearTimeout(timer);
      timer = setTimeout(()=>{
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
let modeBadge, toast;
let mapTypeSelector;

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
const DEFAULT_COLOR  = '#ff0000';
const DEFAULT_FILL_OPACITY = 0.40;
const DEFAULT_STROKE_WEIGHT = 2;
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const BASE_ZOOM = 15;

/* Route style */
let routeStyle = {
  color:   '#3344ff',
  weight:  4,
  opacity: 0.95
};

const LOCATIONS = [
  { id:0,  name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825 },
  { id:1,  name:"منطقة سمحان", lat:24.74091335108621,  lng:46.571891407130025 },
  { id:2,  name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067  },
  { id:3,  name:"إشارة البجيري", lat:24.73766260194535,  lng:46.575429040147306 },
  { id:4,  name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239  },
  { id:5,  name:"نقطة فرز الشلهوب", lat:24.73523670533632,  lng:46.57785639752234  },
  { id:6,  name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035  },
  { id:7,  name:"ميدان الملك سلمان", lat:24.73611373368281,  lng:46.58407097038162  },
  { id:8,  name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052  },
  { id:9,  name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347 },
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
  { id:'pin',    label:'دبوس عام',      svg:pinSvg('#ea4335') },
  { id:'guard',  label:'رجل أمن',       svg:guardSvg('#4285f4') },
  { id:'patrol', label:'دورية أمنية',   svg:patrolSvg('#34a853') },
  { id:'camera', label:'كاميرا مراقبة', svg:cameraSvg('#fbbc04') },
  { id:'gate',   label:'بوابة',         svg:gateSvg('#9aa0a6') },
  { id:'meet',   label:'نقطة تجمع',     svg:meetSvg('#e94235') },
];

function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`; }
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
const parseRecipients=t=>String(t).split(/\r?\n/).map(s=>s.replace(/[،;،,]+/g,' ').trim()).filter(Boolean);
let persistTimer=null;
const persist=()=>{ 
  if(shareMode) return; 
  clearTimeout(persistTimer); 
  persistTimer=setTimeout(()=>{
    writeShare(buildState());
  },300); 
};
// 🔧 تعديل: دالة flushPersist الآن تُرجع الرابط لضمان عمل زر المشاركة
function flushPersist(){ 
  if(shareMode) return location.href; 
  clearTimeout(persistTimer); 
  return writeShare(buildState()); // إرجاع الرابط المحدث
}

// 🔧 جديد: دالة لتحويل المسافة إلى نص مقروء
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} متر`;
  } else {
    return `${(meters / 1000).toFixed(1)} كم`;
  }
}

// 🔧 جديد: دالة لتحويل الوقت إلى نص مقروء
function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} دقيقة`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ساعة`;
    } else {
      return `${hours} ساعة و ${remainingMinutes} دقيقة`;
    }
  }
}

/* Base64URL with compression */
function compressState(state) {
  const compressed = {};
  
  if(state.p && state.p.length === 2) {
    compressed.p = [Number(state.p[0].toFixed(6)), Number(state.p[1].toFixed(6))];
  }
  if(Number.isFinite(state.z)) compressed.z = state.z;
  if(state.m) compressed.m = state.m;
  if(state.t === 1) compressed.t = 1;
  if(state.e === 1) compressed.e = 1;
  
  // 🔧 إصلاح: حفظ أسماء المستلمين بشكل صحيح
  if(state.c && state.c.length > 0) {
    compressed.c = state.c.map(circle => {
      // البحث عن العنصر المناسب في المصفوفة بناءً على الهيكل الصحيح
      const item = circles.find(c => c.id === circle[0]);
      const recipients = item ? item.meta.recipients.join('~') : '';
      return [
        circle[0], // id
        circle[1], // radius
        circle[2]?.replace('#','') || 'ff0000', // color
        circle[3] || '', // name
        recipients // recipients - الإصلاح هنا
      ];
    });
  }
  
  if(state.n && state.n.length > 0) {
    compressed.n = state.n.map(circle => {
      const item = circles.find(c => c.id === circle[0]);
      const recipients = item ? item.meta.recipients.join('~') : '';
      return [
        circle[0], // id
        Number(circle[1].toFixed(6)), // lat
        Number(circle[2].toFixed(6)), // lng
        circle[3] || '', // name
        circle[4] || 20, // radius
        circle[5]?.replace('#','') || 'ff0000', // color
        recipients // recipients - الإصلاح هنا
      ];
    });
  }
  
  // 🔧 إصلاح: حفظ إعدادات نمط المسار بشكل صحيح
  if(state.r && (state.r.ov || state.r.points)) {
    compressed.r = {
      ov: state.r.ov || '',
      points: state.r.points || [],
      style: {
        color: state.r.style?.color || routeStyle.color,
        weight: state.r.style?.weight || routeStyle.weight,
        opacity: state.r.style?.opacity || routeStyle.opacity
      },
      distance: state.r.distance || 0,
      duration: state.r.duration || 0
    };
  } else {
    compressed.r = null;
  }
  
  return compressed;
}

/* ------------------------------------------------------------------ */
/* --- 🔧 تعديل: استخدام TextEncoder لترميز Base64 بكفاءة أكبر --- */
/* ------------------------------------------------------------------ */
function b64uEncode(s){ 
  try {
    // 1. ترميز النص إلى بايتات UTF-8
    const utf8Bytes = new TextEncoder().encode(s);
    // 2. تحويل البايتات إلى سلسلة نصية ثنائية
    const binaryString = String.fromCharCode.apply(null, utf8Bytes);
    // 3. ترميز السلسلة الثنائية باستخدام btoa
    const b = btoa(binaryString);
    return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  } catch(e) {
    console.error('Base64 encoding error:', e);
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* --- 🔧 تعديل: استخدام TextDecoder لفك ترميز Base64 بكفاءة أكبر --- */
/* ------------------------------------------------------------------ */
function b64uDecode(t){
  try{ 
    t=String(t||'').replace(/[^A-Za-z0-9\-_]/g,''); 
    const pad=t.length%4 ? '='.repeat(4-(t.length%4)) : ''; 
    // 1. فك ترميز Base64URL
    const binaryString = atob(t.replace(/-/g,'+').replace(/_/g,'/')+pad);
    // 2. تحويل السلسلة الثنائية إلى مصفوفة بايتات
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    // 3. فك ترميز بايتات UTF-8 إلى نص
    return new TextDecoder().decode(bytes);
  }catch(e){ 
    console.error('Base64 decoding error:', e);
    return ''; 
  } 
}

/* ------------------------------------------------------------------ */
/* --- 🔧 تعديل: قراءة بيانات المشاركة من ?x= بدلاً من #x= --- */
/* ------------------------------------------------------------------ */
function readShare(){ 
  const params = new URLSearchParams(location.search);
  const h = params.get('x'); // القراءة من متغير 'x'
  if(!h) return null; 
  
  try{
    const decoded = b64uDecode(h); // لا حاجة لـ .slice(3)
    if(!decoded) return null;
    const state = JSON.parse(decoded);
    console.log('✅ Loaded shared state from ?x=:', state);
    return state;
  }catch(e){
    console.error('❌ Error parsing shared state:', e);
    return null;
  } 
}

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

const circles = [];

/* ---------------- Route helpers ---------------- */
function ensureDirections(){
  if(!directionsService) directionsService = new google.maps.DirectionsService();
  if(!directionsRenderer){
    directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { ...routeStyle },
      map
    });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: routeStyle.color, strokeWeight: 2 },
    label: { text: String(index+1), color: routeStyle.color, fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: true
  });
  m.addListener('dragend', ()=>{ 
    routePoints[index] = m.getPosition(); 
    requestAndRenderRoute(); 
    persist();
  });
  m.addListener('rightclick', ()=>{ removeRoutePoint(index); });
  return m;
}

function clearRouteVisuals(){
  routeStopMarkers.forEach(m=>m.setMap(null));
  routeStopMarkers = [];
  if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
  if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
  if(routeInfoWin) { routeInfoWin.close(); routeInfoWin = null; }
  currentRouteOverview = null;
  routePoints = [];
  routeDistance = 0;
  routeDuration = 0;
  persist();
}

function addRoutePoint(latLng){
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    persist();
  }
}

function removeRoutePoint(idx){
  if(idx < 0 || idx >= routePoints.length) return;
  routePoints.splice(idx,1);
  if(routeStopMarkers[idx]){ routeStopMarkers[idx].setMap(null); }
  routeStopMarkers.splice(idx,1);
  routeStopMarkers.forEach((m,i)=>{
    if(m.setLabel){
      m.setLabel({ text:String(i+1), color:routeStyle.color, fontSize:'11px', fontWeight:'700' });
    }
  });
  
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    clearRouteVisuals();
  }
}

function requestAndRenderRoute(){
  if(!map) return;
  ensureDirections();
  if(routePoints.length < 2){
    if(directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    if(activeRoutePoly) { activeRoutePoly.setMap(null); activeRoutePoly = null; }
    if(routeInfoWin) { routeInfoWin.close(); routeInfoWin = null; }
    currentRouteOverview = null;
    routeDistance = 0;
    routeDuration = 0;
    persist();
    return;
  }
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  
  console.log('🔄 Requesting route with points:', routePoints.length);
  
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      directionsRenderer.setDirections(result);
      const r = result.routes?.[0];
      currentRouteOverview = r?.overview_polyline?.points || null;
      
      // 🔧 جديد: استخراج المسافة والوقت من النتيجة
      if(r?.legs && r.legs.length > 0) {
        routeDistance = r.legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0);
        routeDuration = r.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);
      }
      
      console.log('✅ Route calculated - Distance:', routeDistance, 'Duration:', routeDuration);
      
      setTimeout(()=>{ extractActivePolyline(); },0);
      flushPersist();
    } else {
      console.error('❌ Route calculation failed:', status);
      showToast('تعذر حساب المسار: ' + status);
      persist();
    }
  });
}

function extractActivePolyline(){
  if(!directionsRenderer) return;
  const dir = directionsRenderer.getDirections();
  if(!dir?.routes?.[0]) return;
  const path = dir.routes[0].overview_path;
  if(!path?.length) return;
  if(activeRoutePoly) activeRoutePoly.setMap(null);
  activeRoutePoly = new google.maps.Polyline({
    map,
    path,
    strokeColor: routeStyle.color,
    strokeWeight: routeStyle.weight,
    strokeOpacity: routeStyle.opacity,
    zIndex: 9997,
    clickable: true
  });
  
  // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
  activeRoutePoly.addListener('click', (e)=>{
    if(shareMode || !editMode) return;
    openRouteCard(e.latLng);
  });
  
  activeRoutePoly.addListener('mouseover', (e)=>{
    if(shareMode || !editMode) return;
    document.body.style.cursor = 'pointer';
  });
  
  activeRoutePoly.addListener('mouseout', (e)=>{
    if(shareMode || !editMode) return;
    document.body.style.cursor = '';
  });
  
  flushPersist();
}

// 🔧 جديد: دالة لعرض كرت معلومات المسار
function openRouteInfoCard(latLng, pinned = false){
  if(!routeInfoWin) {
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
    <div style="background:rgba(255,255,255,0.95); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.08); border-radius:16px; padding:16px; color:#111; box-shadow:0 12px 28px rgba(0,0,0,.15)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:36px;height:36px;background:${routeStyle.color}; border-radius:10px; display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L6.04 7.5 12 10.85l5.96-3.35L12 4.15zM5 15.91l6 3.38v-6.71L5 9.21v6.7zm14 0v-6.7l-6 3.37v6.71l6-3.38z"/>
          </svg>
        </div>
        <div style="flex:1">
          <div style="font-weight:800;font-size:16px;color:#333;">معلومات المسار</div>
          <div style="font-size:12px;color:#666;">${pointCount} نقطة</div>
        </div>
      </div>
      
      <div style="border-top:1px solid #f0f0f0; padding-top:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">المسافة</div>
            <div style="font-weight:700;font-size:14px;color:#333;">${distanceText}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:#666;margin-bottom:4px;">الوقت المتوقع</div>
            <div style="font-weight:700;font-size:14px;color:#333;">${durationText}</div>
          </div>
        </div>
      </div>
      
      ${!shareMode ? `
      <div style="border-top:1px solid #f0f0f0; padding-top:12px; margin-top:12px;">
        <div style="font-size:11px;color:#666;text-align:center;">
          💡 انقر على الخط لتعديل الإعدادات
        </div>
      </div>
      ` : ''}
    </div>
  </div>`;
  
  routeInfoWin.setContent(content);
  routeInfoWin.setPosition(latLng);
  routeInfoWin.open({ map });
  routeCardPinned = pinned;
  
  if(pinned) {
    google.maps.event.addListenerOnce(routeInfoWin, 'closeclick', ()=>{
      routeCardPinned = false;
    });
  }
}

// 🔧 إصلاح كامل: تطبيق إعدادات النمط بشكل صحيح عند استعادة المسار
function restoreRouteFromOverview(polyStr, routePointsArray = null, routeStyleData = null, routeDistanceData = 0, routeDurationData = 0){
  console.log('🔄 Restoring route:', { 
    hasPolyStr: !!polyStr, 
    pointsCount: routePointsArray?.length,
    style: routeStyleData,
    distance: routeDistanceData,
    duration: routeDurationData
  });
  
  if(!polyStr && (!routePointsArray || routePointsArray.length === 0)) {
    console.log('❌ No route data to restore');
    clearRouteVisuals();
    return;
  }
  
  try{
    clearRouteVisuals();
    
    // 🔧 إصلاح: تطبيق إعدادات النمط أولاً قبل إنشاء أي عناصر
    if(routeStyleData){
      routeStyle = {
        color: routeStyleData.color || routeStyle.color,
        weight: routeStyleData.weight || routeStyle.weight,
        opacity: routeStyleData.opacity || routeStyle.opacity
      };
    }
    
    // 🔧 جديد: استعادة معلومات المسافة والوقت
    routeDistance = routeDistanceData || 0;
    routeDuration = routeDurationData || 0;
    
    if(Array.isArray(routePointsArray) && routePointsArray.length > 0){
      routePoints = routePointsArray.map(p => new google.maps.LatLng(p.lat, p.lng));
      console.log('✅ Restored route points:', routePoints.length);
    }
    
    // 🔧 إصلاح: إنشاء المسار مع تطبيق النمط مباشرة
    if(polyStr) {
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
        
        console.log('✅ Restored route polyline with points:', path.length);
        
        // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
        activeRoutePoly.addListener('click', (e)=>{
          if(shareMode || !editMode) return;
          openRouteCard(e.latLng);
        });
        
        activeRoutePoly.addListener('mouseover', (e)=>{
          if(shareMode || !editMode) return;
          document.body.style.cursor = 'pointer';
        });
        
        activeRoutePoly.addListener('mouseout', (e)=>{
          if(shareMode || !editMode) return;
          document.body.style.cursor = '';
        });
      } catch (e) {
        console.error('❌ Error decoding polyline:', e);
      }
    }
    
    // 🔧 إصلاح: إنشاء علامات النقاط مع تطبيق النمط
    if(routePoints.length > 0){
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
            text: String(i+1), 
            color: routeStyle.color, 
            fontSize:'11px', 
            fontWeight:'700' 
          },
          clickable: true,
          draggable: !shareMode
        });
        m.addListener('dragend', ()=>{ 
          routePoints[i] = m.getPosition(); 
          requestAndRenderRoute(); 
          persist();
        });
        m.addListener('rightclick', ()=>{ removeRoutePoint(i); });
        return m;
      });
      console.log('✅ Created route markers:', routeStopMarkers.length);
    }
    
    // 🔧 إصلاح: تحديث directionsRenderer بالنمط الجديد
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: {
          strokeColor: routeStyle.color,
          strokeWeight: routeStyle.weight,
          strokeOpacity: routeStyle.opacity
        }
      });
    }
    
    console.log('✅ Route restoration completed successfully');
    
  }catch(e){
    console.error('❌ Error restoring route:', e);
    if(routePoints.length >= 2) {
      setTimeout(() => {
        console.log('🔄 Retrying route calculation...');
        requestAndRenderRoute();
      }, 1000);
    }
  }
}

/* ---------------- Route Card ---------------- */
function openRouteCard(latLng){
  if(shareMode) return;
  if(routeCardWin) routeCardWin.close();
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

function renderRouteCard(){
  const color   = routeStyle.color   || '#3344ff';
  const weight  = routeStyle.weight  || 4;
  const opacity = routeStyle.opacity || 0.95;
  const distanceText = formatDistance(routeDistance);
  const durationText = formatDuration(routeDuration);
  
  return `
  <div id="route-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">إعدادات المسار</div>
      </div>
      
            <div style="background:rgba(0,0,0,0.03); border-radius:12px; padding:12px; margin-bottom:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px; text-align:center;">
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">المسافة</div>
            <div style="font-weight:700;font-size:13px;color:#333;">${distanceText}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#666;margin-bottom:2px;">الوقت المتوقع</div>
            <div style="font-weight:700;font-size:13px;color:#333;">${durationText}</div>
          </div>
        </div>
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
        <button id="route-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        <button id="route-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}

function attachRouteCardEvents(){
  const colorEl   = document.getElementById('route-color');
  const weightEl  = document.getElementById('route-weight');
  const weightLbl = document.getElementById('route-weight-lbl');
  const opacityEl = document.getElementById('route-opacity');
  const opacityLbl= document.getElementById('route-opacity-lbl');
  const saveBtn   = document.getElementById('route-save');
  const closeBtn  = document.getElementById('route-close');
  
  function apply(){
    const clr = colorEl?.value || routeStyle.color;
    const w   = +weightEl?.value || routeStyle.weight;
    const o   = +opacityEl?.value || routeStyle.opacity;
    routeStyle = { color: clr, weight: w, opacity: o };
    
    // 🔧 إصلاح: تطبيق النمط على جميع عناصر المسار
    if(activeRoutePoly){
      activeRoutePoly.setOptions({ 
        strokeColor: clr, 
        strokeWeight: w, 
        strokeOpacity: o 
      });
    }
    
    routeStopMarkers.forEach(m => {
      if(m.setIcon){
        m.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: clr,
          strokeWeight: 2
        });
      }
      if(m.setLabel){
        m.setLabel({ 
          text: m.getLabel()?.text || '1', 
          color: clr, 
          fontSize: '11px', 
          fontWeight: '700' 
        });
      }
    });
    
    if(directionsRenderer){
      directionsRenderer.setOptions({
        polylineOptions: { 
          strokeColor: clr, 
          strokeWeight: w, 
          strokeOpacity: o 
        }
      });
    }
    
    flushPersist();
  }
  
  if(colorEl) colorEl.addEventListener('input', apply, {passive:true});
  if(weightEl) weightEl.addEventListener('input', apply, {passive:true});
  if(opacityEl) opacityEl.addEventListener('input', apply, {passive:true});
  if(weightEl && weightLbl) weightEl.addEventListener('input', ()=>{ weightLbl.textContent = weightEl.value; });
  if(opacityEl && opacityLbl) opacityEl.addEventListener('input', ()=>{ opacityLbl.textContent = (+opacityEl.value).toFixed(2); });
  if(saveBtn) saveBtn.addEventListener('click', ()=>{ flushPersist(); showToast('✓ تم حفظ إعدادات المسار'); if(routeCardWin){ routeCardWin.close(); routeCardWin = null; } routeCardPinned = false; }, {passive:true});
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(routeCardWin){ routeCardWin.close(); routeCardWin = null; } routeCardPinned = false; }, {passive:true});
}

/* ---------------- State Management ---------------- */

/* ------------------------------------------------------------------ */
/* --- 🔧 تعديل: دالة writeShare الآن تُرجع الرابط --- */
/* ------------------------------------------------------------------ */
function writeShare(state){
  if(shareMode) return location.href; // لا تحفظ في وضع المشاركة
  
  const compressedState = compressState(state);
  const jsonString = JSON.stringify(compressedState);
  const tok = b64uEncode(jsonString);
  
  const newSearch = `?x=${tok}`;
  const newUrlPath = `${location.pathname}${newSearch}`; 
  
  if(location.search !== newSearch){
    history.replaceState(null, '', newUrlPath); 
  }
  
  // إرجاع الرابط الكامل
  return `${location.origin}${newUrlPath}`;
}


function applyState(s){
  if(!s) return;
  
  console.log('🔄 Applying state:', s);
  
  if(Array.isArray(s.p) && s.p.length === 2){ 
    map.setCenter({lat:s.p[1], lng:s.p[0]}); 
  }
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
  
  if (s.t === 1){ 
    trafficLayer.setMap(map); 
    if(btnTraffic) btnTraffic.setAttribute('aria-pressed','true'); 
  } else { 
    trafficLayer.setMap(null); 
    if(btnTraffic) btnTraffic.setAttribute('aria-pressed','false'); 
  }
  
  editMode = !shareMode;
  
  // 🔧 إصلاح: تطبيق إعدادات الدوائر مع أسماء المستلمين
  if(Array.isArray(s.c)){
    s.c.forEach(row=>{
      const [id, radius, color, name, recipients] = row;
      const it = circles.find(x => x.id === id);
      if(!it) return;
      
      it.circle.setOptions({
        radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
        strokeColor: `#${color}`,
        fillColor: `#${color}`,
        fillOpacity: DEFAULT_FILL_OPACITY,
        strokeWeight: DEFAULT_STROKE_WEIGHT
      });
      
      if(name) it.meta.name = name;
      if(recipients) {
        it.meta.recipients = recipients.split('~').filter(Boolean);
      }
      
      applyShapeVisibility(it);
      it.circle.setDraggable(editMode && !it.fixed);
      it.circle.setEditable(false); // 🔧 تعديل: إيقاف التحرير عند التحميل
    });
  }
  
  if(Array.isArray(s.n)){
    s.n.forEach(row=>{
      const [id, la, ln, name, radius, color, recipients] = row;
      const it = circles.find(x => x.id === id);
      if(!it) return;
      
      const pos = {lat:la, lng:ln};
      it.marker.setPosition(pos);
      it.circle.setCenter(pos);
      it.circle.setOptions({
        radius: Number.isFinite(radius) ? radius : DEFAULT_RADIUS,
        strokeColor: `#${color}`,
        fillColor: `#${color}`,
        fillOpacity: DEFAULT_FILL_OPACITY,
        strokeWeight: DEFAULT_STROKE_WEIGHT
      });
      
      if(name) it.meta.name = name;
      if(recipients) {
        it.meta.recipients = recipients.split('~').filter(Boolean);
      }
      
      applyShapeVisibility(it);
      it.marker.setDraggable(editMode && !it.fixed);
      it.circle.setDraggable(editMode && !it.fixed);
      it.circle.setEditable(false); // 🔧 تعديل: إيقاف التحرير عند التحميل
    });
  }
  
  // 🔧 إصلاح: استعادة المسار مع النمط والبيانات
  if(s.r && (s.r.ov || s.r.points)){
    const points = s.r.points ? s.r.points.map(p => ({ lat: p.lat, lng: p.lng })) : [];
    restoreRouteFromOverview(s.r.ov, points, s.r.style, s.r.distance, s.r.duration);
  } else {
    clearRouteVisuals();
  }
  
  // 🔧 جديد: ضمان إخفاء عناصر التحرير في وضع المشاركة
  if(shareMode){
    document.body.classList.add('share-mode');
    if(modeBadge) modeBadge.style.display = 'none';
    if(btnShare) btnShare.style.display = 'none';
    if(btnAdd) btnAdd.style.display = 'none';
    if(btnRoute) btnRoute.style.display = 'none';
    if(btnRouteClear) btnRouteClear.style.display = 'none';
    if(mapTypeSelector) mapTypeSelector.style.display = 'none';
  }
}

function buildState(){
  const center = map.getCenter();
  const s = {
    p: [Number(center.lng().toFixed(6)), Number(center.lat().toFixed(6))],
    z: map.getZoom(),
    m: (map.getMapTypeId()||'roadmap').slice(0,1),
    t: (trafficLayer && trafficLayer.getMap()) ? 1 : 0,
    e: editMode ? 1 : 0,
    c: [], // fixed circles
    n: []  // new markers
  };
  
  circles.forEach(it => {
    const m = it.meta;
    const c = it.circle;
    const r = c.getRadius();
    const clr = toHex(c.get('fillColor'));
    
    if(it.fixed){
      if(m.name !== it.defaultName || r !== DEFAULT_RADIUS || clr !== DEFAULT_COLOR){
        s.c.push([ it.id, r, clr.slice(1), m.name ]);
      }
    } else {
      const pos = it.marker.getPosition();
      s.n.push([
        it.id,
        Number(pos.lat().toFixed(6)),
        Number(pos.lng().toFixed(6)),
        m.name,
        r,
        clr.slice(1)
      ]);
    }
  });
  
  // 🔧 إصلاح: حفظ بيانات المسار
  if(routePoints.length > 0) {
    s.r = {
      ov: currentRouteOverview || '',
      points: routePoints.map(p => ({ lat: p.lat(), lng: p.lng() })),
      style: routeStyle,
      distance: routeDistance,
      duration: routeDuration
    };
  } else {
    s.r = null;
  }
  
  return s;
}

/* ---------------- InfoWindow Card ---------------- */
function openCard(item){
  if(infoWin) infoWin.close();
  infoWin = new google.maps.InfoWindow({
    content: renderCard(item),
    position: item.marker.getPosition(),
    maxWidth: 380,
    pixelOffset: new google.maps.Size(0, -32) // Adjust for pin
  });
  infoWin.open({ map, anchor: item.marker });
  cardPinned = true;
  
  // 🔧 تعديل: تفعيل التحرير عند فتح الكرت (فقط للدوائر غير الثابتة)
  if(editMode && !item.fixed) {
    item.circle.setEditable(true);
  }
  
  google.maps.event.addListenerOnce(infoWin, 'domready', () => {
    attachCardEvents(item);
  });
  
  google.maps.event.addListenerOnce(infoWin, 'closeclick', ()=>{
    cardPinned = false;
    // 🔧 تعديل: إلغاء تفعيل التحرير عند إغلاق الكرت
    item.circle.setEditable(false);
    scheduleCardHide();
  });
}

function showHoverCard(item){
  if(cardPinned) return;
  circleHovering = true;
  clearTimeout(cardHideTimer);
  
  if(!infoWin) infoWin = new google.maps.InfoWindow({ maxWidth: 380, pixelOffset: new google.maps.Size(0, -32) });
  
  infoWin.setContent(renderCard(item, true));
  infoWin.open({ map, anchor: item.marker });
  
  const root = infoWin.getContent();
  if(root && root.addEventListener){
    root.addEventListener('mouseenter', ()=>{ cardHovering = true; clearTimeout(cardHideTimer); });
    root.addEventListener('mouseleave', ()=>{ cardHovering = false; scheduleCardHide(); });
  }
}

function renderCard(item, isHover = false){
  const m = item.meta;
  const c = item.circle;
  const pos = item.marker.getPosition();
  const name = m.name || item.defaultName;
  const radius = c.getRadius();
  const color = toHex(c.get('fillColor'));
  const lat = pos.lat().toFixed(6);
  const lng = pos.lng().toFixed(6);
  const isNew = !item.fixed;
  const kind = m.kind || DEFAULT_MARKER_KIND;
  const scale = m.scale || DEFAULT_MARKER_SCALE;
  const recipients = m.recipients.join('\n');
  
  if(isHover && !editMode){
    return `
    <div dir="rtl" style="min-width:200px">
      <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                  border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:12px 16px; color:#111; box-shadow:0 12px 28px rgba(0,0,0,.15)">
        <div style="font-weight:800;font-size:16px;margin-bottom:4px;">${escapeHtml(name)}</div>
        <div style="font-size:12px;color:#555;">النطاق: ${radius.toFixed(0)} متر</div>
        ${m.recipients.length > 0 ? `
        <div style="font-size:12px;color:#555;margin-top:4px;border-top:1px solid #f0f0f0;padding-top:4px;">
          <strong>المستلمون:</strong> ${escapeHtml(m.recipients.join(', '))}
        </div>` : ''}
      </div>
    </div>`;
  }
  
  const markerKindOptions = MARKER_KINDS.map(k => `<option value="${k.id}" ${k.id === kind ? 'selected' : ''}>${k.label}</option>`).join('');
  
  return `
  <div id="info-card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">${isNew ? 'تعديل النقطة' : 'تعديل النطاق'}</div>
      </div>
      
      <div class="field"><label>الاسم:</label>
        <input id="card-name" type="text" value="${escapeHtml(name)}" ${isNew ? '' : 'disabled'} style="border:1px solid #ddd;border-radius:6px;padding:4px 6px;width:100%;box-sizing:border-box;"></div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="field"><label>اللون:</label>
          <input id="card-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        <div class="field"><label>النطاق (متر):</label>
          <input id="card-radius" type="range" min="5" max="500" step="5" value="${radius}" style="width:100%;">
          <span id="card-radius-lbl" style="font-size:12px;color:#666">${radius.toFixed(0)}م</span></div>
        <div class="field"><label>حجم الأيقونة:</label>
          <input id="card-scale" type="range" min="0.5" max="2.0" step="0.1" value="${scale}" style="width:100%;">
          <span id="card-scale-lbl" style="font-size:12px;color:#666">${scale.toFixed(1)}x</span></div>
      </div>
      
      ${isNew ? `
      <div class="field" style="margin-bottom:10px;"><label>نوع الأيقونة:</label>
        <select id="card-kind" style="width:100%;border:1px solid #ddd;border-radius:6px;padding:4px 6px;box-sizing:border-box;">${markerKindOptions}</select>
      </div>` : ''}
      
      <div class="field" style="margin-bottom:10px;"><label>المستلمون (اكتب كل اسم في سطر):</label>
        <textarea id="card-recipients" rows="2" style="width:100%;border:1px solid #ddd;border-radius:6px;padding:4px 6px;box-sizing:border-box;font-size:12px;">${escapeHtml(recipients)}</textarea>
      </div>
      
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="card-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        ${isNew ? `<button id="card-del" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;color:#c00;">حذف</button>` : ''}
        <button id="card-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
      
      <div style="font-size:10px;color:#999;text-align:center;margin-top:8px;">${lat}, ${lng}</div>
    </div>
  </div>`;
}

function attachCardEvents(item){
  const nameEl    = document.getElementById('card-name');
  const colorEl   = document.getElementById('card-color');
  const radiusEl  = document.getElementById('card-radius');
  const radiusLbl = document.getElementById('card-radius-lbl');
  const scaleEl   = document.getElementById('card-scale');
  const scaleLbl  = document.getElementById('card-scale-lbl');
  const kindEl    = document.getElementById('card-kind');
  const recipEl   = document.getElementById('card-recipients');
  const saveBtn   = document.getElementById('card-save');
  const delBtn    = document.getElementById('card-del');
  const closeBtn  = document.getElementById('card-close');
  
  function apply(){
    const r = +radiusEl.value;
    const c = colorEl.value;
    const s = +scaleEl.value;
    const k = kindEl ? kindEl.value : item.meta.kind;
    
    item.circle.setOptions({ radius: r, strokeColor: c, fillColor: c, fillOpacity: DEFAULT_FILL_OPACITY });
    item.marker.setIcon(buildMarkerIcon(c, s, k));
    
    if(nameEl && !nameEl.disabled) item.meta.name = nameEl.value.trim();
    item.meta.kind = k;
    item.meta.scale = s;
    item.meta.recipients = parseRecipients(recipEl.value);
    
    applyShapeVisibility(item);
    persist();
  }
  
  if(colorEl) colorEl.addEventListener('input', apply, {passive:true});
  if(radiusEl) radiusEl.addEventListener('input', apply, {passive:true});
  if(scaleEl) scaleEl.addEventListener('input', apply, {passive:true});
  if(kindEl) kindEl.addEventListener('input', apply, {passive:true});
  if(radiusEl && radiusLbl) radiusEl.addEventListener('input', ()=>{ radiusLbl.textContent = (+radiusEl.value).toFixed(0) + 'م'; });
  if(scaleEl && scaleLbl) scaleEl.addEventListener('input', ()=>{ scaleLbl.textContent = (+scaleEl.value).toFixed(1) + 'x'; });
  
  if(saveBtn) saveBtn.addEventListener('click', ()=>{ 
    apply(); 
    showToast('✓ تم حفظ التعديلات'); 
    if(infoWin){ infoWin.close(); infoWin = null; } 
    cardPinned = false; 
    item.circle.setEditable(false); // 🔧 تعديل: إيقاف التحرير
  }, {passive:true});
  
  if(closeBtn) closeBtn.addEventListener('click', ()=>{ 
    if(infoWin){ infoWin.close(); infoWin = null; } 
    cardPinned = false; 
    item.circle.setEditable(false); // 🔧 تعديل: إيقاف التحرير
  }, {passive:true});
  
  if(delBtn) delBtn.addEventListener('click', ()=>{
    if(confirm(`هل أنت متأكد من حذف "${item.meta.name || item.defaultName}"؟`)){
      deleteItem(item);
      if(infoWin){ infoWin.close(); infoWin = null; }
      cardPinned = false;
      persist();
    }
  }, {passive:true});
}

function deleteItem(item){
  if(!item) return;
  item.marker.setMap(null);
  item.circle.setMap(null);
  const idx = circles.findIndex(c => c.id === item.id);
  if(idx > -1) circles.splice(idx, 1);
}

function applyShapeVisibility(item){
  if(!item) return;
  const r = item.circle.getRadius();
  const showRadius = r >= 5;
  item.circle.setVisible(showRadius);
}

/* ---------------- Object Creation ---------------- */
function createMarker(item){
  const pos = { lat:item.lat, lng:item.lng };
  const m = new google.maps.Marker({
    position: pos,
    map: map,
    icon: buildMarkerIcon(DEFAULT_MARKER_COLOR, DEFAULT_MARKER_SCALE, DEFAULT_MARKER_KIND),
    draggable: editMode && !item.fixed,
    title: item.name
  });
  return m;
}

function createCircle(item){
  const pos = { lat:item.lat, lng:item.lng };
  const c = new google.maps.Circle({
    map: map,
    center: pos,
    radius: DEFAULT_RADIUS,
    strokeColor: DEFAULT_COLOR,
    strokeWeight: DEFAULT_STROKE_WEIGHT,
    fillColor: DEFAULT_COLOR,
    fillOpacity: DEFAULT_FILL_OPACITY,
    draggable: editMode && !item.fixed,
    editable: false, // 🔧 تعديل: إيقاف التحرير عند الإنشاء
    clickable: true
  });
  return c;
}

function attachListeners(item){
  const { marker, circle } = item;
  
  // Dragging
  if(!item.fixed){
    marker.addListener('drag', throttle(()=>{
      circle.setCenter(marker.getPosition());
    }, 50));
    marker.addListener('dragend', ()=>{
      circle.setCenter(marker.getPosition());
      persist();
    });
    circle.addListener('drag', throttle(()=>{
      marker.setPosition(circle.getCenter());
    }, 50));
    circle.addListener('dragend', ()=>{
      marker.setPosition(circle.getCenter());
      persist();
    });
  }
  
  // Editing radius
  circle.addListener('radius_changed', throttle(()=>{
    applyShapeVisibility(item);
    persist();
  }, 250));
  
  // Click
  const clickHandler = ()=>{
    if(addMode || routeMode) return;
    if(editMode) openCard(item);
    else showHoverCard(item);
  };
  marker.addListener('click', clickHandler);
  circle.addListener('click', clickHandler);
  
  // Hover
  const hoverOn = ()=>{
    if(addMode || routeMode || cardPinned) return;
    showHoverCard(item);
  };
  const hoverOff = ()=>{
    circleHovering = false;
    scheduleCardHide();
  };
  
  marker.addListener('mouseover', hoverOn);
  marker.addListener('mouseout', hoverOff);
  circle.addListener('mouseover', hoverOn);
  circle.addListener('mouseout', hoverOff);
}

function addNewMarker(latLng){
  if(!editMode) return;
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
    meta: { name: "نقطة جديدة", kind: DEFAULT_MARKER_KIND, scale: DEFAULT_MARKER_SCALE, recipients: [] }
  };
  
  attachListeners(item);
  circles.push(item);
  openCard(item); // 🔧 سيقوم هذا بتفعيل التحرير
  persist();
}

/* ---------------- Toast ---------------- */
function initToast(){
  toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.setAttribute('role','status');
  toast.setAttribute('aria-live','polite');
  toast.style.cssText = `
    position: fixed;
    bottom: -100px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(30, 30, 30, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 14px;
    z-index: 99999;
    transition: bottom 0.5s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 90%;
    text-align: center;
  `;
  document.body.appendChild(toast);
}
let toastTimer = null;
function showToast(message, duration = 3000){
  if(!toast) initToast();
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.style.bottom = '20px';
  toastTimer = setTimeout(() => {
    toast.style.bottom = '-100px';
  }, duration);
}

/* ---------------- Boot Function ---------------- */
function boot(){
  console.log('Booting Diriyah Map v13.1...');
  
  const sharedState = readShare();
  if(sharedState){
    console.log('🛰️ Share mode detected');
    shareMode = true;
    editMode = false;
  } else {
    console.log('Standard edit mode');
    shareMode = false;
    editMode = true;
  }
  
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: BASE_ZOOM,
    mapTypeId: 'roadmap',
    mapId: 'YOUR_MAP_ID_HERE', // 💡 استبدل هذا بمعرف الخريطة الخاص بك
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
  
  LOCATIONS.forEach(loc => {
    const marker = createMarker(loc);
    const circle = createCircle(loc);
    const item = {
      id: loc.id,
      marker,
      circle,
      fixed: true,
      defaultName: loc.name,
      meta: { name: loc.name, kind: DEFAULT_MARKER_KIND, scale: DEFAULT_MARKER_SCALE, recipients: [] }
    };
    attachListeners(item);
    circles.push(item);
  });
  
  if(sharedState){
    applyState(sharedState);
  } 
  
  map.addListener('zoom_changed', throttle(()=>{
    circles.forEach(it => {
      const m = it.meta;
      const c = it.circle;
      const clr = toHex(c.get('fillColor'));
      it.marker.setIcon(buildMarkerIcon(clr, m.scale, m.kind));
    });
    persist();
  }, 200));
  
  map.addListener('center_changed', throttle(persist, 1000));
  map.addListener('maptypeid_changed', persist);
  
  map.addListener('click', (e)=>{
    if(shareMode) return;
    
    if(addMode){
      addNewMarker(e.latLng);
      setMode('edit');
    } else if(routeMode){
      addRoutePoint(e.latLng);
    } else {
      if(!editMode && activeRoutePoly && google.maps.geometry.poly.isLocationOnEdge(e.latLng, activeRoutePoly, 1e-3)) {
        openRouteInfoCard(e.latLng, true);
      }
    }
  });
  
  map.addListener('mousemove', throttle((e)=>{
    if(shareMode || editMode) {
      if(activeRoutePoly && google.maps.geometry.poly.isLocationOnEdge(e.latLng, activeRoutePoly, 1e-3)) {
        if(!routeCardPinned) openRouteInfoCard(e.latLng, false);
      } else {
        if(routeInfoWin && !routeCardPinned) routeInfoWin.close();
      }
    }
  }, 100));
  
  /* Controls */
  btnTraffic = document.getElementById('btn-traffic');
  btnShare = document.getElementById('btn-share');
  btnAdd = document.getElementById('btn-add-marker');
  btnRoute = document.getElementById('btn-route');
  btnRouteClear = document.getElementById('btn-route-clear');
  modeBadge = document.getElementById('mode-badge');
  mapTypeSelector = document.getElementById('map-type-selector');
  
  if(btnTraffic) btnTraffic.addEventListener('click', ()=>{
    const pressed = btnTraffic.getAttribute('aria-pressed') === 'true';
    if(pressed){
      trafficLayer.setMap(null);
      btnTraffic.setAttribute('aria-pressed', 'false');
    } else {
      trafficLayer.setMap(map);
      btnTraffic.setAttribute('aria-pressed', 'true');
    }
    persist();
  });
  
  // 🔧 تعديل: زر المشاركة يستخدم الآن الرابط المُرجع من flushPersist
  if(btnShare) btnShare.addEventListener('click', ()=>{
    const url = flushPersist(); // الحصول على الرابط المحدث مباشرة
    const recipients = circles.flatMap(c => c.meta.recipients).filter((v,i,a) => a.indexOf(v) === i);
    const shareTitle = 'خريطة الدرعية الأمنية';
    const shareText = `خريطة محدثة. المستلمون: ${recipients.join(', ')}\n${url}`;
    
    if(navigator.share){
      navigator.share({ title: shareTitle, text: shareText, url: url })
        .then(()=> showToast('✓ تمت مشاركة الرابط'))
        .catch((e)=> showToast('لم تتم المشاركة: ' + e.message));
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url)
        .then(()=> showToast('✓ تم نسخ الرابط إلى الحافظة'))
        .catch((e)=> showToast('فشل النسخ: ' + e.message));
    } else {
      showToast('المشاركة غير مدعومة على هذا المتصفح');
    }
  });
  
  if(btnAdd) btnAdd.addEventListener('click', ()=> setMode('add'));
  if(btnRoute) btnRoute.addEventListener('click', ()=> setMode('route'));
  if(btnRouteClear) btnRouteClear.addEventListener('click', ()=>{
    if(confirm('هل أنت متأكد من حذف المسار الحالي؟')){
      clearRouteVisuals();
      setMode('edit');
      showToast('تم حذف المسار');
    }
  });
  
  if(mapTypeSelector) mapTypeSelector.addEventListener('change', (e)=>{
    const mapTypeId = e.target.value;
    if(['roadmap','satellite','hybrid','terrain'].includes(mapTypeId)){
      map.setMapTypeId(mapTypeId);
      persist();
    }
  });
  
  if(shareMode){
    document.body.classList.add('share-mode');
    if(modeBadge) modeBadge.style.display = 'none';
    if(btnShare) btnShare.style.display = 'none';
    if(btnAdd) btnAdd.style.display = 'none';
    if(btnRoute) btnRoute.style.display = 'none';
    if(btnRouteClear) btnRouteClear.style.display = 'none';
    if(mapTypeSelector) mapTypeSelector.style.display = 'none';
  } else {
    document.body.classList.remove('share-mode');
    setMode('edit'); // Set default mode
  }
  
  console.log('✅ Map boot complete.');
}

function setMode(mode){
  if(shareMode) mode = 'view';
  
  addMode = (mode === 'add');
  routeMode = (mode === 'route');
  
  map.setOptions({ draggableCursor: addMode ? 'crosshair' : (routeMode ? 'copy' : null) });
  if(modeBadge) modeBadge.textContent = addMode ? 'إضافة نقطة' : (routeMode ? 'رسم مسار' : 'وضع التحرير');
  if(modeBadge) modeBadge.style.display = (addMode || routeMode) ? 'inline-block' : 'none';
  
  // Toggle route clear button visibility
  if(btnRouteClear) btnRouteClear.style.display = routeMode ? 'flex' : 'none';
  
  // Reset other buttons
  if(btnAdd) btnAdd.setAttribute('aria-pressed', addMode ? 'true' : 'false');
  if(btnRoute) btnRoute.setAttribute('aria-pressed', routeMode ? 'true' : 'false');
  
  // Close any open windows
  if(infoWin) infoWin.close();
  cardPinned = false;
}
