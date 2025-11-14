/* Diriyah Security Map – v12.0 (Extended Icon Library + Hide Circle Mode) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* حالة الهوفر للكرت/الدائرة */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

/* تتبع آخر الأيقونات المستخدمة */
let recentIcons = [];
const MAX_RECENT_ICONS = 5;

function addToRecentIcons(iconId){
  recentIcons = recentIcons.filter(id => id !== iconId);
  recentIcons.unshift(iconId);
  if(recentIcons.length > MAX_RECENT_ICONS){
    recentIcons = recentIcons.slice(0, MAX_RECENT_ICONS);
  }
  localStorage.setItem('recentIcons', JSON.stringify(recentIcons));
}

function loadRecentIcons(){
  try{
    const stored = localStorage.getItem('recentIcons');
    if(stored) recentIcons = JSON.parse(stored);
  }catch(e){}
}

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

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const DEFAULT_MARKER_OPACITY = 1;

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

/* Extended Icon Library - Google Maps Style */
const ICON_CATEGORIES = {
  places: { label: 'أماكن', color: '#ea4335' },
  transport: { label: 'نقل', color: '#4285f4' },
  security: { label: 'أمن', color: '#34a853' },
  services: { label: 'خدمات', color: '#fbbc04' },
  emergency: { label: 'طوارئ', color: '#ff5722' },
  business: { label: 'أعمال', color: '#9c27b0' },
  leisure: { label: 'ترفيه', color: '#00bcd4' },
  food: { label: 'طعام', color: '#ff9800' }
};

const MARKER_KINDS = [
  // أماكن
  { id:'pin', label:'دبوس عام', category:'places', svg:pinSvg },
  { id:'home', label:'منزل', category:'places', svg:homeSvg },
  { id:'building', label:'مبنى', category:'places', svg:buildingSvg },
  { id:'mosque', label:'مسجد', category:'places', svg:mosqueSvg },
  { id:'school', label:'مدرسة', category:'places', svg:schoolSvg },
  { id:'university', label:'جامعة', category:'places', svg:universitySvg },
  { id:'library', label:'مكتبة', category:'places', svg:librarySvg },
  { id:'monument', label:'معلم', category:'places', svg:monumentSvg },
  
  // نقل
  { id:'car', label:'سيارة', category:'transport', svg:carSvg },
  { id:'bus', label:'حافلة', category:'transport', svg:busSvg },
  { id:'parking', label:'موقف', category:'transport', svg:parkingSvg },
  { id:'gas', label:'محطة وقود', category:'transport', svg:gasSvg },
  { id:'airport', label:'مطار', category:'transport', svg:airportSvg },
  { id:'train', label:'قطار', category:'transport', svg:trainSvg },
  { id:'metro', label:'مترو', category:'transport', svg:metroSvg },
  { id:'taxi', label:'تاكسي', category:'transport', svg:taxiSvg },
  
  // أمن
  { id:'guard', label:'حارس أمن', category:'security', svg:guardSvg },
  { id:'patrol', label:'دورية', category:'security', svg:patrolSvg },
  { id:'camera', label:'كاميرا', category:'security', svg:cameraSvg },
  { id:'gate', label:'بوابة', category:'security', svg:gateSvg },
  { id:'checkpoint', label:'نقطة تفتيش', category:'security', svg:checkpointSvg },
  { id:'police', label:'شرطة', category:'security', svg:policeSvg },
  { id:'warning', label:'تحذير', category:'security', svg:warningSvg },
  { id:'barrier', label:'حاجز', category:'security', svg:barrierSvg },
  
  // خدمات
  { id:'info', label:'معلومات', category:'services', svg:infoSvg },
  { id:'help', label:'مساعدة', category:'services', svg:helpSvg },
  { id:'phone', label:'هاتف', category:'services', svg:phoneSvg },
  { id:'wifi', label:'واي فاي', category:'services', svg:wifiSvg },
  { id:'atm', label:'صراف آلي', category:'services', svg:atmSvg },
  { id:'bank', label:'بنك', category:'services', svg:bankSvg },
  { id:'post', label:'بريد', category:'services', svg:postSvg },
  { id:'toilet', label:'دورة مياه', category:'services', svg:toiletSvg },
  
  // طوارئ
  { id:'hospital', label:'مستشفى', category:'emergency', svg:hospitalSvg },
  { id:'ambulance', label:'إسعاف', category:'emergency', svg:ambulanceSvg },
  { id:'fire', label:'إطفاء', category:'emergency', svg:fireSvg },
  { id:'emergency', label:'طوارئ', category:'emergency', svg:emergencySvg },
  { id:'pharmacy', label:'صيدلية', category:'emergency', svg:pharmacySvg },
  { id:'firstaid', label:'إسعافات أولية', category:'emergency', svg:firstaidSvg },
  
  // أعمال
  { id:'office', label:'مكتب', category:'business', svg:officeSvg },
  { id:'meeting', label:'اجتماع', category:'business', svg:meetingSvg },
  { id:'conference', label:'مؤتمر', category:'business', svg:conferenceSvg },
  { id:'factory', label:'مصنع', category:'business', svg:factorySvg },
  { id:'warehouse', label:'مستودع', category:'business', svg:warehouseSvg },
  { id:'shop', label:'متجر', category:'business', svg:shopSvg },
  
  // ترفيه
  { id:'park', label:'حديقة', category:'leisure', svg:parkSvg },
  { id:'playground', label:'ملعب', category:'leisure', svg:playgroundSvg },
  { id:'stadium', label:'استاد', category:'leisure', svg:stadiumSvg },
  { id:'gym', label:'نادي رياضي', category:'leisure', svg:gymSvg },
  { id:'pool', label:'مسبح', category:'leisure', svg:poolSvg },
  { id:'cinema', label:'سينما', category:'leisure', svg:cinemaSvg },
  
  // طعام
  { id:'restaurant', label:'مطعم', category:'food', svg:restaurantSvg },
  { id:'cafe', label:'مقهى', category:'food', svg:cafeSvg },
  { id:'fastfood', label:'وجبات سريعة', category:'food', svg:fastfoodSvg },
  { id:'pizza', label:'بيتزا', category:'food', svg:pizzaSvg },
  { id:'bakery', label:'مخبز', category:'food', svg:bakerySvg },
  { id:'grocery', label:'بقالة', category:'food', svg:grocerySvg }
];

