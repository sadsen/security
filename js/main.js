/* ============ إعدادات عامة ============ */
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 }; // الدرعية
const DEFAULT_ZOOM   = 14;
const DEFAULT_RADIUS = 15; // م
const DEFAULT_STROKE = "#7c3aed";
const DEFAULT_FILL   = "#c084fc";
const DEFAULT_OPACITY = 0.25;

let map;
let trafficLayer, transitLayer, bicyclingLayer;
let circles = [];            // عناصر الدوائر (google.maps.Circle)
let current;                 // الدائرة المحددة للتحرير
let infoWindow;              // كرت المعلومات

/* ============ نقاط افتراضية (أسماء + إحداثيات) ============ */
const PRESET_POINTS = [
  ["بوابة سمحان", {lat:24.742132284177778, lng:46.569503913805825}],
  ["منطقة سمحان", {lat:24.74091335108621, lng:46.571891407130025}],
  ["دوار البجيري", {lat:24.737521801476476, lng:46.57406918772067}],
  ["إشارة البجيري", {lat:24.73766260194535, lng:46.575429040147306}],
  ["طريق الملك فيصل", {lat:24.736133848943062, lng:46.57696607050239}],
  ["نقطة فرز الشلهوب", {lat:24.73523670533632, lng:46.57785639752234}],
  ["المسار الرياضي المديد", {lat:24.735301077804944, lng:46.58178092599035}],
  ["ميدان الملك سلمان", {lat:24.73611373368281, lng:46.58407097038162}],
  ["دوار الضوء الخافت", {lat:24.739718342668006, lng:46.58352614787052}],
  ["المسار الرياضي طريق الملك خالد الفرعي", {lat:24.740797019998627, lng:46.5866145907347}],
  ["دوار البلدية", {lat:24.739266101368777, lng:46.58172727078356}],
  ["مدخل ساحة البلدية الفرعي", {lat:24.738638518378387, lng:46.579858026042785}],
  ["مدخل مواقف البجيري (كار بارك)", {lat:24.73826438056506, lng:46.57789576275729}],
  ["مواقف الامن", {lat:24.73808736962705, lng:46.57771858346317}],
  ["دوار الروقية", {lat:24.741985907266145, lng:46.56269186990043}],
  ["بيت مبارك", {lat:24.732609768937607, lng:46.57827089439368}],
  ["دوار وادي صفار", {lat:24.72491458984474, lng:46.57345489743978}],
  ["دوار راس النعامة", {lat:24.710329841152387, lng:46.572921959358204}],
  ["مزرعة الحبيب", {lat:24.709445443672344, lng:46.593971867951346}],
];

/* ============ أدوات مساعدة ============ */
function splitNames(text){
  return (text || "")
    .replace(/\r\n/g,"\n")
    .split("\n")
    .map(s=>s.trim())
    .filter(Boolean);
}

function buildInfoHtml(name, security, notes){
  const names = splitNames(security).join("\n");
  return `
    <div class="info-card">
      <div class="info-title">${name || "موقع بدون اسم"}</div>
      <div class="info-sub">الأمن:</div>
      <div class="info-list">${names || "—"}</div>
      ${notes ? `<div class="info-sub" style="margin-top:8px">ملاحظات:</div>
                 <div class="info-list">${notes}</div>` : ""}
    </div>
  `;
}

function openCard(circle){
  if(!infoWindow) infoWindow = new google.maps.InfoWindow();
  const d = circle.__data || {};
  infoWindow.setContent(buildInfoHtml(d.name, d.security, d.notes));
  infoWindow.setPosition(circle.getCenter());
  infoWindow.open(map);
}

/* ============ إنشاء دائرة ============ */
function makeCircle(center, initialData={}){
  const circle = new google.maps.Circle({
    strokeColor: initialData.strokeColor || DEFAULT_STROKE,
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: initialData.fillColor || DEFAULT_FILL,
    fillOpacity: (typeof initialData.fillOpacity === "number") ? initialData.fillOpacity : DEFAULT_OPACITY,
    map,
    center,
    radius: initialData.radius || DEFAULT_RADIUS,
    clickable: true,
    draggable: !!initialData.draggable,   // افتراضياً غير مفعّل
    editable:  !!initialData.editable     // افتراضياً غير مفعّل
  });

  // بيانات مرفقة
  circle.__data = {
    name: initialData.name || "",
    security: initialData.security || "",
    notes: initialData.notes || "",
    strokeColor: circle.get("strokeColor"),
    fillColor: circle.get("fillColor"),
    fillOpacity: circle.get("fillOpacity"),
  };

  // عرض الكرت عند المرور / اللمس
  circle.addListener("mouseover", () => openCard(circle));
  circle.addListener("click",     () => { current = circle; fillEditor(circle); });

  circles.push(circle);
  return circle;
}

