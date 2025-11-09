let map, trafficLayer;
const locations = [
  { name: "بوابة سمحان", lat: 24.742132284177778, lng: 46.569503913805825 },
  { name: "منطقة سمحان", lat: 24.74091335108621, lng: 46.571891407130025 },
  { name: "دوار البجيري", lat: 24.737521801476476, lng: 46.57406918772067 },
  { name: "إشارة البجيري", lat: 24.73766260194535, lng: 46.575429040147306 },
  { name: "طريق الملك فيصل", lat: 24.736133848943062, lng: 46.57696607050239 },
];

function initMap() {
  const diriyah = { lat: 24.7399, lng: 46.5731 };
  map = new google.maps.Map(document.getElementById("map"), {
    center: diriyah,
    zoom: 15,
    mapTypeId: "roadmap",
    disableDefaultUI: true,
  });

  trafficLayer = new google.maps.TrafficLayer();

  // إضافة الدوائر
  locations.forEach((loc) => {
    const circle = new google.maps.Circle({
      strokeColor: "#c1a476",
      strokeWeight: 2,
      fillColor: "#c1a476",
      fillOpacity: 0.25,
      map,
      center: { lat: loc.lat, lng: loc.lng },
      radius: 15,
    });

    const info = new google.maps.InfoWindow({
      content: `
      <div style="
        background: rgba(255,255,255,0.85);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 10px;
        min-width: 180px;
      ">
        <div style="display:flex;align-items:center;gap:8px;">
          <img src="img/diriyah-logo.png" alt="Diriyah" style="width:38px;height:38px;">
          <strong>${loc.name}</strong>
        </div>
      </div>`,
    });

    // عرض الكرت عند المرور، وتثبيته بالضغط
    let pinned = false;
    circle.addListener("mouseover", () => {
      if (!pinned) info.open({ map, position: circle.getCenter() });
    });
    circle.addListener("mouseout", () => {
      if (!pinned) info.close();
    });
    circle.addListener("click", () => {
      pinned = !pinned;
      if (!pinned) info.close();
    });

    map.addListener("click", () => {
      pinned = false;
      info.close();
    });
  });

  // أزرار العرض
  const road = document.getElementById("road");
  const sat = document.getElementById("sat");
  const traffic = document.getElementById("traffic");

  road.onclick = () => {
    map.setMapTypeId("roadmap");
    road.classList.add("active");
    sat.classList.remove("active");
  };

  sat.onclick = () => {
    map.setMapTypeId("hybrid");
    sat.classList.add("active");
    road.classList.remove("active");
  };

  traffic.onclick = () => {
    const active = traffic.classList.toggle("active");
    trafficLayer.setMap(active ? map : null);
  };
}