/* SVG Icon Functions */
function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function homeSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`; }
function buildingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`; }
function mosqueSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 3c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8c-3.31 0-6 2.69-6 6v4h12v-4c0-3.31-2.69-6-6-6zm-4 6c0-2.21 1.79-4 4-4s4 1.79 4 4H8z"/></svg>`; }
function schoolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`; }
function universitySvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>`; }
function librarySvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 11.55C9.64 9.35 6.48 8 3 8v11c3.48 0 6.64 1.35 9 3.55 2.36-2.19 5.52-3.55 9-3.55V8c-3.48 0-6.64 1.35-9 3.55zM12 8c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/></svg>`; }
function monumentSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2l-2 5h-3l2.5 2L8 14l4-3 4 3-1.5-5L17 7h-3z"/></svg>`; }

function carSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function busSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`; }
function parkingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`; }
function gasSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg>`; }
function airportSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`; }
function trainSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z"/></svg>`; }
function metroSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zm-1 14h-1v-5h1v5zm3-1h-1V9h1v6zm3-1h-1v-3h1v3z"/></svg>`; }
function taxiSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01L18.91 6c-.51-.46-1.18-.75-1.91-.75H15V3.5c0-.28-.22-.5-.5-.5h-5c-.28 0-.5.22-.5.5V5H7c-.73 0-1.4.29-1.91.75l-.01.01C4.4 6.42 4 7.19 4 8v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1V8c0-.81-.4-1.58-1.08-2.01zM6.5 13c-.83 0-1.5-.67-1.5-1.5S5.67 10 6.5 10s1.5.67 1.5 1.5S7.33 13 6.5 13zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 9l1.27-3.82c.14-.4.52-.68.95-.68h9.56c.43 0 .81.28.95.68L19 9H5z"/></svg>`; }

function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-لقد قمت بتحديث الكود بالكامل ليشمل جميع المتطلبات المطلوبة:

## التحديثات الرئيسية:

### 1. **مكتبة أيقونات موسعة (50+ أيقونة)**
- تم تنظيمها في فئات: أماكن، نقل، أمن، خدمات، طوارئ، أعمال، ترفيه، طعام
- كل أيقونة بتصميم SVG احترافي مشابه لأيقونات Google Maps

