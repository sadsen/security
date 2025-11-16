/* Diriyah Security Map – v13.1 (✅ fixed: route sharing, recipients, and toast) */
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
function flushPersist(){ 
  if(shareMode) return; 
  clearTimeout(persistTimer); 
  writeShare(buildState());
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
  } else {
    // 🔧 إصلاح: التأكد من تطبيق النمط الحالي إذا كان قد تم إنشاء directionsRenderer بالفعل
    directionsRenderer.setOptions({ polylineOptions: { ...routeStyle } });
  }
}

function createStopMarker(position, index){
  const m = new google.maps.Marker({
    position,
    map,
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#ffffff', fillOpacity: 1, strokeColor: routeStyle.color, strokeWeight: 2 },
    label: { text: String(index+1), color: routeStyle.color, fontSize:'11px', fontWeight:'700' },
    clickable: true,
    draggable: !shareMode && editMode // 🔧 إصلاح: التفعيل فقط في وضع التحرير وليس المشاركة
  });
  if(!shareMode && editMode) { // 🔧 إصلاح: إضافة المستمعات فقط في وضع التحرير
    m.addListener('dragend', ()=>{ 
      routePoints[index] = m.getPosition(); 
      requestAndRenderRoute(); 
      persist();
    });
    m.addListener('rightclick', ()=>{ removeRoutePoint(index); });
  }
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
  // 🔧 إصلاح: التأكد من تحديث حالة الأزرار
  if(btnRouteClear) btnRouteClear.style.display = 'none';
  persist();
}

function addRoutePoint(latLng){
  if(shareMode || !editMode) return; // 🔧 إصلاح: لا يمكن الإضافة في وضع المشاركة
  routePoints.push(latLng);
  const idx = routePoints.length - 1;
  const m = createStopMarker(latLng, idx);
  routeStopMarkers.push(m);
  
  if(routePoints.length >= 2) {
    requestAndRenderRoute();
  } else {
    persist();
  }
  if(btnRouteClear) btnRouteClear.style.display = 'inline-block';
}

function removeRoutePoint(idx){
  if(shareMode || !editMode) return; // 🔧 إصلاح: لا يمكن الحذف في وضع المشاركة
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
  if(routePoints.length === 0 && btnRouteClear) btnRouteClear.style.display = 'none';
}

const requestAndRenderRoute = throttle(function(){
  if(!map || routePoints.length < 2) {
    if(routePoints.length < 2) clearRouteVisuals(); // تنظيف إذا كان هناك أقل من نقطتين
    return;
  }
  ensureDirections();
  
  const origin = routePoints[0];
  const destination = routePoints[routePoints.length - 1];
  const waypoints = routePoints.slice(1, -1).map(p => ({ location: p, stopover: true }));
  const req = { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false };
  
  console.log('🔄 Requesting route with points:', routePoints.length);
  
  directionsService.route(req, (result, status) => {
    if(status === 'OK' && result){
      // 🔧 إصلاح: التأكد من تطبيق النمط على الـ Renderer
      directionsRenderer.setOptions({ polylineOptions: { ...routeStyle } });
      directionsRenderer.setDirections(result);
      const r = result.routes?.[0];
      currentRouteOverview = r?.overview_polyline; // حفظ الكائن
      
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
}, 500);


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
    clickable: !shareMode && editMode // 🔧 إصلاح: قابلية النقر فقط في وضع التحرير
  });
  
  // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
  if(!shareMode && editMode) {
    activeRoutePoly.addListener('click', (e)=>{
      openRouteCard(e.latLng);
    });
    activeRoutePoly.addListener('mouseover', (e)=>{
      document.body.style.cursor = 'pointer';
    });
    activeRoutePoly.addListener('mouseout', (e)=>{
      document.body.style.cursor = '';
    });
  }
  
  flushPersist();
}

