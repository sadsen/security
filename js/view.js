/* =========================
   إعدادات العرض
========================= */
const DEFAULT_CENTER = { lat: 24.73722164546818, lng: 46.53877581519047 };
const DEFAULT_ZOOM   = 14;
const DEFAULT_RADIUS = 15;

const STYLE_STROKE = "#7c3aed";
const STYLE_FILL   = "#c084fc";
const STYLE_OPAC   = 0.25;

/* نفس قائمة المواقع احتياطيًا إذا لم يوجد view= */
const DEFAULT_SITES = [
  { name:"بوابة سمحان",                         lat:24.742132284177778, lng:46.569503913805825 },
  { name:"منطقة سمحان",                         lat:24.74091335108621,  lng:46.571891407130025 },
  { name:"دوار البجيري",                        lat:24.737521801476476, lng:46.57406918772067  },
  { name:"إشارة البجيري",                       lat:24.73766260194535,  lng:46.575429040147306 },
  { name:"طريق الملك فيصل",                     lat:24.736133848943062, lng:46.57696607050239  },
  { name:"نقطة فرز الشلهوب",                    lat:24.73523670533632,  lng:46.57785639752234  },
  { name:"المسار الرياضي المديد",               lat:24.735301077804944, lng:46.58178092599035  },
  { name:"ميدان الملك سلمان",                   lat:24.73611373368281,  lng:46.58407097038162  },
  { name:"دوار الضوء الخافت",                   lat:24.739718342668006, lng:46.58352614787052  },
  { name:"المسار الرياضي طريق الملك خالد الفرعي",lat:24.740797019998627, lng:46.5866145907347   },
  { name:"دوار البلدية",                        lat:24.739266101368777, lng:46.58172727078356  },
  { name:"مدخل ساحة البلدية الفرعي",            lat:24.738638518378387, lng:46.579858026042785 },
  { name:"مدخل مواقف البجيري (كار بارك)",       lat:24.73826438056506,  lng:46.57789576275729  },
  { name:"مواقف الامن",                         lat:24.73808736962705,  lng:46.57771858346317  },
  { name:"دوار الروقية",                        lat:24.741985907266145, lng:46.56269186990043  },
  { name:"بيت مبارك",                           lat:24.732609768937607, lng:46.57827089439368  },
  { name:"دوار وادي صفار",                      lat:24.72491458984474,  lng:46.57345489743978  },
  { name:"دوار راس النعامة",                    lat:24.710329841152387, lng:46.572921959358204 },
  { name:"مزرعة الحبيب",                        lat:24.709445443672344, lng:46.593971867951346 }
].map(s => ({ ...s, radius: DEFAULT_RADIUS, strokeColor: STYLE_STROKE, fillColor: STYLE_FILL, fillOpacity: STYLE_OPAC, security:"", notes:"" }));

/* ترميز/فك ترميز */
function expandData(obj) {
  return {
    center: { lat: obj.c?.L ?? DEFAULT_CENTER.lat, lng: obj.c?.G ?? DEFAULT_CENTER.lng, zoom: obj.c?.z ?? DEFAULT_ZOOM },
    circles: (obj.r ?? []).map(e => ({
      lat: e.L, lng: e.G, radius: e.d ?? DEFAULT_RADIUS,
      strokeColor: e.sc ?? STYLE_STROKE, fillColor: e.fc ?? STYLE_FILL, fillOpacity: e.fo ?? STYLE_OPAC,
      name: e.n || "", security: e.s || "", notes: e.t || ""
    }))
  };
}
function decodeData(encoded) {
  const bin = atob(encoded);
  const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return expandData(JSON.parse(new TextDecoder().decode(bytes)));
}

/* لافتة اسم */
function makeCenterLabel(position, text){
  const el = document.createElement("div");
  el.className = "circle-name-badge";
  el.textContent = text || "بدون اسم";
  return new google.maps.marker.AdvancedMarkerElement({
    position, content: el,
    collisionBehavior: google.maps.CollisionBehavior.REQUIRED,
    zIndex: 1000
  });
}

let map, infoWindow;

window.initMap = function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    mapId: "DIRIYAH_SECURITY_MAP",
    gestureHandling: "greedy",
    fullscreenControl: true
  });
  infoWindow = new google.maps.InfoWindow({});

  const url = new URL(location.href);
  const view = url.searchParams.get("view");

  if (view) {
    try {
      const data = decodeData(decodeURIComponent(view));
      draw(data);
      map.setCenter({lat: data.center.lat, lng: data.center.lng});
      map.setZoom(data.center.zoom);
      return;
    } catch(e){ console.error("فشل قراءة الرابط:", e); }
  }
  draw({ center:{...DEFAULT_CENTER, zoom:DEFAULT_ZOOM}, circles: DEFAULT_SITES });
};

function infoHtml(d){
  return `
    <h4>${escapeHtml(d.name || "بدون اسم")}</h4>
    <span class="label">الأمن:</span>
    <p class="names">${escapeHtml(d.security || "—").replace(/\n/g,"<br>")}</p>
    ${d.notes ? `<div class="sep"></div><div>${escapeHtml(d.notes)}</div>` : ""}
  `;
}

function draw(data){
  (data.circles || []).forEach(d => {
    const c = new google.maps.Circle({
      map,
      center: { lat: d.lat, lng: d.lng },
      radius: d.radius ?? DEFAULT_RADIUS,
      strokeColor: d.strokeColor ?? STYLE_STROKE,
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: d.fillColor ?? STYLE_FILL,
      fillOpacity: d.fillOpacity ?? STYLE_OPAC,
      draggable: false,
      editable: false
    });

    const label = makeCenterLabel(c.getCenter(), d.name);
    label.map = map;

    c.addListener("mouseover", () => {
      infoWindow.setContent(infoHtml(d));
      infoWindow.setPosition(c.getCenter());
      infoWindow.open({ map });
    });
    c.addListener("mouseout", () => infoWindow.close());
  });
}

function escapeHtml(t=""){
  const div = document.createElement("div");
  div.textContent = t;
  return div.innerHTML;
}