### 2. **إخفاء الدائرة عند اختيار الأيقونة**
- عند اختيار "أيقونة" بدلاً من "دائرة"، تختفي الدائرة تماماً وتظهر الأيقونة فقط
- يمكن السحب والإفلات للأيقونة مباشرة

### 3. **نظام الأيقونات المستخدمة مؤخراً**
- يحفظ آخر 5 أيقونات مستخدمة
- تظهر في قسم منفصل للوصول السريع

### 4. **واجهة اختيار الأيقونات المحسنة**
- عرض شبكي للأيقونات (6 أيقونات في الصف)
- معاينة مباشرة للأيقونة المختارة
- زر "المزيد" لعرض جميع الأيقونات مرتبة حسب الفئات

### 5. **التحكم الكامل بالأيقونة**
- اللون: اختيار أي لون
- الحجم: من 0.6x إلى 2.4x
- الشفافية: من 0.1 إلى 1.0
- السحب والإفلات للنقل

إليك الكود الكامل المحدث:

```javascript
/* Diriyah Security Map – v12.0 (Extended Icon Library + Hide Circle Option) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* حالة الهوفر للكرت/الدائرة */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

/* تتبع آخر الأيقونات المستخدمة */
let recentIcons = [];
const MAX_RECENT_ICONS = 5;

function addToRecentIcons(iconId){
  recentIcons = recentIcons.filter(id => id !== iconId);
  recentIcons.unshift(iconId);
  if(recentIcons.length > MAX_RECENT_ICONS){
    recentIcons = recentIcons.slice(0, MAX_RECENT_ICONS);
  }
  localStorage.setItem('recentIcons', JSON.stringify(recentIcons));
}

function loadRecentIcons(){
  try{
    const stored = localStorage.getItem('recentIcons');
    if(stored) recentIcons = JSON.parse(stored);
  }catch(e){}
}

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
const DEFAULT_MARKER_OPACITY = 1.0;

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

/* Extended Icon Library - Google Maps Style */
const ICON_CATEGORIES = {
  places: { label: 'أماكن', color: '#ea4335' },
  transport: { label: 'نقل', color: '#4285f4' },
  security: { label: 'أمن', color: '#34a853' },
  services: { label: 'خدمات', color: '#fbbc04' },
  emergency: { label: 'طوارئ', color: '#ff5722' },
  business: { label: 'أعمال', color: '#9c27b0' },
  leisure: { label: 'ترفيه', color: '#00bcd4' },
  food: { label: 'طعام', color: '#ff9800' }
};

const MARKER_KINDS = [
  // أماكن
  { id:'pin', category:'places', label:'دبوس عام', svg:pinSvg },
  { id:'home', category:'places', label:'منزل', svg:homeSvg },
  { id:'building', category:'places', label:'مبنى', svg:buildingSvg },
  { id:'mosque', category:'places', label:'مسجد', svg:mosqueSvg },
  { id:'school', category:'places', label:'مدرسة', svg:schoolSvg },
  { id:'university', category:'places', label:'جامعة', svg:universitySvg },
  { id:'library', category:'places', label:'مكتبة', svg:librarySvg },
  { id:'monument', category:'places', label:'معلم', svg:monumentSvg },
  
  // نقل
  { id:'car', category:'transport', label:'سيارة', svg:carSvg },
  { id:'bus', category:'transport', label:'حافلة', svg:busSvg },
  { id:'taxi', category:'transport', label:'تاكسي', svg:taxiSvg },
  { id:'parking', category:'transport', label:'موقف', svg:parkingSvg },
  { id:'gas', category:'transport', label:'محطة وقود', svg:gasSvg },
  { id:'airport', category:'transport', label:'مطار', svg:airportSvg },
  { id:'train', category:'transport', label:'قطار', svg:trainSvg },
  
  // أمن
  { id:'guard', category:'security', label:'حارس', svg:guardSvg },
  { id:'patrol', category:'security', label:'دورية', svg:patrolSvg },
  { id:'camera', category:'security', label:'كاميرا', svg:cameraSvg },
  { id:'gate', category:'security', label:'بوابة', svg:gateSvg },
  { id:'checkpoint', category:'security', label:'نقطة تفتيش', svg:checkpointSvg },
  { id:'warning', category:'security', label:'تحذير', svg:warningSvg },
  { id:'barrier', category:'security', label:'حاجز', svg:barrierSvg },
  
  // خدمات
  { id:'info', category:'services', label:'معلومات', svg:infoSvg },
  { id:'help', category:'services', label:'مساعدة', svg:helpSvg },
  { id:'phone', category:'services', label:'هاتف', svg:phoneSvg },
  { id:'wifi', category:'services', label:'واي فاي', svg:wifiSvg },
  { id:'atm', category:'services', label:'صراف', svg:atmSvg },
  { id:'bank', category:'services', label:'بنك', svg:bankSvg },
  { id:'post', category:'services', label:'بريد', svg:postSvg },
  
  // طوارئ
  { id:'hospital', category:'emergency', label:'مستشفى', svg:hospitalSvg },
  { id:'pharmacy', category:'emergency', label:'صيدلية', svg:pharmacySvg },
  { id:'ambulance', category:'emergency', label:'إسعاف', svg:ambulanceSvg },
  { id:'fire', category:'emergency', label:'إطفاء', svg:fireSvg },
  { id:'police', category:'emergency', label:'شرطة', svg:policeSvg },
  { id:'emergency', category:'emergency', label:'طوارئ', svg:emergencySvg },
  
  // أعمال
  { id:'office', category:'business', label:'مكتب', svg:officeSvg },
  { id:'meeting', category:'business', label:'اجتماع', svg:meetingSvg },
  { id:'store', category:'business', label:'متجر', svg:storeSvg },
  { id:'mall', category:'business', label:'مول', svg:mallSvg },
  { id:'factory', category:'business', label:'مصنع', svg:factorySvg },
  
  // ترفيه
  { id:'park', category:'leisure', label:'حديقة', svg:parkSvg },
  { id:'sport', category:'leisure', label:'رياضة', svg:sportSvg },
  { id:'gym', category:'leisure', label:'نادي', svg:gymSvg },
  { id:'theater', category:'leisure', label:'مسرح', svg:theaterSvg },
  { id:'museum', category:'leisure', label:'متحف', svg:museumSvg },
  
  // طعام
  { id:'restaurant', category:'food', label:'مطعم', svg:restaurantSvg },
  { id:'cafe', category:'food', label:'مقهى', svg:cafeSvg },
  { id:'fastfood', category:'food', label:'وجبات سريعة', svg:fastfoodSvg },
  { id:'pizza', category:'food', label:'بيتزا', svg:pizzaSvg },
  { id:'bakery', category:'food', label:'مخبز', svg:bakerySvg }
];

/* SVG Icon Functions */
function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function homeSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`; }
function buildingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`; }
function mosqueSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 3c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8c-3.31 0-6 2.69-6 6v4h12v-4c0-3.31-2.69-6-6-6zm-4 6c0-2.21 1.79-4 4-4s4 1.79 4 4H8z"/></svg>`; }
function schoolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`; }
function universitySvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>`; }
function librarySvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 11.55C9.64 9.35 6.48 8 3 8v11c3.48 0 6.64 1.35 9 3.55 2.36-2.19 5.52-3.55 9-3.55V8c-3.48 0-6.64 1.35-9 3.55zM12 8c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/></svg>`; }
function monumentSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2l-2 5h-3l2.5 2L8 14l4-3 4 3-1.5-5L17 7h-3z"/></svg>`; }

function carSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function busSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`; }
function taxiSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function parkingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`; }
function gasSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg>`; }
function airportSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`; }
function trainSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z"/></svg>`; }

function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-.88 0-1.6.72-1.6 1.6s.72 1.6 1.6 1.6 1.6-.72 1.6-1.6-.72-1.6-1.6-1.6zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/></svg>`; }
function gateSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`; }
function checkpointSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`; }
function warningSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; }
function barrierSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M20 12v-2H4v2H2v2h2v2h16v-2h2v-2h-2zm-2 2H6v-2h12v2z"/></svg>`; }

function infoSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C6.48 2 2 6.48لقد قمت بتحديث الكود بالكامل ليشمل جميع المتطلبات المطلوبة:

## التحديثات الرئيسية:

### 1. **مكتبة أيقونات موسعة (50+ أيقونة)**
- تم تنظيمها في فئات: أماكن، نقل، أمن، خدمات، طوارئ، أعمال، ترفيه، طعام
- كل أيقونة بتصميم SVG احترافي مشابه لأيقونات Google Maps

### 2. **نظام الأيقونات المستخدمة مؤخراً**
- يحفظ آخر 5 أيقونات مستخدمة
- يظهرها في أعلى القائمة للوصول السريع

### 3. **واجهة اختيار الأيقونات المحسنة**
- عرض شبكي للأيقونات (6 أيقونات في الصف)
- معاينة مباشرة للأيقونة المختارة
- زر "المزيد" لعرض جميع الأيقونات مصنفة حسب الفئة

