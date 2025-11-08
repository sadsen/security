/* ==============================
   Google Maps – صفحة التحرير
   يجمع كل شيء ثم يشارك عبر view.html?v=ENCODED
   ============================== */

let map, trafficLayer, transitLayer, bikeLayer;
let infoWin;
const circles = [];
let selected = null;

/* مواقع جاهزة بنصف قطر افتراضي 15 م */
const PRESET_LOCATIONS = [
  { name: "بوابة سمحان", lat: 24.742132284177778, lng: 46.569503913805825 },
  { name: "منطقة سمحان", lat: 24.74091335108621, lng: 46.571891407130025 },
  { name: "دوار البجيري", lat: 24.737521801476476, lng: 46.57406918772067 },
  { name: "إشارة البجيري", lat: 24.73766260194535, lng: 46.575429040147306 },
  { name: "طريق الملك فيصل", lat: 24.736133848943062, lng: 46.57696607050239 },
  { name: "نقطة فرز الشلهوب", lat: 24.73523670533632, lng: 46.57785639752234 },
  { name: "المسار الرياضي المديد", lat: 24.735301077804944, lng: 46.58178092599035 },
  { name: "ميدان الملك سلمان", lat: 24.73611373368281, lng: 46.58407097038162 },
  { name: "دوار الضوء الخافت", lat: 24.739718342668006, lng: 46.58352614787052 },
  { name: "المسار الرياضي طريق الملك خالد الفرعي", lat: 24.740797019998627, lng: 46.5866145907347 },
  { name: "دوار البلدية", lat: 24.739266101368777, lng: 46.58172727078356 },
  { name: "مدخل ساحة البلدية الفرعي", lat: 24.738638518378387, lng: 46.579858026042785 },
  { name: "مدخل مواقف البجيري (كار بارك)", lat: 24.73826438056506, lng: 46.57789576275729 },
  { name: "مواقف الامن", lat: 24.73808736962705, lng: 46.57771858346317 },
  { name: "دوار الروقية", lat: 24.741985907266145, lng: 46.56269186990043 },
  { name: "بيت مبارك", lat: 24.732609768937607, lng: 46.57827089439368 },
  { name: "دوار وادي صفار", lat: 24.72491458984474, lng: 46.57345489743978 },
  { name: "دوار راس النعامة", lat: 24.710329841152387, lng: 46.572921959358204 },
  { name: "مزرعة الحبيب", lat: 24.709445443672344, lng: 46.593971867951346 },
];

const DEFAULT_STYLE = {
  strokeColor: "#7c3aed",
  strokeOpacity: 1,
  strokeWeight: 2,
  fillColor: "#a78bfa",
  fillOpacity: 0.25,
  radius: 15,
  draggable: false,
  editable: false,
};

function enc(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function dec(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* يُحقن من index.html عبر callback */
window.initMap = function () {
  if (window.__mapBootstrapped) return;
  window.__mapBootstrapped = true;

  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 24.73722, lng: 46.53877 },
    zoom: 14,
    mapTypeId: "roadmap",
    gestureHandling: "greedy",
    fullscreenControl: false,
  });

  infoWin = new google.maps.InfoWindow();

  trafficLayer = new google.maps.TrafficLayer();
  transitLayer = new google.maps.TransitLayer();
  bikeLayer = new google.maps.BicyclingLayer();

  // طبقات – واجهة
  document.getElementById("mapTypeSelect").addEventListener("change", (e) => {
    map.setMapTypeId(e.target.value);
  });
  document.getElementById("layerTraffic").addEventListener("change", (e) => {
    e.target.checked ? trafficLayer.setMap(map) : trafficLayer.setMap(null);
  });
  document.getElementById("layerTransit").addEventListener("change", (e) => {
    e.target.checked ? transitLayer.setMap(map) : transitLayer.setMap(null);
  });
  document.getElementById("layerBike").addEventListener("change", (e) => {
    e.target.checked ? bikeLayer.setMap(map) : bikeLayer.setMap(null);
  });

  // إنشاء المواقع الافتراضية
  PRESET_LOCATIONS.forEach((p) => {
    const c = new google.maps.Circle({
      map,
      center: { lat: p.lat, lng: p.lng },
      ...DEFAULT_STYLE,
    });
    c._data = { name: p.name, security: "", notes: "" };
    circles.push(c);
    attachCircleEvents(c);
  });

  // عناصر التحرير
  const $name = document.getElementById("siteName");
  const $sec = document.getElementById("securityNames");
  const $notes = document.getElementById("notes");
  const $fill = document.getElementById("fillColor");
  const $stroke = document.getElementById("strokeColor");
  const $op = document.getElementById("fillOpacity");
  const $rad = document.getElementById("radius");
  const $drag = document.getElementById("dragToggle");
  const $edit = document.getElementById("editToggle");

  function bindEditor(c) {
    selected = c;
    $name.value = c._data?.name || "";
    $sec.value = c._data?.security || "";
    $notes.value = c._data?.notes || "";
    $fill.value = c.get("fillColor");
    $stroke.value = c.get("strokeColor");
    $op.value = String(c.get("fillOpacity") ?? 0.25);
    $rad.value = Math.round(c.get("radius") ?? 15);
    $drag.checked = !!c.get("draggable");
    $edit.checked = !!c.get("editable");
  }

  [$name, $sec, $notes].forEach((el) => {
    el.addEventListener("input", () => {
      if (!selected) return;
      // منع قفز المؤشر على الجوال
      const pos = el.selectionStart;
      selected._data = {
        ...selected._data,
        name: $name.value.trim(),
        security: $sec.value,
        notes: $notes.value,
      };
      el.setSelectionRange(pos, pos);
      refreshInfo(selected);
    });
  });

  $fill.addEventListener("input", () => { selected && selected.setOptions({ fillColor: $fill.value }); });
  $stroke.addEventListener("input", () => { selected && selected.setOptions({ strokeColor: $stroke.value }); });
  $op.addEventListener("input", () => { selected && selected.setOptions({ fillOpacity: parseFloat($op.value) }); });
  $rad.addEventListener("input", () => { selected && selected.setRadius(Math.max(1, parseFloat($rad.value) || 15)); });
  $drag.addEventListener("change", () => { selected && selected.setOptions({ draggable: $drag.checked }); });
  $edit.addEventListener("change", () => { selected && selected.setOptions({ editable: $edit.checked }); });

  document.getElementById("addCircleBtn").addEventListener("click", () => {
    const c = new google.maps.Circle({
      map,
      center: map.getCenter(),
      ...DEFAULT_STYLE,
    });
    c._data = { name: "", security: "", notes: "" };
    circles.push(c);
    attachCircleEvents(c);
    bindEditor(c);
    openInfo(c);
  });

  document.getElementById("shareBtn").addEventListener("click", () => {
    const payload = buildPayload();
    const encoded = enc(payload);
    const url = `${location.origin}/view.html?v=${encodeURIComponent(encoded)}`;
    navigator.clipboard.writeText(url).then(
      () => alert("تم نسخ رابط الخريطة!"),
      () => prompt("انسخ الرابط:", url)
    );
  });

  // حدّد أول دائرة لبدء التحرير
  if (circles.length) {
    bindEditor(circles[0]);
    openInfo(circles[0]);
  }
};

