/* ====================================================================
 * Constants and Global Variables
 * ==================================================================== */

// تأكد من أن هذه الثوابت معرفة بشكل صحيح في بداية ملفك
const DEFAULT_RADIUS = 300; // مثال للقيمة الافتراضية
const DEFAULT_COLOR = '#ff0000'; // مثال للون الافتراضي
const LOCATIONS = [
    // قائمة مواقع ثابتة (المفترض أن تكون موجودة)
    // مثال: { id: 1, lat: 24.7, lng: 46.7, name: 'موقع 1' }
];

let map;
let circles = [];
let trafficLayer;
let currentRouteOverview = null;
let routePoints = [];
let routeStyle = { color: '#0000ff', weight: 6, opacity: 0.8 };
let routeDistance = 0;
let routeDuration = 0;

/* ====================================================================
 * Utility Functions (مع الإصلاحات)
 * ==================================================================== */

/**
 * تحويل الألوان إلى صيغة HEX
 * 🛑 إصلاح خطأ Uncaught SyntaxError: Unexpected token '!' (السطر 121)
 */
function toHex(c){
  if (c === undefined || c === null || c === '') {
    return '#000000';
  }
  
  if(/^#/.test(c)) return c;
  
  var m = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d*))?\)/.exec(c);
  return m ? '#' + (m[1]|1<<8).toString(16).slice(1) + (m[2]|1<<8).toString(16).slice(1) + (m[3]|1<<8).toString(16).slice(1) : c;
}

// دالة لجلب الحالة المخزنة (مثال)
function getPersistedState() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedState = urlParams.get('s');
        if (encodedState) {
            const decodedJson = atob(encodedState);
            return JSON.parse(decodedJson);
        }
        const stored = localStorage.getItem('mapState');
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error("Failed to load state", e);
        return null;
    }
}

/* ====================================================================
 * State Management Functions (مع الإصلاحات الجوهرية)
 * ==================================================================== */

/**
 * بناء كائن الحالة الحالي لحفظه أو مشاركته.
 * 🛑 إصلاح خطأ TypeError: it.circle.getOptions is not a function
 * 🛑 إصلاح خطأ TypeError: Cannot read properties of undefined (reading 'name') (السطر 1007)
 */
function buildState(){
    const center = map.getCenter();
    const s = {
        p: [Number(center.lng().toFixed(6)), Number(center.lat().toFixed(6))],
        z: map.getZoom(),
        m: (map.getMapTypeId()||'roadmap').slice(0,1),
        t: (trafficLayer && trafficLayer.getMap()) ? 1 : 0,
        c: [], // Circles with modifications
        n: [], // New circles
        r: null // Route data
    };
    
    circles.forEach(it=>{
        if(!it.visible) return;
        
        const meta = it.meta;
        
        // استخدام الطرق الصحيحة للحصول على خصائص الدائرة
        const circleCenter = it.circle.getCenter();
        const radius = Math.round(it.circle.getRadius());
        const color = toHex(it.circle.get('strokeColor'));
        const name = meta.name || '';
        
        if(it.fixed){
            const original = LOCATIONS.find(l => l.id === it.id);
            
            // 🛑 التحقق من وجود الموقع الأصلي قبل قراءة خصائصه (إصلاح 1007)
            if (!original) {
                // إذا لم يتم العثور على الأصل، عاملها كدائرة جديدة مؤقتًا
                it.fixed = false;
            }
            
            if (it.fixed) {
                const originalColor = toHex(DEFAULT_COLOR);
                const originalRadius = DEFAULT_RADIUS;
                
                const isModified = (radius !== originalRadius) || (color !== originalColor) || (name !== original.name) || (meta.recipients.length > 0);
                
                if(isModified){
                    s.c.push([it.id, radius, color, name, meta.recipients]);
                }
            }
        } 
        
        if (!it.fixed) {
            // حفظ الدوائر المخصصة بالكامل أو الدوائر الثابتة التي لم يتم العثور على أصلها
            s.n.push([
                it.id,
                Number(circleCenter.lat().toFixed(6)),
                Number(circleCenter.lng().toFixed(6)),
                name,
                radius,
                color,
                meta.recipients
            ]);
        }
    });
    
    // حفظ بيانات المسار
    if(currentRouteOverview && routePoints.length > 1) {
        s.r = {
            ov: currentRouteOverview,
            points: routePoints.map(p => ({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) })),
            style: {
                color: routeStyle.color,
                weight: routeStyle.weight,
                opacity: routeStyle.opacity
            },
            distance: routeDistance,
            duration: routeDuration
        };
    } else if (routePoints.length > 0) {
        s.r = {
            points: routePoints.map(p => ({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) })),
            style: routeStyle,
            distance: 0,
            duration: 0
        };
    } else {
        s.r = null;
    }
    
    return s;
}

function persist(state) {
    if (state) {
        localStorage.setItem('mapState', JSON.stringify(state));
    }
}