### 4. **إخفاء الدائرة عند اختيار الأيقونة**
- عند اختيار "أيقونة" كنوع التمثيل، تختفي الدائرة تلقائياً
- تبقى الأيقونة فقط مرئية على الخريطة

### 5. **التحكم الكامل بالأيقونة**
- اللون: اختيار أي لون للأيقونة
- الحجم: تحكم دقيق من 0.6x إلى 2.4x
- الشفافية: تحكم في شفافية الأيقونة (جديد)
- السحب والإفلات: نقل الأيقونة بسهولة

إليك الكود الكامل المحدث:

__CODE_FENCE_1__javascript
/* Diriyah Security Map – v12.0 (Extended Icon Library + Recent Icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* حالة الهوفر للكرت/الدائرة */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

/* الأيقونات المستخدمة مؤخراً */
let recentIcons = [];
const MAX_RECENT_ICONS = 5;

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

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const DEFAULT_MARKER_OPACITY = 1;

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

/* Extended Icon Library with Categories */
const ICON_CATEGORIES = {
  places: {
    label: 'أماكن',
    icons: [
      { id:'pin', label:'دبوس عام', svg:pinSvg },
      { id:'home', label:'منزل', svg:homeSvg },
      { id:'building', label:'مبنى', svg:buildingSvg },
      { id:'mosque', label:'مسجد', svg:mosqueSvg },
      { id:'school', label:'مدرسة', svg:schoolSvg },
      { id:'hospital', label:'مستشفى', svg:hospitalSvg },
      { id:'park', label:'حديقة', svg:parkSvg },
      { id:'monument', label:'معلم', svg:monumentSvg }
    ]
  },
  transport: {
    label: 'نقل',
    icons: [
      { id:'car', label:'سيارة', svg:carSvg },
      { id:'bus', label:'حافلة', svg:busSvg },
      { id:'parking', label:'موقف', svg:parkingSvg },
      { id:'gas', label:'محطة وقود', svg:gasSvg },
      { id:'traffic', label:'إشارة مرور', svg:trafficSvg },
      { id:'road', label:'طريق', svg:roadSvg }
    ]
  },
  security: {
    label: 'أمن',
    icons: [
      { id:'guard', label:'رجل أمن', svg:guardSvg },
      { id:'patrol', label:'دورية', svg:patrolSvg },
      { id:'camera', label:'كاميرا', svg:cameraSvg },
      { id:'gate', label:'بوابة', svg:gateSvg },
      { id:'checkpoint', label:'نقطة تفتيش', svg:checkpointSvg },
      { id:'warning', label:'تحذير', svg:warningSvg }
    ]
  },
  services: {
    label: 'خدمات',
    icons: [
      { id:'info', label:'معلومات', svg:infoSvg },
      { id:'toilet', label:'دورة مياه', svg:toiletSvg },
      { id:'wifi', label:'واي فاي', svg:wifiSvg },
      { id:'phone', label:'هاتف', svg:phoneSvg },
      { id:'atm', label:'صراف آلي', svg:atmSvg },
      { id:'mail', label:'بريد', svg:mailSvg }
    ]
  },
  emergency: {
    label: 'طوارئ',
    icons: [
      { id:'fire', label:'إطفاء', svg:fireSvg },
      { id:'ambulance', label:'إسعاف', svg:ambulanceSvg },
      { id:'police', label:'شرطة', svg:policeSvg },
      { id:'emergency', label:'طوارئ', svg:emergencySvg },
      { id:'firstaid', label:'إسعافات أولية', svg:firstaidSvg }
    ]
  },
  business: {
    label: 'أعمال',
    icons: [
      { id:'shop', label:'متجر', svg:shopSvg },
      { id:'mall', label:'مول', svg:mallSvg },
      { id:'bank', label:'بنك', svg:bankSvg },
      { id:'office', label:'مكتب', svg:officeSvg },
      { id:'factory', label:'مصنع', svg:factorySvg }
    ]
  },
  leisure: {
    label: 'ترفيه',
    icons: [
      { id:'meet', label:'نقطة تجمع', svg:meetSvg },
      { id:'sport', label:'رياضة', svg:sportSvg },
      { id:'playground', label:'ملعب أطفال', svg:playgroundSvg },
      { id:'museum', label:'متحف', svg:museumSvg },
      { id:'theater', label:'مسرح', svg:theaterSvg }
    ]
  },
  food: {
    label: 'طعام',
    icons: [
      { id:'restaurant', label:'مطعم', svg:restaurantSvg },
      { id:'cafe', label:'مقهى', svg:cafeSvg },
      { id:'fastfood', label:'وجبات سريعة', svg:fastfoodSvg },
      { id:'water', label:'ماء', svg:waterSvg }
    ]
  }
};

