/* js/main.js */
// =========================================
// إعدادات عامة
// =========================================
"use strict";

// اجعل المتغيرات في النطاق العام للرجوع لها لاحقًا إن لزم
let map = null;
let trafficLayer = null;
let transitLayer = null;
let bicyclingLayer = null;

// مركز افتراضي: الدرعية
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM = 14;

// مساعد آمن للحصول على عنصر
function $(sel) {
  return document.querySelector(sel);
}

// ربط مستمع بأمان (إذا وُجد العنصر)
function onIfExists(el, evt, handler) {
  if (el) el.addEventListener(evt, handler);
}

// =========================================
// الدالة التي ستناديها Google عبر callback
// يجب تعريفها على window
// =========================================
function initApp() {
  try {
    // تأكيد توفر google قبل أي استخدام
    if (!(window.google && google.maps)) {
      console.error("Google Maps لم تُحمّل بعد.");
      // إعادة المحاولة خلال لحظة إذا حصل تأخير نادر
      setTimeout(initApp, 100);
      return;
    }

    // إنشاء الخريطة
    map = new google.maps.Map(document.getElementById("map"), {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      mapTypeId: "roadmap",
      gestureHandling: "greedy", // سلاسة على الجوال
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: false, // سنوفره من القائمة عندك
    });

    // طبقات Google الاختيارية
    trafficLayer = new google.maps.TrafficLayer();
    transitLayer = new google.maps.TransitLayer();
    bicyclingLayer = new google.maps.BicyclingLayer();

    // -------------------------------------
    // ربط عناصر "الطبقات" إن وُجدت في DOM
    // -------------------------------------
    // نوع الخريطة: select
    const baseSelect =
      $("#baseMapSelect") || $("#basemap") || $("#base-map-select") || $("#mapType");

    onIfExists(baseSelect, "change", (e) => {
      const val = (e.target.value || "").toLowerCase();
      switch (val) {
        case "hybrid":
        case "مختلط":
          map.setMapTypeId("hybrid");
          break;
        case "satellite":
        case "قمر صناعي":
          map.setMapTypeId("satellite");
          break;
        case "terrain":
        case "تضاريس":
          map.setMapTypeId("terrain");
          break;
        default:
          map.setMapTypeId("roadmap");
      }
    });

    // حركة المرور
    const chkTraffic =
      $("#trafficToggle") || $("#traffic") || $("#traffic-layer") || $("#chk-traffic");
    onIfExists(chkTraffic, "change", (e) => {
      if (e.target.checked) trafficLayer.setMap(map);
      else trafficLayer.setMap(null);
    });

    // النقل العام
    const chkTransit =
      $("#transitToggle") || $("#transit") || $("#transit-layer") || $("#chk-transit");
    onIfExists(chkTransit, "change", (e) => {
      if (e.target.checked) transitLayer.setMap(map);
      else transitLayer.setMap(null);
    });

    // مسارات الدراجات
    const chkBike =
      $("#bicyclingToggle") || $("#bicycling") || $("#bicycle-layer") || $("#chk-bicycle");
    onIfExists(chkBike, "change", (e) => {
      if (e.target.checked) bicyclingLayer.setMap(map);
      else bicyclingLayer.setMap(null);
    });

    // لو لديك زر "إضافة موقع" وغيره يمكن ربطه هنا إن وُجد.
    // مثال:
    // onIfExists($('#addCircleBtn'), 'click', () => { ... });

    // تأكيد أن عنصر الخريطة له ارتفاع فعلي
    // (احتياط لو كان CSS ناقصًا)
    ensureMapHeight();

    console.log("Google Map initialized.");
  } catch (err) {
    console.error("فشل تهيئة الخريطة:", err);
  }
}

// اجعلها متاحة للـ callback
window.initApp = initApp;

// =========================================
// ضمان وجود ارتفاع للخريطة (احتياطي)
// =========================================
function ensureMapHeight() {
  const el = document.getElementById("map");
  if (!el) {
    console.warn("لم يتم العثور على عنصر #map");
    return;
  }
  // إذا كان الارتفاع 0 بالخطأ، اجعله يملأ الشاشة
  const h = parseInt(getComputedStyle(el).height, 10);
  if (!h) {
    el.style.height = "100vh";
  }
}

// =========================================
// ملاحظة مهمة:
// في index.html (وأيضًا view.html)،
/*
ضع في النهاية:

<script src="js/main.js"></script>
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=geometry&v=weekly&callback=initApp" async defer></script>

واستبدل YOUR_API_KEY بمفتاحك.
*/
// =========================================