/* ============ واجهة التحرير ============ */
const $ = (id)=>document.getElementById(id);

function fillEditor(circle){
  current = circle;
  const d = circle.__data || {};
  $("editorPanel").hidden = false;
  $("siteName").value       = d.name || "";
  $("securityNames").value  = d.security || "";
  $("notes").value          = d.notes || "";
  $("strokeColor").value    = d.strokeColor || DEFAULT_STROKE;
  $("fillColor").value      = d.fillColor || DEFAULT_FILL;
  $("fillOpacity").value    = typeof d.fillOpacity === "number" ? d.fillOpacity : DEFAULT_OPACITY;
  $("opacityVal").textContent = $("fillOpacity").value;
  $("radiusRange").value    = Math.round(circle.getRadius());
  $("radiusNumber").value   = Math.round(circle.getRadius());
  $("radiusVal").textContent= Math.round(circle.getRadius());
  $("dragToggle").checked   = !!circle.getDraggable();
  $("resizeToggle").checked = !!circle.getEditable();
}

function wireEditor(){
  $("closeEdit").onclick = ()=> { $("editorPanel").hidden = true; };

  const bind = (id, handler)=> $(id).addEventListener("input", handler);

  bind("siteName",  ()=>{ if(current){ current.__data.name = $("siteName").value; openCard(current);} });
  bind("securityNames", ()=>{ if(current){ current.__data.security = $("securityNames").value; openCard(current);} });
  bind("notes", ()=>{ if(current){ current.__data.notes = $("notes").value; openCard(current);} });

  bind("strokeColor", ()=>{ if(current){ current.setOptions({strokeColor:$("strokeColor").value}); current.__data.strokeColor=$("strokeColor").value; }});
  bind("fillColor",   ()=>{ if(current){ current.setOptions({fillColor:$("fillColor").value});   current.__data.fillColor=$("fillColor").value; }});
  bind("fillOpacity", ()=>{ if(current){ const v=parseFloat($("fillOpacity").value); $("opacityVal").textContent=v; current.setOptions({fillOpacity:v}); current.__data.fillOpacity=v; }});

  const radiusSync = (v)=>{
    $("radiusRange").value = v;
    $("radiusNumber").value= v;
    $("radiusVal").textContent=v;
    if(current){ current.setRadius(+v); }
  };
  $("radiusRange").addEventListener("input", e=>radiusSync(e.target.value));
  $("radiusNumber").addEventListener("input", e=>radiusSync(e.target.value));

  $("dragToggle").addEventListener("change", e=>{ if(current){ current.setDraggable(e.target.checked); }});
  $("resizeToggle").addEventListener("change", e=>{ if(current){ current.setEditable(e.target.checked); }});

  $("dupBtn").onclick = ()=>{
    if(!current) return;
    const c = current.getCenter();
    const off = 0.00025;
    const newCenter = {lat: c.lat()+off, lng: c.lng()+off};
    const clone = makeCircle(newCenter, {
      ...current.__data,
      radius: Math.round(current.getRadius()),
      draggable: current.getDraggable(),
      editable: current.getEditable()
    });
    fillEditor(clone);
    openCard(clone);
  };

  $("delBtn").onclick = ()=>{
    if(!current) return;
    current.setMap(null);
    circles = circles.filter(c=>c!==current);
    current = null;
    $("editorPanel").hidden = true;
  };
}