// دالة للحفظ المؤجل (مثال)
let persistTimeout;
function flushPersist() {
    clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
        const state = buildState();
        persist(state);
    }, 500);
}

/* ====================================================================
 * Core Map Initialization
 * ==================================================================== */

function initMap() {
    // تهيئة الخريطة (مثال)
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 24.7, lng: 46.7 },
        zoom: 12,
        mapTypeId: 'roadmap'
    });

    // تحميل الحالة السابقة
    const state = getPersistedState();
    if (state) {
        restoreState(state);
    } else {
        // تحميل الدوائر الثابتة الافتراضية لأول مرة
        loadInitialCircles();
    }

    // إعداد مستمعي الأحداث للحفظ المستمر
    map.addListener('dragend', flushPersist);
    map.addListener('zoom_changed', flushPersist);
    map.addListener('maptypeid_changed', flushPersist);
    
    // ... (أي مستمعات أخرى للأحداث)
}

function restoreState(s) {
    // استعادة مركز الخريطة والتكبير
    if (s.p && s.z) {
        map.setCenter({ lat: s.p[1], lng: s.p[0] });
        map.setZoom(s.z);
    }

    // استعادة نوع الخريطة
    if (s.m) {
        const mapType = s.m === 'r' ? 'roadmap' : (s.m === 's' ? 'satellite' : 'roadmap');
        map.setMapTypeId(mapType);
    }

    // استعادة طبقة حركة المرور
    if (s.t === 1) {
        toggleTrafficLayer(true);
    }
    
    // تحميل الدوائر الثابتة أولاً
    loadInitialCircles(); 

    // تطبيق التعديلات على الدوائر الثابتة (s.c)
    if (s.c && s.c.length > 0) {
        s.c.forEach(c => {
            const [id, radius, color, name, recipients] = c;
            const circleItem = circles.find(item => item.id === id && item.fixed);
            if (circleItem) {
                circleItem.circle.setOptions({
                    radius: radius,
                    strokeColor: color,
                    fillColor: color
                });
                circleItem.meta.name = name;
                circleItem.meta.recipients = recipients;
            }
        });
    }

    // إنشاء الدوائر الجديدة (s.n)
    if (s.n && s.n.length > 0) {
        s.n.forEach(c => {
            const [id, lat, lng, name, radius, color, recipients] = c;
            // يجب أن تكون لديك دالة لإنشاء دوائر جديدة
            createCustomCircle({ lat, lng }, radius, color, name, id, recipients);
        });
    }

    // استعادة المسار
    if (s.r) {
        // يجب أن تكون لديك دالة لاستعادة المسار
        // restoreRoute(s.r);
    }
}

// دالة لإنشاء الدوائر الثابتة لأول مرة
function loadInitialCircles() {
    LOCATIONS.forEach(location => {
        // تحقق من عدم وجود الدائرة مسبقاً
        if (!circles.find(c => c.id === location.id && c.fixed)) {
             createCircle({ lat: location.lat, lng: location.lng }, DEFAULT_RADIUS, DEFAULT_COLOR, location.name, location.id, true);
        }
    });
}

// مثال مبسط لدالة إنشاء الدائرة (تأكد من وجود الدالة الأصلية في كودك)
function createCircle(center, radius, color, name, id, isFixed = false) {
    const circle = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.35,
        map: map,
        center: center,
        radius: radius,
        editable: !isFixed // اجعلها قابلة للتحرير فقط إذا لم تكن ثابتة
    });
    
    const circleItem = {
        id: id,
        circle: circle,
        meta: { name: name, recipients: [] },
        fixed: isFixed,
        visible: true
    };
    circles.push(circleItem);
    
    // إضافة مستمعي الأحداث للدائرة
    if (!isFixed) {
        circle.addListener('radius_changed', flushPersist);
        circle.addListener('center_changed', flushPersist);
    }
    
    return circleItem;
}

// دالة لتبديل طبقة المرور (مثال)
function toggleTrafficLayer(enable) {
    if (!trafficLayer) {
        trafficLayer = new google.maps.TrafficLayer();
    }
    if (enable) {
        trafficLayer.setMap(map);
    } else {
        trafficLayer.setMap(null);
    }
    flushPersist();
}

/* ====================================================================
 * Cleanup (إصلاح خطأ Unexpected identifier 'nodeBadge')
 * ==================================================================== */

// 🛑 قم بحذف أي كود يحتوي على 'nodeBadge' حول السطر 1438
// أو تأكد من أن الجزء الخاص بكود إنهاء الجلسة لا يحتوي على أي خصائص غير مدعومة.
// (يجب أن يتم الحذف يدوياً في ملفك حيث لا يمكنني رؤية الكود في السطر 1438).

/* ====================================================================
 * Boot / Entry Point
 * ==================================================================== */

// ربط دالة initMap بتحميل الخريطة عند تحميل المكتبة
// window.initMap = initMap;
// تأكد من أن مكتبة Google Maps يتم تحميلها باستخدام callback=initMap
