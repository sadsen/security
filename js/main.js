// أدوات URL بسيطة
function getParams() { return new URLSearchParams(location.search); }
function toFixed6(x) { return Number(x).toFixed ? Number(x).toFixed(6) : x; }

// تُستدعى عبر callback=initMap من سكربت Google
window.initMap = function () {
  // قراءة الإعدادات من الرابط
  const params = getParams();
  const isShare = params.get('view') === 'share';

  const defaultCenter = { lat: 24.7418, lng: 46.5758 }; // الدرعية
  const center = {
    lat: parseFloat(params.get('lat')) || defaultCenter.lat,
    lng: parseFloat(params.get('lng')) || defaultCenter.lng,
  };
  const zoom = parseInt(params.get('z') || '14', 10);
  const mapTypeId = (params.get('t') || 'roadmap');

  // عناصر DOM
  const mapEl = document.getElementById('map');
  const panel = document.getElementById('panel');
  const sharebar = document.getElementById('sharebar');
  const exitShare = document.getElementById('exit-share');

  // إظهار/إخفاء حسب وضع العرض
  if (isShare) {
    panel.classList.add('hidden');
    sharebar.classList.remove('hidden');
    exitShare.href = location.pathname; // رجوع للوضع الكامل
  } else {
    panel.classList.remove('hidden');
    sharebar.classList.add('hidden');
  }

  // إنشاء الخريطة
  const map = new google.maps.Map(mapEl, {
    center, zoom, mapTypeId,
    gestureHandling: 'greedy',
    disableDefaultUI: isShare // في وضع العرض نخليها أنظف
  });

  // بيانات الاختبار (نفسها من المرحلة السابقة)
  const SITES = [
    { name: 'بوابة سمحان', type: 'بوابة',   lat: 24.742132355539432, lng: 46.56966664740594 },
    { name: 'دوار البجيري', type: 'دوار',   lat: 24.73754835059363,  lng: 46.57401116325427 },
    { name: 'ميدان الملك سلمان', type: 'ميدان', lat: 24.7406,            lng: 46.5802 },
  ];

  const DEFAULT_RADIUS_M = 15;

  // كرت المعلومات
  const card = document.getElementById('info-card');
  const closeBtn = card.querySelector('.close');
  const nameEl = document.getElementById('site-name');
  const typeEl = document.getElementById('site-type');
  const coordEl = document.getElementById('site-coord');
  const radiusEl = document.getElementById('site-radius');

  const state = { openId: null };

  function openCard(site) {
    nameEl.textContent = site.name || '—';
    typeEl.textContent = site.type || '—';
    coordEl.textContent = `${toFixed6(site.lat)}, ${toFixed6(site.lng)}`;
    radiusEl.textContent = `${DEFAULT_RADIUS_M} م`;
    card.classList.remove('hidden');
  }
  function closeCard() {
    card.classList.add('hidden');
    state.openId = null;
  }
  closeBtn.addEventListener('click', closeCard);
  map.addListener('click', closeCard);

  // الطبقات: markers & circles
  const markers = [];
  const circles = [];

  SITES.forEach((site, idx) => {
    const pos = { lat: site.lat, lng: site.lng };
    const marker = new google.maps.Marker({
      position: pos, map, title: site.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6, fillColor: '#e11d48', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 2
      },
      zIndex: 2
    });
    markers.push(marker);

    const circle = new google.maps.Circle({
      map, center: pos, radius: DEFAULT_RADIUS_M,
      strokeColor: '#60a5fa', strokeOpacity: 0.9, strokeWeight: 2,
      fillColor: '#60a5fa', fillOpacity: 0.15, clickable: false, zIndex: 1
    });
    circles.push(circle);

    marker.addListener('click', () => {
      state.openId = idx;
      openCard(site);
      map.panTo(pos);
      circle.setOptions({ strokeOpacity: 1, fillOpacity: 0.22 });
      setTimeout(() => circle.setOptions({ strokeOpacity: 0.9, fillOpacity: 0.15 }), 250);
    });
  });

  // عناصر التحكم في اللوحة (إن لم نكن في وضع العرض)
  const toggleMarkers = document.getElementById('toggle-markers');
  const toggleCircles = document.getElementById('toggle-circles');
  const baseMapSel = document.getElementById('basemap');
  const shareBtn = document.getElementById('share-btn');
  const toast = document.getElementById('toast');

  if (!isShare) {
    // تهيئة قيمة نوع الخريطة من الرابط
    baseMapSel.value = map.getMapTypeId();

    toggleMarkers.addEventListener('change', () => {
      const show = toggleMarkers.checked;
      markers.forEach(m => m.setMap(show ? map : null));
    });
    toggleCircles.addEventListener('change', () => {
      const show = toggleCircles.checked;
      circles.forEach(c => c.setMap(show ? map : null));
    });
    baseMapSel.addEventListener('change', () => {
      map.setMapTypeId(baseMapSel.value);
    });

    // زر نسخ رابط العرض
    shareBtn.addEventListener('click', async () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const t = map.getMapTypeId();
      const vis = [
        toggleMarkers.checked ? 'm1' : 'm0',
        toggleCircles.checked ? 'c1' : 'c0'
      ].join(',');
      const url = `${location.origin}${location.pathname}?view=share&lat=${toFixed6(c.lat())}&lng=${toFixed6(c.lng())}&z=${z}&t=${encodeURIComponent(t)}&vis=${vis}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.textContent = 'تم النسخ ✅';
      } catch {
        toast.textContent = url; //fallback: اعرض الرابط للنسخ اليدوي
      }
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2000);
    });

    // إن كان في الرابط vis فطبّقه (للعودة من وضع العرض إلى الكامل مع نفس الإعدادات)
    const visParam = params.get('vis');
    if (visParam) {
      const parts = visParam.split(',');
      const mOn = parts.includes('m1');
      const cOn = parts.includes('c1');
      toggleMarkers.checked = mOn;
      toggleCircles.checked = cOn;
      markers.forEach(m => m.setMap(mOn ? map : null));
      circles.forEach(c => c.setMap(cOn ? map : null));
    }
  } else {
    // في وضع العرض: احترم vis إن وُجد
    const visParam = params.get('vis');
    if (visParam) {
      const parts = visParam.split(',');
      const mOn = parts.includes('m1');
      const cOn = parts.includes('c1');
      markers.forEach(m => m.setMap(mOn ? map : null));
      circles.forEach(c => c.setMap(cOn ? map : null));
    }
  }

  // دبوس التشغيل (اختياري)
  new google.maps.Marker({
    position: center, map, title: 'Test OK',
    icon: { path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 4,
      fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 1.5 },
    zIndex: 0
  });

  console.log('Map + Layers panel + Share view ready ✅');
};

// أخطاء عامة
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason || e);
});
setTimeout(() => {
  if (!window.google || !window.google.maps) {
    console.error('لم يتم تحميل مكتبة Google Maps. تحقق من المفتاح/القيود/الشبكة/مانعات الإعلانات.');
  }
}, 4000);