/* ============ مشاركة الخريطة ============ */
function compactData(){
  return {
    center: {lat: map.getCenter().lat(), lng: map.getCenter().lng(), z: map.getZoom()},
    circles: circles.map(c => ({
      lat: c.getCenter().lat(),
      lng: c.getCenter().lng(),
      r:   Math.round(c.getRadius()),
      sc:  c.get("strokeColor"),
      fc:  c.get("fillColor"),
      fo:  c.get("fillOpacity"),
      n:   c.__data?.name || "",
      s:   c.__data?.security || "",
      t:   c.__data?.notes || ""
    }))
  };
}
function encode(obj){
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)));
}
function shareMap(){
  const encoded = encode(compactData());
  const url = `${location.origin}/view.html?data=${encodeURIComponent(encoded)}`;
  navigator.clipboard.writeText(url)
    .then(()=>alert("تم نسخ رابط الخريطة!"))
    .catch(()=>prompt("انسخ الرابط:", url));
}

/* ============ الطبقات ============ */
function wireLayers(){
  const base = $("baseMapSelect");
  const traffic = $("trafficToggle");
  const transit = $("transitToggle");
  const bike    = $("bicyclingToggle");

  base.onchange = ()=> map.setMapTypeId(base.value);

  traffic.onchange = ()=>{
    if(traffic.checked){
      if(!trafficLayer) trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(map);
    }else if(trafficLayer){ trafficLayer.setMap(null); }
  };
  transit.onchange = ()=>{
    if(transit.checked){
      if(!transitLayer) transitLayer = new google.maps.TransitLayer();
      transitLayer.setMap(map);
    }else if(transitLayer){ transitLayer.setMap(null); }
  };
  bike.onchange = ()=>{
    if(bike.checked){
      if(!bicyclingLayer) bicyclingLayer = new google.maps.BicyclingLayer();
      bicyclingLayer.setMap(map);
    }else if(bicyclingLayer){ bicyclingLayer.setMap(null); }
  };
}

/* ============ ضمان إظهار أدوات التحرير ============ */
function ensureEditUI(){
  const isIndex = location.pathname.endsWith('/') || location.pathname.endsWith('/index.html') || !/view\.html$/i.test(location.pathname);
  if(!isIndex) return;

  const panel = $("editorPanel");
  const fab   = $("editFab");

  document.body.setAttribute('data-mode','edit');
  panel.hidden = false;

  let open = true;
  fab.addEventListener("click", ()=>{
    open = !open;
    panel.hidden = !open;
    try{ localStorage.setItem('editorOpen', open?'1':'0'); }catch{}
  });

  try{
    const last = localStorage.getItem('editorOpen');
    if(last==='0'){ open=false; panel.hidden=true; }
  }catch{}
}

/* ============ تهيئة ============ */
function init(){
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapTypeId: "roadmap",
    gestureHandling: "greedy",
    fullscreenControl: false,
    streetViewControl: false
  });

  infoWindow = new google.maps.InfoWindow();

  // نقاط افتراضية (كلها غير قابلة للسحب أو التغيير افتراضياً)
  PRESET_POINTS.forEach(([name, center])=>{
    const c = makeCircle(center, {
      name,
      radius: DEFAULT_RADIUS,
      strokeColor: DEFAULT_STROKE,
      fillColor: DEFAULT_FILL,
      fillOpacity: DEFAULT_OPACITY,
      draggable: false,
      editable: false
    });
    // افتح الكرت مباشرة عند المرور
    c.addListener("mouseover", ()=>openCard(c));
  });

  // إضافة موقع جديد بالنقر
  map.addListener("click", (e)=>{
    // إضافة مباشرة في وضع التحرير
    const c = makeCircle(e.latLng.toJSON(), {
      radius: DEFAULT_RADIUS,
      strokeColor: DEFAULT_STROKE,
      fillColor: DEFAULT_FILL,
      fillOpacity: DEFAULT_OPACITY,
      draggable: false,
      editable: false
    });
    fillEditor(c);
    openCard(c);
  });

  // أزرار
  $("addCircleBtn").onclick = ()=> alert("انقر على الخريطة لإضافة دائرة جديدة.");
  $("shareBtn").onclick     = shareMap;

  wireEditor();
  wireLayers();
  ensureEditUI();
}

/* ابدأ عند جاهزية Google Maps */
window.addEventListener("load", () => {
  if (window.google && google.maps) init();
  else {
    // في حال تأخر تحميل سكربت الخرائط
    const timer = setInterval(()=>{
      if (window.google && google.maps){
        clearInterval(timer);
        init();
      }
    }, 100);
  }
});