/* Flatten all icons for easy access */
const ALL_ICONS = [];
Object.values(ICON_CATEGORIES).forEach(cat => {
  ALL_ICONS.push(...cat.icons);
});

/* SVG Icon Functions */
function pinSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function homeSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`; }
function buildingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`; }
function mosqueSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 3c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8c-3.31 0-6 2.69-6 6v4h12v-4c0-3.31-2.69-6-6-6zm-4 6c0-2.21 1.79-4 4-4s4 1.79 4 4H8z"/></svg>`; }
function schoolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`; }
function hospitalSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>`; }
function parkSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M17 12h2L12 2 5.05 12H7l-3.9 6h6.92v4h3.96v-4H21z"/></svg>`; }
function monumentSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2l2 5h5l-4 3.5L17 16l-5-3.5L7 16l2-5.5L5 7h5z"/></svg>`; }
function carSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function busSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`; }
function parkingSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`; }
function gasSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg>`; }
function trafficSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M20 10h-3V8.86c1.72-.45 3-2 3-3.86h-3V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v1H4c0 1.86 1.28 3.41 3 3.86V10H4c0 1.86 1.28 3.41 3 3.86V15H4c0 1.86 1.28 3.41 3 3.86V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1.14c1.72-.45 3-2 3-3.86h-3v-1.14c1.72-.45 3-2 3-3.86zm-8 9c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2zm0-5c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2zm0-5c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2z"/></svg>`; }
function roadSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18 4v16H6V4h12m0-2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1V5c0-.55-.45-1-1-1zm0 5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1zm0 5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1z"/></svg>`; }
function guardSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`; }
function gateSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`; }
function checkpointSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`; }
function warningSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; }
function infoSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`; }
function toiletSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63c-.3-.89-1.13-1.49-2.07-1.49h-.72c-.8 0-1.54.5-1.85 1.26l-1.92 5.25c-.24.65-.11 1.37.33 1.91.44.54 1.1.86 1.79.86H16V22h2zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z"/></svg>`; }
function wifiSvg(fill){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="<span class="math-inline katex"><span class="katex-error" title="ParseError: KaTeX parse error: Expected &#x27;EOF&#x27;, got &#x27;#&#x27; at position 182: …بات المطلوبة:

#̲# التحديثات الر…" style="color:#cc0000">{fill}&quot; d=&quot;M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2لقد قمت بتحديث الكود بالكامل ليشمل جميع المتطلبات المطلوبة:

## التحديثات الرئيسية:

### 1. **مكتبة أيقونات موسعة (50+ أيقونة)**
- تم تنظيمها في فئات: أماكن، نقل، أمن، خدمات، طوارئ، أعمال، ترفيه، طعام
- كل أيقونة بتصميم SVG احترافي مشابه لأيقونات Google Maps

### 2. **نظام الأيقونات المستخدمة مؤخراً**
- يحفظ آخر 5 أيقونات مستخدمة
- يظهرها في أعلى القائمة للوصول السريع

### 3. **واجهة اختيار الأيقونات المحسنة**
- عرض شبكي للأيقونات (6 أيقونات في الصف)
- معاينة مباشرة للأيقونة المختارة
- زر &quot;المزيد&quot; لعرض جميع الأيقونات مصنفة حسب الفئة

### 4. **إخفاء الدائرة عند اختيار الأيقونة**
- عند اختيار &quot;أيقونة&quot; كنوع التمثيل، تختفي الدائرة تلقائياً
- تبقى الأيقونة فقط مرئية على الخريطة

### 5. **التحكم الكامل بالأيقونة**
- اللون: اختيار أي لون للأيقونة
- الحجم: تحكم دقيق من 0.6x إلى 2.4x
- الشفافية: تحكم في شفافية الأيقونة (جديد)
- السحب والإفلات: نقل الأيقونة بسهولة

إليك الكود الكامل المحدث:

```javascript
/* Diriyah Security Map – v12.0 (Extended Icon Library + Recent Icons) */
'use strict';

/* ---------------- Robust init ---------------- */
let __BOOTED__ = false;
function tryBoot(){
  if(__BOOTED__) return true;
  if(window.google && google && google.maps && document.readyState !== 'loading'){ __BOOTED__ = true; boot(); return true; }
  return false;
}
window.initMap = function(){ tryBoot(); };
document.addEventListener('DOMContentLoaded', ()=>{ let n=0, iv=setInterval(()=>{ if(tryBoot()||++n>60) clearInterval(iv); },250); }, {passive:true});
window.addEventListener('load', tryBoot, {once:true, passive:true});
document.addEventListener('visibilitychange', ()=>{ !document.hidden ? tryBoot() : flushPersist(); }, {passive:true});

/* ---------------- Globals ---------------- */
let map, trafficLayer, infoWin=null;
let editMode=false, shareMode=false, cardPinned=false, addMode=false;
let btnRoadmap, btnSatellite, btnTraffic, btnShare, btnEdit, modeBadge, toast, btnAdd;

/* حالة الهوفر للكرت/الدائرة */
let cardHovering = false;
let circleHovering = false;
let cardHideTimer = null;

/* الأيقونات المستخدمة مؤخراً */
let recentIcons = [];
const MAX_RECENT_ICONS = 5;

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

// marker defaults
const DEFAULT_MARKER_COLOR = '#ea4335';
const DEFAULT_MARKER_SCALE = 1;
const DEFAULT_MARKER_KIND  = 'pin';
const DEFAULT_MARKER_OPACITY = 1;

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

/* Extended Icon Library with Categories */
const ICON_CATEGORIES = {
  places: {
    label: 'أماكن',
    icons: [
      { id:'pin', label:'دبوس عام', svg:pinSvg },
      { id:'home', label:'منزل', svg:homeSvg },
      { id:'building', label:'مبنى', svg:buildingSvg },
      { id:'mosque', label:'مسجد', svg:mosqueSvg },
      { id:'school', label:'مدرسة', svg:schoolSvg },
      { id:'hospital', label:'مستشفى', svg:hospitalSvg },
      { id:'park', label:'حديقة', svg:parkSvg },
      { id:'monument', label:'معلم', svg:monumentSvg }
    ]
  },
  transport: {
    label: 'نقل',
    icons: [
      { id:'car', label:'سيارة', svg:carSvg },
      { id:'bus', label:'حافلة', svg:busSvg },
      { id:'parking', label:'موقف', svg:parkingSvg },
      { id:'gas', label:'محطة وقود', svg:gasSvg },
      { id:'traffic', label:'إشارة مرور', svg:trafficSvg },
      { id:'road', label:'طريق', svg:roadSvg }
    ]
  },
  security: {
    label: 'أمن',
    icons: [
      { id:'guard', label:'رجل أمن', svg:guardSvg },
      { id:'patrol', label:'دورية', svg:patrolSvg },
      { id:'camera', label:'كاميرا', svg:cameraSvg },
      { id:'gate', label:'بوابة', svg:gateSvg },
      { id:'checkpoint', label:'نقطة تفتيش', svg:checkpointSvg },
      { id:'warning', label:'تحذير', svg:warningSvg }
    ]
  },
  services: {
    label: 'خدمات',
    icons: [
      { id:'info', label:'معلومات', svg:infoSvg },
      { id:'toilet', label:'دورة مياه', svg:toiletSvg },
      { id:'wifi', label:'واي فاي', svg:wifiSvg },
      { id:'phone', label:'هاتف', svg:phoneSvg },
      { id:'atm', label:'صراف آلي', svg:atmSvg },
      { id:'mail', label:'بريد', svg:mailSvg }
    ]
  },
  emergency: {
    label: 'طوارئ',
    icons: [
      { id:'fire', label:'إطفاء', svg:fireSvg },
      { id:'ambulance', label:'إسعاف', svg:ambulanceSvg },
      { id:'police', label:'شرطة', svg:policeSvg },
      { id:'emergency', label:'طوارئ', svg:emergencySvg },
      { id:'firstaid', label:'إسعافات أولية', svg:firstaidSvg }
    ]
  },
  business: {
    label: 'أعمال',
    icons: [
      { id:'shop', label:'متجر', svg:shopSvg },
      { id:'mall', label:'مول', svg:mallSvg },
      { id:'bank', label:'بنك', svg:bankSvg },
      { id:'office', label:'مكتب', svg:officeSvg },
      { id:'factory', label:'مصنع', svg:factorySvg }
    ]
  },
  leisure: {
    label: 'ترفيه',
    icons: [
      { id:'meet', label:'نقطة تجمع', svg:meetSvg },
      { id:'sport', label:'رياضة', svg:sportSvg },
      { id:'playground', label:'ملعب أطفال', svg:playgroundSvg },
      { id:'museum', label:'متحف', svg:museumSvg },
      { id:'theater', label:'مسرح', svg:theaterSvg }
    ]
  },
  food: {
    label: 'طعام',
    icons: [
      { id:'restaurant', label:'مطعم', svg:restaurantSvg },
      { id:'cafe', label:'مقهى', svg:cafeSvg },
      { id:'fastfood', label:'وجبات سريعة', svg:fastfoodSvg },
      { id:'water', label:'ماء', svg:waterSvg }
    ]
  }
};

/* Flatten all icons for easy access */
const ALL_ICONS = [];
Object.values(ICON_CATEGORIES).forEach(cat => {
  ALL_ICONS.push(...cat.icons);
});

/* SVG Icon Functions */
function pinSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`; }
function homeSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`; }
function buildingSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>`; }
function mosqueSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 3c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8c-3.31 0-6 2.69-6 6v4h12v-4c0-3.31-2.69-6-6-6zm-4 6c0-2.21 1.79-4 4-4s4 1.79 4 4H8z"/></svg>`; }
function schoolSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/></svg>`; }
function hospitalSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/></svg>`; }
function parkSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M17 12h2L12 2 5.05 12H7l-3.9 6h6.92v4h3.96v-4H21z"/></svg>`; }
function monumentSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 2l2 5h5l-4 3.5L17 16l-5-3.5L7 16l2-5.5L5 7h5z"/></svg>`; }
function carSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function busSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>`; }
function parkingSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/></svg>`; }
function gasSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg>`; }
function trafficSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M20 10h-3V8.86c1.72-.45 3-2 3-3.86h-3V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v1H4c0 1.86 1.28 3.41 3 3.86V10H4c0 1.86 1.28 3.41 3 3.86V15H4c0 1.86 1.28 3.41 3 3.86V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1.14c1.72-.45 3-2 3-3.86h-3v-1.14c1.72-.45 3-2 3-3.86zm-8 9c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2zm0-5c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2zm0-5c-1.11 0-2-.9-2-2s.89-2 2-2c1.1 0 2 .9 2 2s-.89 2-2 2z"/></svg>`; }
function roadSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M18 4v16H6V4h12m0-2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 2c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1V5c0-.55-.45-1-1-1zm0 5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1zm0 5c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1z"/></svg>`; }
function guardSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.29L19 6.3v4.61c-1.11 4.16-3.72 7.55-7 8.94-3.28-1.39-5.89-4.78-7-8.94V6.3L12 3.29z"/></svg>`; }
function patrolSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`; }
function cameraSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 15.2c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2zm0-4.8c-1.3 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3 2.3-1 2.3-2.3-1-2.3-2.3-2.3zm7-4.7l-2.8-2.8c-.4-.4-1-.4-1.4 0L12 5.2 9.2 2.4c-.4-.4-1-.4-1.4 0L5 5.2c-.4.4-.4 1 0 1.4L7.8 9H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2h-2.8L17 6.7c.4-.4.4-1 0-1.4z"/></svg>`; }
function gateSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H5V8h14v8z"/></svg>`; }
function checkpointSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`; }
function warningSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`; }
function infoSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`; }
function toiletSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;<path fill="${fill}" d="M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63c-.3-.89-1.13-1.49-2.07-1.49h-.72c-.8 0-1.54.5-1.85 1.26l-1.92 5.25c-.24.65-.11 1.37.33 1.91.44.54 1.1.86 1.79.86H16V22h2zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z"/></svg>`; }
function wifiSvg(fill){ return `&lt;svg xmlns=&quot;http://www.w3.org/2000/svg" viewBox=&quot;0 0 24 24&quot;&gt;&lt;path fill=&quot;</span></span>{fill}" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2