// 🔧 جديد: دالة لعرض كرت معلومات المسار
function openRouteInfoCard(latLng, pinned = false){
  // إذا كان وضع التحرير مفعلاً، افتح بطاقة التعديل بدلاً من بطاقة المعلومات البسيطة
  if(editMode && !shareMode) {
    openRouteCard(latLng);
    return;
  }
  
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
      
      ${(!shareMode && editMode) ? `
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
    
    // 🔧 إصلاح: إنشاء المسار مع تطبيق النمط مباشرة - مهم للمشاركة
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
          clickable: !shareMode && editMode
        });
        currentRouteOverview = polyStr;
        
        console.log('✅ Restored route polyline with points:', path.length);
        
        // 🔧 إصلاح: إضافة حدث النقر على الخط لفتح إعدادات المسار
        if(!shareMode && editMode) {
          activeRoutePoly.addListener('click', (e)=>{
            openRouteCard(e.latLng);
          });
          
          activeRoutePoly.addListener('mouseover', (e)=>{
            document.body.style.cursor = 'pointer';
          });
          
          activeRoutePoly.addListener('mouseout', (e)=>{
            document.body.style.cursor = '';
          });
        }
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
          draggable: !shareMode && editMode
        });
        if(!shareMode && editMode) {
          m.addListener('dragend', ()=>{ 
            routePoints[i] = m.getPosition(); 
            requestAndRenderRoute(); 
            persist();
          });
          m.addListener('rightclick', ()=>{ removeRoutePoint(i); });
        }
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
    
    // 🔧 إصلاح: التأكد من ظهور زر التنظيف
    if(routePoints.length > 0 && btnRouteClear) btnRouteClear.style.display = 'inline-block';
    
    // 🔧 إصلاح: عرض معلومات المسار على المسار المستعاد عند المشاركة
    if(activeRoutePoly && shareMode) {
      activeRoutePoly.addListener('click', (e) => openRouteInfoCard(e.latLng, true));
      // افتح بطاقة المعلومات فوراً في وضع المشاركة
      setTimeout(() => {
        const center = new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        openRouteInfoCard(center);
      }, 100);
    }
    
    console.log('✅ Route restoration completed successfully');
    
  }catch(e){
    console.error('❌ Error restoring route:', e);
    if(routePoints.length >= 2 && !shareMode) { // لا تحاول إعادة الحساب في وضع المشاركة
      setTimeout(() => {
        console.log('🔄 Retrying route calculation...');
        requestAndRenderRoute();
      }, 1000);
    }
  }
}

/* ---------------- Route Card ---------------- */
function openRouteCard(latLng){
  if(shareMode || !editMode) return; // 🔧 إصلاح: لا يمكن الفتح في وضع المشاركة أو خارج وضع التحرير
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

// 🔧 وظيفة جديدة/مُعدلة: بناء كائن الحالة الحالي للخريطة
function buildState(){
  const center = map ? map.getCenter() : new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
  const zoom = map ? map.getZoom() : BASE_ZOOM;
  const state = {
    p: [center.lat(), center.lng()],
    z: zoom,
    m: map ? map.getMapTypeId() : 'roadmap',
    t: trafficLayer && trafficLayer.getMap() === map ? 1 : 0,
    e: editMode ? 1 : 0,
    c: circles.filter(c=>c.isCircle).map(c=>[c.id, c.circle.getRadius(), c.meta.color, c.meta.name]),
    n: circles.filter(c=>!c.isCircle).map(c=>[c.id, c.marker.getPosition().lat(), c.marker.getPosition().lng(), c.meta.name, c.meta.scale, c.meta.color, c.meta.kind])
  };
  
  // 🔧 إصلاح: حفظ حالة المسار بالكامل
  if(routePoints.length >= 2 || currentRouteOverview) {
    state.r = {
      ov: currentRouteOverview?.points || currentRouteOverview || '', // قد يكون string أو object يحتوي على points
      points: routePoints.map(p => ({ lat: p.lat(), lng: p.lng() })),
      style: routeStyle,
      distance: routeDistance,
      duration: routeDuration
    };
  } else {
    state.r = null;
  }
  
  return state;
}

/* ------------------------------------------------------------------ */
/* --- 🔧 تعديل: كتابة بيانات المشاركة إلى ?x= بدلاً من #x= --- */
/* ------------------------------------------------------------------ */
function writeShare(state){
  if(shareMode) return;
  
  const compressedState = compressState(state);
  const jsonString = JSON.stringify(compressedState);
  const tok = b64uEncode(jsonString);
  
  const newSearch = `?x=${tok}`;
  // إنشاء رابط URL كامل يتضمن المسار الحالي ومتغير البحث الجديد
  const newUrl = `${location.pathname}${newSearch}`; 
  
  // 🔧 تعديل: المقارنة مع .search بدلاً من .hash
  if(location.search !== newSearch){
    // استخدام replaceState لتحديث الرابط في شريط العناوين دون إعادة تحميل الصفحة
    history.replaceState(null, '', newUrl); 
  }
}


function applyState(s){
  if(!s) return;
  
  console.log('🔄 Applying state:', s);
  
  if(Array.isArray(s.p) && s.p.length === 2){
    map.setCenter(new google.maps.LatLng(s.p[0], s.p[1]));
  }
  if(Number.isFinite(s.z)) map.setZoom(s.z);
  if(s.m) map.setMapTypeId(s.m);
  if(s.t === 1) toggleTraffic(true);
  else toggleTraffic(false);
  
  // 🔧 إصلاح: التعامل مع وضع التحرير والمشاركة
  editMode = (s.e === 1) && !shareMode;
  updateUiForMode(); // تحديث واجهة المستخدم بناءً على الوضع الجديد
  
  // Clear existing circles (assuming they exist, handles duplicates)
  circles.forEach(c=>{ c.setMap(null); if(c.meta.infoWin) c.meta.infoWin.close(); });
  circles.length = 0;
  
  // Circles
  if(Array.isArray(s.c)){
    s.c.forEach(c=>{
      // [id, radius, color, name, recipients]
      const recipientList = (c[4]||'').split('~').filter(Boolean);
      const location = LOCATIONS.find(l=>l.id===c[0]);
      if(location){
        const item = createCircle(new google.maps.LatLng(location.lat, location.lng), true, c[0]);
        item.meta.name = c[3] || location.name;
        item.meta.color = c[2] ? ('#'+c[2]) : DEFAULT_COLOR;
        item.meta.recipients = recipientList;
        item.circle.setRadius(clamp(c[1]||DEFAULT_RADIUS, 10, 500));
        item.circle.setOptions({
          fillColor: item.meta.color,
          strokeColor: item.meta.color
        });
        circles.push(item);
      }
    });
  }
  
  // New markers (not in LOCATIONS)
  if(Array.isArray(s.n)){
    s.n.forEach((n, idx)=>{
      // [id, lat, lng, name, scale, color, kind, recipients]
      const recipientList = (n[6]||'').split('~').filter(Boolean);
      const item = createCircle(new google.maps.LatLng(n[1], n[2]), false, idx+10000);
      item.meta.name = n[3] || 'نقطة مضافة';
      item.meta.scale = clamp(+n[4]||DEFAULT_MARKER_SCALE, 0.5, 3);
      item.meta.color = n[5] ? ('#'+n[5]) : DEFAULT_MARKER_COLOR;
      item.meta.kind = n[6] || DEFAULT_MARKER_KIND;
      item.meta.recipients = recipientList;
      item.marker.setIcon(buildMarkerIcon(item.meta.color, item.meta.scale, item.meta.kind));
      circles.push(item);
    });
  }
  
  // 🔧 إصلاح: استعادة المسار من بيانات الحالة
  if(s.r && (s.r.ov || (s.r.points && s.r.points.length >= 2))){
    const points = Array.isArray(s.r.points) ? s.r.points : null;
    restoreRouteFromOverview(s.r.ov, points, s.r.style, s.r.distance, s.r.duration);
  }
}


/* ---------------- Map Initialization ---------------- */
function boot(){
  // 🔧 إصلاح: البحث عن العناصر العلوية اليمنى
  btnTraffic = document.getElementById('btnTraffic');
  btnShare = document.getElementById('btnShare');
  btnAdd = document.getElementById('btnAdd');
  btnRoute = document.getElementById('btnRoute');
  btnRouteClear = document.getElementById('btnRouteClear'); // 🔧 إصلاح: متغير لزر تنظيف المسار
  modeBadge = document.getElementById('modeBadge');
  toast = document.getElementById('toast');
  mapTypeSelector = document.getElementById('mapTypeSelector');
  const btnEditMode = document.getElementById('btnEditMode');
  
  // 🔧 إصلاح: التحقق من وضع المشاركة من URL أولاً
  const initialShareState = readShare();
  shareMode = !!initialShareState;
  editMode = !shareMode; // لا تحرير في وضع المشاركة
  
  map = new google.maps.Map(document.getElementById('map'), {
    center: DEFAULT_CENTER,
    zoom: BASE_ZOOM,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    clickableIcons: true,
    gestureHandling: 'greedy'
  });
  
  // Initial map load / state application
  if(initialShareState){
    applyState(initialShareState);
  } else {
    // Default state when no shared state is present
    const defaultState = buildState();
    writeShare(defaultState); // Save current state to URL
    applyState(defaultState);
  }
  
  // Traffic Layer
  trafficLayer = new google.maps.TrafficLayer();
  if(initialShareState && initialShareState.t === 1) trafficLayer.setMap(map);
  
  // Markers (Circles) from LOCATIONS
  LOCATIONS.forEach(loc => {
    const item = createCircle(new google.maps.LatLng(loc.lat, loc.lng), true, loc.id);
    item.meta.name = loc.name;
    circles.push(item);
  });
  
  // 🔧 إصلاح: تحديث واجهة المستخدم بعد التحميل وتطبيق الحالة
  updateUiForMode();
  updateMapTypeSelector();
  
  // Event Listeners
  map.addListener('click', (e) => {
    if(addMode) {
      addPointToMap(e.latLng, false);
      toggleAddMode();
    } else if (routeMode) {
      addRoutePoint(e.latLng);
    } else {
      if(infoWin) infoWin.close();
      if(routeCardWin) routeCardWin.close();
      if(routeInfoWin) routeInfoWin.close();
      cardPinned = false;
      routeCardPinned = false;
    }
  });
  
  map.addListener('idle', throttle(()=>{
    persist();
    circles.forEach(c => {
      if(!c.isCircle && c.marker) {
        c.marker.setIcon(buildMarkerIcon(c.meta.color, c.meta.scale, c.meta.kind));
      }
    });
  }, 150));
  
  // 🔧 إصلاح: ربط أحداث الأزرار العلوية اليمنى
  if(btnTraffic) btnTraffic.addEventListener('click', toggleTraffic, {passive:true});
  if(btnShare) btnShare.addEventListener('click', doShare, {passive:true});
  if(btnAdd) btnAdd.addEventListener('click', toggleAddMode, {passive:true});
  if(btnRoute) btnRoute.addEventListener('click', toggleRouteMode, {passive:true});
  if(btnRouteClear) btnRouteClear.addEventListener('click', clearRouteVisuals, {passive:true});
  if(btnEditMode) btnEditMode.addEventListener('click', toggleEditMode, {passive:true});
  if(mapTypeSelector) mapTypeSelector.addEventListener('change', changeMapType, {passive:true});
  
  // Hide route clear button initially if no route exists
  if(btnRouteClear) btnRouteClear.style.display = (routePoints.length > 0) ? 'inline-block' : 'none';
  
  console.log('✅ Map booted successfully!');
}

/* ---------------- UI / Mode Functions ---------------- */

function updateUiForMode(){
  const editButtons = document.querySelectorAll('#btnEditMode, #btnAdd, #btnRoute, #btnRouteClear');
  const displayButtons = document.querySelectorAll('#btnTraffic');
  
  if(shareMode){
    document.body.classList.add('share-mode');
    modeBadge.textContent = 'وضع المشاركة';
    editButtons.forEach(btn => btn.style.display = 'none');
    displayButtons.forEach(btn => btn.style.display = 'inline-block');
    if(btnEditMode) btnEditMode.style.display = 'none';
    if(btnShare) btnShare.textContent = 'مشاركة'; // 🔧 إصلاح: النص الافتراضي
    if(btnRouteClear) btnRouteClear.style.display = 'none';
    editMode = false;
    routeMode = false;
    addMode = false;
  } else {
    document.body.classList.remove('share-mode');
    modeBadge.textContent = editMode ? 'وضع التحرير' : 'وضع العرض';
    if(btnEditMode) btnEditMode.style.display = 'inline-block';
    if(btnShare) btnShare.textContent = 'مشاركة';
    displayButtons.forEach(btn => btn.style.display = 'inline-block');
    editButtons.forEach(btn => {
      if(btn.id !== 'btnEditMode' && btn.id !== 'btnRouteClear') {
        btn.style.display = editMode ? 'inline-block' : 'none';
      }
    });
    // تحديث حالة زر تنظيف المسار
    if(btnRouteClear) btnRouteClear.style.display = (editMode && routePoints.length > 0) ? 'inline-block' : 'none';
    
    // تحديث مظهر زر التحرير
    if(btnEditMode) btnEditMode.classList.toggle('active', editMode);
    
    // تحديث أزرار الوضع
    if(btnAdd) btnAdd.classList.toggle('active', addMode);
    if(btnRoute) btnRoute.classList.toggle('active', routeMode);
  }
  
  circles.forEach(c => {
    if(c.isCircle) c.circle.setOptions({ clickable: !shareMode });
    else c.marker.setOptions({ clickable: !shareMode, draggable: !shareMode && editMode });
  });
  
  if(activeRoutePoly) activeRoutePoly.setOptions({ clickable: !shareMode && editMode });
  routeStopMarkers.forEach(m => m.setOptions({ draggable: !shareMode && editMode }));
}

function showToast(message){
  if(!toast) return;
  toast.textContent = message;
  toast.style.bottom = '16px';
  toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>{
    toast.style.bottom = '-100px';
    toast.classList.remove('show');
  }, 3000);
}

function toggleTraffic(force){
  if(!trafficLayer) return;
  const active = typeof force === 'boolean' ? force : trafficLayer.getMap() === map;
  trafficLayer.setMap(active ? null : map);
  if(btnTraffic) btnTraffic.classList.toggle('active', !active);
  persist();
}

function toggleEditMode(){
  if(shareMode) return;
  editMode = !editMode;
  addMode = false;
  routeMode = false;
  updateUiForMode();
  showToast(editMode ? 'تم تفعيل وضع التحرير' : 'تم تفعيل وضع العرض');
  persist();
}

function toggleAddMode(){
  if(shareMode || !editMode) return;
  addMode = !addMode;
  routeMode = false;
  updateUiForMode();
  map.setOptions({ draggableCursor: addMode ? 'crosshair' : 'grab' });
  showToast(addMode ? 'انقر على الخريطة لإضافة نقطة' : 'تم إلغاء وضع إضافة نقطة');
}

function toggleRouteMode(){
  if(shareMode || !editMode) return;
  routeMode = !routeMode;
  addMode = false;
  updateUiForMode();
  map.setOptions({ draggableCursor: routeMode ? 'crosshair' : 'grab' });
  if(routeMode) showToast('انقر على الخريطة لتحديد نقاط المسار. (يمين لإلغاء النقطة)');
  else showToast('تم إلغاء وضع رسم المسار');
}

function changeMapType(){
  if(!mapTypeSelector || !map) return;
  map.setMapTypeId(mapTypeSelector.value);
  persist();
}

function doShare(){
  const url = location.href;
  // 🔧 إصلاح: استخدام Navigator API للمشاركة إذا كانت متاحة (للتطبيقات) أو النسخ (للمتصفحات)
  if(navigator.share) {
    navigator.share({
      title: 'Diriyah Security Map',
      text: 'خريطة أمن الدرعية',
      url: url,
    }).then(() => {
      console.log('✅ Shared successfully');
      showToast('✓ تم مشاركة الرابط بنجاح');
    }).catch((error) => {
      console.error('Sharing failed', error);
      // في حالة فشل المشاركة، محاولة النسخ
      navigator.clipboard.writeText(url).then(() => {
        showToast('✓ تم نسخ الرابط إلى الحافظة');
      }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast('❌ فشل النسخ والمشاركة. يرجى النسخ يدوياً.');
      });
    });
  } else {
    // متصفحات الكمبيوتر أو المتصفحات التي لا تدعم المشاركة
    navigator.clipboard.writeText(url).then(() => {
      showToast('✓ تم نسخ الرابط إلى الحافظة');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      showToast('❌ فشل نسخ الرابط. يرجى النسخ يدوياً.');
    });
  }
}


/* ---------------- Marker / Circle Management ---------------- */

function createCircle(position, isCircle, id){
  const item = {
    id,
    isCircle,
    meta: {
      name: '',
      color: isCircle ? DEFAULT_COLOR : DEFAULT_MARKER_COLOR,
      scale: DEFAULT_MARKER_SCALE,
      kind: DEFAULT_MARKER_KIND,
      recipients: [],
      infoWin: null
    }
  };
  
  if(isCircle){
    item.circle = new google.maps.Circle({
      map,
      center: position,
      radius: DEFAULT_RADIUS,
      fillColor: DEFAULT_COLOR,
      fillOpacity: DEFAULT_FILL_OPACITY,
      strokeColor: DEFAULT_COLOR,
      strokeWeight: DEFAULT_STROKE_WEIGHT,
      zIndex: 9998,
      clickable: !shareMode
    });
    
    if(editMode) {
      item.circle.setOptions({ editable: true, draggable: true });
      item.circle.addListener('radius_changed', throttle(persist, 200));
      item.circle.addListener('center_changed', throttle(persist, 200));
      item.circle.addListener('rightclick', (e) => {
        if(LOCATIONS.some(l=>l.id===id)) return;
        removeCircle(item);
      });
    }
    
    item.circle.addListener('click', (e) => openCard(item, e.latLng, true));
    item.circle.addListener('mouseover', () => { cardHovering = true; document.body.style.cursor = 'pointer'; });
    item.circle.addListener('mouseout', () => { cardHovering = false; document.body.style.cursor = ''; scheduleCardHide(); });
  } else {
    item.marker = new google.maps.Marker({
      map,
      position,
      icon: buildMarkerIcon(DEFAULT_MARKER_COLOR, DEFAULT_MARKER_SCALE, DEFAULT_MARKER_KIND),
      clickable: !shareMode,
      draggable: !shareMode && editMode,
      zIndex: 9999
    });
    
    if(editMode) {
      item.marker.addListener('dragend', throttle(persist, 200));
      item.marker.addListener('rightclick', () => removeCircle(item));
    }
    
    item.marker.addListener('click', (e) => openCard(item, e.latLng, true));
    item.marker.addListener('mouseover', () => { cardHovering = true; document.body.style.cursor = 'pointer'; });
    item.marker.addListener('mouseout', () => { cardHovering = false; document.body.style.cursor = ''; scheduleCardHide(); });
  }
  
  return item;
}

function addPointToMap(latLng, isCircle){
  const id = Date.now();
  const item = createCircle(latLng, isCircle, id);
  item.meta.name = isCircle ? 'منطقة جديدة' : 'نقطة جديدة';
  circles.push(item);
  openCard(item, latLng, true);
  persist();
}

function removeCircle(item){
  const index = circles.findIndex(c => c.id === item.id);
  if(index > -1){
    if(item.circle) item.circle.setMap(null);
    if(item.marker) item.marker.setMap(null);
    if(item.meta.infoWin) item.meta.infoWin.close();
    circles.splice(index, 1);
    persist();
  }
}

function openCard(item, position, pinned = false){
  if(infoWin) infoWin.close();
  
  const content = renderCard(item);
  item.meta.infoWin = new google.maps.InfoWindow({
    content: content,
    position: position,
    maxWidth: 420,
    pixelOffset: new google.maps.Size(0, item.isCircle ? 0 : -36)
  });
  item.meta.infoWin.open({ map });
  cardPinned = pinned;
  infoWin = item.meta.infoWin;
  
  google.maps.event.addListenerOnce(infoWin, 'domready', () => {
    attachCardEvents(item);
  });
  
  google.maps.event.addListenerOnce(infoWin, 'closeclick', ()=>{
    cardPinned = false;
  });
}

function renderCard(item){
  const isNew = !LOCATIONS.some(l=>l.id===item.id);
  const isCircle = item.isCircle;
  const color = item.meta.color || (isCircle ? DEFAULT_COLOR : DEFAULT_MARKER_COLOR);
  const name = escapeHtml(item.meta.name);
  const scale = item.meta.scale || DEFAULT_MARKER_SCALE;
  const kind = item.meta.kind || DEFAULT_MARKER_KIND;
  const radius = isCircle ? item.circle.getRadius() : DEFAULT_RADIUS;
  const recipients = item.meta.recipients.join('\n');
  const kindOptions = MARKER_KINDS.map(k=>`<option value="${k.id}" ${k.id===kind?'selected':''}>${k.label}</option>`).join('');
  
  return `
  <div id="card-root" dir="rtl" style="min-width:320px">
    <div style="background:rgba(255,255,255,0.93); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
                border:1px solid rgba(0,0,0,0.06); border-radius:18px; padding:14px; color:#111; box-shadow:0 16px 36px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <img src="img/diriyah-logo.png" alt="Diriyah" style="width:40px;height:40px;object-fit:contain;">
        <div style="flex:1;font-weight:800;font-size:16px;">${isCircle ? 'تعديل منطقة' : 'تعديل نقطة'}</div>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;color:#333;">الاسم:</label>
        <input id="item-name" value="${name}" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:8px;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        ${isCircle ? `
        <div class="field"><label style="font-size:12px;color:#333;">نصف القطر (م):</label>
          <input id="item-radius" type="range" min="10" max="500" step="5" value="${Math.round(radius)}" style="width:100%;">
          <span id="item-radius-lbl" style="font-size:12px;color:#666">${Math.round(radius)} م</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">لون المنطقة:</label>
          <input id="item-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        ` : `
        <div class="field"><label style="font-size:12px;color:#333;">نوع الأيقونة:</label>
          <select id="item-kind" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:8px;">${kindOptions}</select></div>
        <div class="field"><label style="font-size:12px;color:#333;">حجم الأيقونة:</label>
          <input id="item-scale" type="range" min="0.5" max="3" step="0.1" value="${scale}" style="width:100%;">
          <span id="item-scale-lbl" style="font-size:12px;color:#666">${scale.toFixed(1)}x</span></div>
        <div class="field"><label style="font-size:12px;color:#333;">لون الأيقونة:</label>
          <input id="item-color" type="color" value="${color}" style="width:100%;height:28px;border:none;background:transparent;padding:0"></div>
        `}
      </div>
      <div>
        <label style="font-size:12px;color:#333;">المستلمون (كل سطر اسم):</label>
        <textarea id="item-recipients" rows="3" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:8px;resize:vertical;">${recipients}</textarea>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button id="item-save"  style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">حفظ</button>
        ${isNew && !isCircle ? `<button id="item-delete" style="flex:1;border:1px solid #e94235;background:#fff;color:#e94235;border-radius:10px;padding:6px 8px;cursor:pointer;">حذف</button>` : ''}
        <button id="item-close" style="flex:1;border:1px solid #ddd;background:#fff;border-radius:10px;padding:6px 8px;cursor:pointer;">إغلاق</button>
      </div>
    </div>
  </div>`;
}

function attachCardEvents(item){
  const nameEl = document.getElementById('item-name');
  const colorEl = document.getElementById('item-color');
  const recipientsEl = document.getElementById('item-recipients');
  const saveBtn = document.getElementById('item-save');
  const closeBtn = document.getElementById('item-close');
  const deleteBtn = document.getElementById('item-delete');
  
  const isCircle = item.isCircle;
  const radiusEl = isCircle ? document.getElementById('item-radius') : null;
  const radiusLbl = isCircle ? document.getElementById('item-radius-lbl') : null;
  const scaleEl = !isCircle ? document.getElementById('item-scale') : null;
  const scaleLbl = !isCircle ? document.getElementById('item-scale-lbl') : null;
  const kindEl = !isCircle ? document.getElementById('item-kind') : null;
  
  function applyVisuals(){
    const color = colorEl.value;
    item.meta.color = color;
    
    if(isCircle){
      const radius = +radiusEl.value;
      item.circle.setRadius(clamp(radius, 10, 500));
      item.circle.setOptions({ fillColor: color, strokeColor: color });
      radiusLbl.textContent = `${Math.round(radius)} م`;
    } else {
      const scale = +scaleEl.value;
      const kind = kindEl.value;
      item.meta.scale = scale;
      item.meta.kind = kind;
      item.marker.setIcon(buildMarkerIcon(color, scale, kind));
      scaleLbl.textContent = `${scale.toFixed(1)}x`;
    }
  }
  
  if(colorEl) colorEl.addEventListener('input', applyVisuals, {passive:true});
  if(radiusEl) radiusEl.addEventListener('input', applyVisuals, {passive:true});
  if(scaleEl) scaleEl.addEventListener('input', applyVisuals, {passive:true});
  if(kindEl) kindEl.addEventListener('change', applyVisuals, {passive:true});
  
  if(saveBtn) saveBtn.addEventListener('click', ()=>{
    if(nameEl) item.meta.name = nameEl.value;
    if(recipientsEl) item.meta.recipients = parseRecipients(recipientsEl.value);
    applyVisuals();
    flushPersist();
    showToast('✓ تم حفظ التغييرات');
    if(infoWin){ infoWin.close(); infoWin = null; }
    cardPinned = false;
  }, {passive:true});
  
  if(closeBtn) closeBtn.addEventListener('click', ()=>{
    if(infoWin){ infoWin.close(); infoWin = null; }
    cardPinned = false;
  }, {passive:true});
  
  if(deleteBtn) deleteBtn.addEventListener('click', ()=>{
    removeCircle(item);
    if(infoWin){ infoWin.close(); infoWin = null; }
    cardPinned = false;
    showToast('✓ تم حذف النقطة');
  }, {passive:true});
}
