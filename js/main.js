/* ============== إعدادات أولية ============== */
const DEFAULT_CENTER = { lat: 24.73722, lng: 46.53878 }; // الدرعية
const DEFAULT_ZOOM   = 14;
const DEFAULT_RADIUS = 15; // متر
const DEFAULT_STYLE  = {
  strokeColor: "#7c3aed",
  strokeOpacity: 1,
  strokeWeight: 3,
  fillColor: "#a78bfa",
  fillOpacity: 0.25
};

let map, info, selectedCircle = null;
const circles = [];        // google.maps.Circle[]
const sitesData = [];      // مصدر الحقيقة (للترميز)

/* ============== قائمة المواقع الافتراضية (نصف قطر 15م) ============== */
const DEFAULT_SITES = [
  {name:"بوابة سمحان", lat:24.742132284177778, lng:46.569503913805825},
  {name:"منطقة سمحان", lat:24.74091335108621 , lng:46.571891407130025},
  {name:"دوار البجيري", lat:24.737521801476476, lng:46.57406918772067},
  {name:"إشارة البجيري", lat:24.73766260194535 , lng:46.575429040147306},
  {name:"طريق الملك فيصل", lat:24.736133848943062, lng:46.57696607050239},
  {name:"نقطة فرز الشلهوب", lat:24.73523670533632 , lng:46.57785639752234},
  {name:"المسار الرياضي المديد", lat:24.735301077804944, lng:46.58178092599035},
  {name:"ميدان الملك سلمان", lat:24.73611373368281 , lng:46.58407097038162},
  {name:"دوار الضوء الخافت", lat:24.739718342668006, lng:46.58352614787052},
  {name:"المسار الرياضي طريق الملك خالد الفرعي", lat:24.740797019998627, lng:46.5866145907347},
  {name:"دوار البلدية", lat:24.739266101368777, lng:46.58172727078356},
  {name:"مدخل ساحة البلدية الفرعي", lat:24.738638518378387, lng:46.579858026042785},
  {name:"مدخل مواقف البجيري (كار بارك)", lat:24.73826438056506 , lng:46.57789576275729},
  {name:"مواقف الامن", lat:24.73808736962705 , lng:46.57771858346317},
  {name:"دوار الروقية", lat:24.741985907266145, lng:46.56269186990043},
  {name:"بيت مبارك", lat:24.732609768937607, lng:46.57827089439368},
  {name:"دوار وادي صفار", lat:24.72491458984474 , lng:46.57345489743978},
  {name:"دوار راس النعامة", lat:24.710329841152387, lng:46.572921959358204},
  {name:"مزرعة الحبيب", lat:24.709445443672344, lng:46.593971867951346},
];