/* يبني حمولة المشاركة */
function buildPayload() {
  return {
    center: { lat: map.getCenter().lat(), lng: map.getCenter().lng() },
    zoom: map.getZoom(),
    mapTypeId: map.getMapTypeId(),
    layers: {
      traffic: !!trafficLayer.getMap(),
      transit: !!transitLayer.getMap(),
      bike: !!bikeLayer.getMap(),
    },
    circles: circles.map((c) => ({
      lat: c.getCenter().lat(),
      lng: c.getCenter().lng(),
      radius: c.getRadius(),
      strokeColor: c.get("strokeColor"),
      fillColor: c.get("fillColor"),
      fillOpacity: c.get("fillOpacity"),
      name: c._data?.name || "",
      security: c._data?.security || "",
      notes: c._data?.notes || "",
    })),
  };
}

/* أحداث الدائرة */
function attachCircleEvents(c) {
  google.maps.event.addListener(c, "click", () => {
    selected = c;
    // حدث اختيار لتحريك بيانات المحرر
    const $name = document.getElementById("siteName");
    const $sec = document.getElementById("securityNames");
    const $notes = document.getElementById("notes");
    const $fill = document.getElementById("fillColor");
    const $stroke = document.getElementById("strokeColor");
    const $op = document.getElementById("fillOpacity");
    const $rad = document.getElementById("radius");
    const $drag = document.getElementById("dragToggle");
    const $edit = document.getElementById("editToggle");

    $name.value = c._data?.name || "";
    $sec.value = c._data?.security || "";
    $notes.value = c._data?.notes || "";
    $fill.value = c.get("fillColor");
    $stroke.value = c.get("strokeColor");
    $op.value = String(c.get("fillOpacity") ?? 0.25);
    $rad.value = Math.round(c.get("radius") ?? 15);
    $drag.checked = !!c.get("draggable");
    $edit.checked = !!c.get("editable");

    openInfo(c);
  });

  // تحديث مكان الكرت عند السحب
  ["drag", "radius_changed", "center_changed"].forEach(evt => {
    google.maps.event.addListener(c, evt, () => { if (infoWin.get("circle") === c) openInfo(c); });
  });

  refreshInfo(c);
}

/* محتوى كرت المعلومات */
function infoHtml(c) {
  const name = escapeHtml(c._data?.name || "موقع بدون اسم");
  const security = (c._data?.security || "").trim();
  const secLines = security ? security.split(/\r?\n/).map(s => `<div>• ${escapeHtml(s)}</div>`).join("") : "<div>—</div>";
  const notes = (c._data?.notes || "").trim();
  return `
    <div style="min-width:220px;max-width:280px;line-height:1.7">
      <div style="font-weight:800;font-size:18px;margin-bottom:6px">${name}</div>
      <div style="color:#9ca3af;font-size:13px;margin-bottom:4px">الأمن:</div>
      <div style="font-size:14px">${secLines}</div>
      ${notes ? `<div style="margin-top:8px;color:#9ca3af;font-size:12px">${escapeHtml(notes)}</div>` : ""}
    </div>
  `;
}

function openInfo(c) {
  infoWin.setContent(infoHtml(c));
  infoWin.setPosition(c.getCenter());
  infoWin.set("circle", c);
  infoWin.open({ map });
}
function refreshInfo(c) {
  if (infoWin.get("circle") === c) {
    infoWin.setContent(infoHtml(c));
  }
}

function escapeHtml(t) {
  const d = document.createElement("div");
  d.textContent = t;
  return d.innerHTML;
}
