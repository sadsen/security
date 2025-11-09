// تُستدعى عبر callback=initMap من سكربت Google
window.initMap = function () {
  const center = { lat: 24.7418, lng: 46.5758 }; // الدرعية تقريباً

  // تأكد من وجود عنصر الخريطة
  const el = document.getElementById('map');
  if (!el) {
    console.error('عنصر #map غير موجود.');
    return;
  }

  const map = new google.maps.Map(el, {
    center,
    zoom: 14,
    mapTypeId: 'roadmap',
    gestureHandling: 'greedy',
    disableDefaultUI: true // للتأكد أنه سموك تست "بدون عناصر إضافية"
  });

  // دبوس بسيط للتحقق من التشغيل
  new google.maps.Marker({ position: center, map, title: 'Test OK' });

  console.log('Map initialized ✅');
};

// التقط أي رفض وعود غير معالج
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason || e);
});

// في حال لم تُستدعَ initMap بسبب منع السكربت، أعطِ تحذيراً بعد مهلة
setTimeout(() => {
  if (!window.google || !window.google.maps) {
    console.error('لم يتم تحميل مكتبة Google Maps. تحقق من المفتاح/القيود/الشبكة/AdBlock.');
  }
}, 4000);