/* ============== أدوات مساعدة ============== */
function escapeHtml(s=""){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;");
}
function toBase64Url(uint8){
  const b64 = btoa(String.fromCharCode(...uint8));
  return b64.replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function fromBase64Url(s){
  s = s.replaceAll("-","+").replaceAll("_","/");
  while(s.length % 4) s += "=";
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
function compactData(){
  return {
    c:[map.getCenter().lat(), map.getCenter().lng(), map.getZoom()],
    r: sitesData.map(d => [
      d.lat, d.lng, d.radius ?? DEFAULT_RADIUS,
      d.strokeColor ?? DEFAULT_STYLE.strokeColor,
      d.fillColor ?? DEFAULT_STYLE.fillColor,
      d.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
      d.name||"", d.security||"", d.notes||"",
      d.draggable?1:0, d.editable?1:0
    ])
  };
}
function expandData(o){
  const out = {
    center: {lat:o.c?.[0]??DEFAULT_CENTER.lat, lng:o.c?.[1]??DEFAULT_CENTER.lng, zoom:o.c?.[2]??DEFAULT_ZOOM},
    circles: []
  };
  (o.r||[]).forEach(a=>{
    out.circles.push({
      lat:a[0], lng:a[1], radius:a[2],
      strokeColor:a[3], fillColor:a[4], fillOpacity:a[5],
      name:a[6], security:a[7], notes:a[8],
      draggable: !!a[9], editable: !!a[10]
    });
  });
  return out;
}

/* ============== Google InfoWindow HTML ============== */
function infoHtml(circleOrData){
  const d = circleOrData._data ? circleOrData._data : circleOrData;
  const name = (d.name||"موقع بدون اسم").trim();
  const sec = (d.security||"").trim();
  const notes = (d.notes||"").trim();
  const secLines = sec ? sec.split(/\r?\n/).map(s=>`<div>• ${escapeHtml(s)}</div>`).join("") : "<div>—</div>";
  return `
    <div style="min-width:240px;max-width:320px;direction:rtl;text-align:right;line-height:1.7;color:#fff">
      <div class="custom-badge">${escapeHtml(name)}</div>
      <div style="color:#cbd5e1;font-size:13px;margin-bottom:4px">الأمن:</div>
      <div style="font-size:14px;color:#fff">${secLines}</div>
      ${notes?`<div style="margin-top:8px;color:#cbd5e1;font-size:12px">${escapeHtml(notes)}</div>`:""}
    </div>
  `;
}

/* ============== بناء واجهة الطبقات ============== */
function buildLayersUI(){
  const card = document.createElement("div");
  card.className = "layers-card";
  card.dir = "rtl";
  card.innerHTML = `
    <h4>الطبقات</h4>
    <div class="form-row">
      <label>نوع الخريطة</label>
      <select id="baseMapSelect">
        <option value="roadmap">خريطة</option>
        <option value="satellite">قمر صناعي</option>
        <option value="hybrid">هجين</option>
        <option value="terrain">تضاريس</option>
      </select>
    </div>
    <label><input id="tLayer" type="checkbox"> حركة المرور</label>
    <label><input id="pLayer" type="checkbox"> النقل العام</label>
    <label><input id="bLayer" type="checkbox"> مسارات الدراجات</label>
  `;
  document.body.appendChild(card);

  const traffic = new google.maps.TrafficLayer();
  const transit = new google.maps.TransitLayer();
  const bike    = new google.maps.BicyclingLayer();

  document.getElementById("baseMapSelect").addEventListener("change", e=>{
    map.setMapTypeId(e.target.value);
  });
  document.getElementById("tLayer").addEventListener("change", e=>{
    e.target.checked ? traffic.setMap(map) : traffic.setMap(null);
  });
  document.getElementById("pLayer").addEventListener("change", e=>{
    e.target.checked ? transit.setMap(map) : transit.setMap(null);
  });
  document.getElementById("bLayer").addEventListener("change", e=>{
    e.target.checked ? bike.setMap(map) : bike.setMap(null);
  });
}

/* ============== لوحة التحرير اليمنى ============== */
function buildEditorUI(){
  const panel = document.createElement("aside");
  panel.id = "editorPanel";
  panel.dir = "rtl";
  panel.innerHTML = `
    <div id="editorHeader">
      <div id="editorTitle">لوحة التحكم</div>
      <button id="editorClose" title="إغلاق">×</button>
    </div>
    <div id="editorBody">
      <button class="btn btn-primary" id="addSiteBtn">➕ إضافة موقع</button>
      <button class="btn btn-secondary" id="shareBtn">📤 مشاركة الخريطة</button>

      <div id="noSel" style="margin-top:12px;color:#94a3b8">
        لا توجد دائرة محددة. اضغط على أي دائرة لبدء التحرير.
      </div>

      <div id="editCard" style="display:none;margin-top:12px">
        <div class="form-row">
          <label>اسم الموقع</label>
          <input id="fName" class="input" placeholder="مثال: دوار البجيري" />
        </div>

        <div class="form-row">
          <label>أفراد الأمن (كل اسم في سطر)</label>
          <textarea id="fSec" class="textarea" placeholder="اكتب كل اسم في سطر"></textarea>
        </div>

        <div class="form-row">
          <label>ملاحظات</label>
          <textarea id="fNotes" class="textarea" placeholder="...ملاحظات"></textarea>
        </div>

        <div class="form-row" style="display:flex;gap:10px">
          <div style="flex:1">
            <label>لون الحد</label>
            <input id="fStroke" type="color" class="color" value="${DEFAULT_STYLE.strokeColor}">
          </div>
          <div style="flex:1">
            <label>لون التعبئة</label>
            <input id="fFill" type="color" class="color" value="${DEFAULT_STYLE.fillColor}">
          </div>
        </div>

        <div class="form-row">
          <label>شفافية التعبئة: <span id="opaVal">${DEFAULT_STYLE.fillOpacity}</span></label>
          <input id="fOpa" type="range" min="0" max="1" step="0.01" value="${DEFAULT_STYLE.fillOpacity}" class="range">
        </div>

        <div class="form-row">
          <label>نصف القطر (م): <span id="radVal">${DEFAULT_RADIUS}</span></label>
          <input id="fRad" type="range" min="5" max="120" step="1" value="${DEFAULT_RADIUS}" class="range">
        </div>

        <div class="switches">
          <label><input id="fDrag" type="checkbox"> سحب الدائرة</label>
          <label><input id="fEdit" type="checkbox"> تغيير الحجم</label>
        </div>

        <button class="btn btn-secondary" id="dupBtn">نسخ الدائرة</button>
        <button class="btn btn-danger" id="delBtn">حذف الدائرة</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById("editorClose").onclick = ()=> panel.classList.toggle("hidden");
  document.getElementById("addSiteBtn").onclick  = onAddSite;
  document.getElementById("shareBtn").onclick    = onShare;

  // حقول التحرير – لا نعيد ضبط قيمها أثناء الكتابة (لتفادي قفز المؤشر)
  const fName  = document.getElementById("fName");
  const fSec   = document.getElementById("fSec");
  const fNotes = document.getElementById("fNotes");
  const fStroke= document.getElementById("fStroke");
  const fFill  = document.getElementById("fFill");
  const fOpa   = document.getElementById("fOpa");
  const fRad   = document.getElementById("fRad");
  const fDrag  = document.getElementById("fDrag");
  const fEdit  = document.getElementById("fEdit");
  const opaVal = document.getElementById("opaVal");
  const radVal = document.getElementById("radVal");

  function bindField(el, key, post){
    el.addEventListener("input", ()=>{
      if(!selectedCircle) return;
      selectedCircle._data[key] = el.value;
      post?.();
    });
  }
  bindField(fName , "name",  ()=> { /* لا شيء */ });
  bindField(fSec  , "security");
  bindField(fNotes, "notes");
  bindField(fStroke,"strokeColor", ()=> selectedCircle.setOptions({strokeColor: fStroke.value}));
  bindField(fFill  ,"fillColor"  , ()=> selectedCircle.setOptions({fillColor: fFill.value}));
  fOpa.addEventListener("input", ()=>{
    if(!selectedCircle) return;
    const v = parseFloat(fOpa.value)||0.25;
    opaVal.textContent = v.toFixed(2);
    selectedCircle._data.fillOpacity = v;
    selectedCircle.setOptions({fillOpacity: v});
  });
  fRad.addEventListener("input", ()=>{
    if(!selectedCircle) return;
    const m = parseFloat(fRad.value)||DEFAULT_RADIUS;
    radVal.textContent = m;
    selectedCircle._data.radius = m;
    selectedCircle.setRadius(m);
  });
  fDrag.addEventListener("change", ()=>{
    if(!selectedCircle) return;
    const on = !!fDrag.checked;
    selectedCircle._data.draggable = on;
    selectedCircle.setDraggable(on);
  });
  fEdit.addEventListener("change", ()=>{
    if(!selectedCircle) return;
    const on = !!fEdit.checked;
    selectedCircle._data.editable = on;
    selectedCircle.setEditable(on);
  });

  document.getElementById("dupBtn").onclick = ()=>{
    if(!selectedCircle) return;
    const d = selectedCircle._data;
    createCircle({...d, lat:d.lat + 0.0002, lng:d.lng + 0.0002}, true);
  };
  document.getElementById("delBtn").onclick = ()=>{
    if(!selectedCircle) return;
    const i = circles.indexOf(selectedCircle);
    if(i>-1){ circles[i].setMap(null); circles.splice(i,1); sitesData.splice(i,1); }
    selectedCircle = null;
    document.getElementById("editCard").style.display="none";
    document.getElementById("noSel").style.display="";
  };

  // اختيار دائرة من الخريطة يملأ الحقول مرة واحدة
  function fillEditor(d){
    fName.value  = d.name||"";
    fSec.value   = d.security||"";
    fNotes.value = d.notes||"";
    fStroke.value= d.strokeColor||DEFAULT_STYLE.strokeColor;
    fFill.value  = d.fillColor||DEFAULT_STYLE.fillColor;
    fOpa.value   = (d.fillOpacity ?? DEFAULT_STYLE.fillOpacity);
    opaVal.textContent = (+fOpa.value).toFixed(2);
    fRad.value   = d.radius ?? DEFAULT_RADIUS;
    radVal.textContent = fRad.value;
    fDrag.checked= !!d.draggable;
    fEdit.checked= !!d.editable;
  }
  // نجعل الوظيفة متاحة خارجيًا
  window.__fillEditor = fillEditor;
}

/* ============== إنشاء دائرة على الخريطة ============== */
function createCircle(d, pushToData=true){
  const circle = new google.maps.Circle({
    map,
    center:{lat:d.lat, lng:d.lng},
    radius: d.radius ?? DEFAULT_RADIUS,
    ...DEFAULT_STYLE,
    strokeColor: d.strokeColor ?? DEFAULT_STYLE.strokeColor,
    fillColor:   d.fillColor   ?? DEFAULT_STYLE.fillColor,
    fillOpacity: d.fillOpacity ?? DEFAULT_STYLE.fillOpacity,
    draggable: !!d.draggable,  // افتراضيًا false
    editable:  !!d.editable    // افتراضيًا false
  });
  circle._data = {
    name:d.name||"", security:d.security||"", notes:d.notes||"",
    lat:d.lat, lng:d.lng, radius: circle.getRadius(),
    strokeColor: circle.get("strokeColor"),
    fillColor:   circle.get("fillColor"),
    fillOpacity: circle.get("fillOpacity"),
    draggable:   circle.getDraggable(),
    editable:    circle.getEditable()
  };
  const iw = new google.maps.InfoWindow({content: infoHtml(circle)});
  circle.addListener("click", ()=>{
    selectedCircle = circle;
    iw.setContent(infoHtml(circle));
    iw.open({map, anchor: circle});
    document.getElementById("editCard").style.display="";
    document.getElementById("noSel").style.display="none";
    window.__fillEditor(circle._data);
  });
  circle.addListener("dragend", ()=>{
    const c = circle.getCenter();
    circle._data.lat = c.lat(); circle._data.lng = c.lng();
  });
  circle.addListener("radius_changed", ()=>{
    circle._data.radius = circle.getRadius();
  });

  circles.push(circle);
  if(pushToData) sitesData.push(circle._data);
  return circle;
}

/* ============== أحداث الأزرار ============== */
function onAddSite(){
  const c = map.getCenter();
  createCircle({
    lat:c.lat(), lng:c.lng(), name:"", security:"", notes:"",
    draggable:false, editable:false, radius:DEFAULT_RADIUS
  }, true);
}
async function onShare(){
  const comp = compactData();
  const json = JSON.stringify(comp);
  const bytes= new TextEncoder().encode(json);
  const token= toBase64Url(bytes);
  const url  = `${location.origin}/view.html?d=${token}`;
  try{
    await navigator.clipboard.writeText(url);
    alert("تم نسخ رابط العرض!"); 
  }catch{
    prompt("انسخ الرابط:", url);
  }
}

/* ============== تشغيل الخرائط ============== */
window.initMap = function(){
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, mapTypeControl:false, fullscreenControl:true
  });
  info = new google.maps.InfoWindow();

  buildLayersUI();
  buildEditorUI();

  // أضف المواقع الافتراضية (drag/edit افتراضيًا متوقف)
  DEFAULT_SITES.forEach(s=>{
    createCircle({...s, radius: DEFAULT_RADIUS, draggable:false, editable:false}, true);
  });
};
