'use strict';

/* ============================================================
   Diriyah Security Map – v25.0 (Google My Maps Replica)
   • نافذة اختيار رموز (Icon Picker) مطابقة لـ Google My Maps
   • شبكة ألوان (Color Grid) قياسية
   • إصلاح جذري لوضع الدائرة (بدون ماركر فوقي)
   ============================================================ */


/* ------------------------------------------------------------
   Event Bus — نظام أحداث
------------------------------------------------------------ */
window.initMap = function () {
    if (window.MapController && typeof window.MapController.init === 'function') {
        window.MapController.init();
    } else {
        console.error("MapController لم يتم تحميله.");
    }
};

class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(h => h(data));
        }
    }
}

const bus = new EventBus();


/* ------------------------------------------------------------
   Utilities — أدوات عامة
------------------------------------------------------------ */
const Utils = {

    clamp(v, min, max) {
        return Math.min(max, Math.max(min, v));
    },

    escapeHTML(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    },

    b64uEncode(str) {
        try {
            const textEncoder = new TextEncoder();
            const bytes = textEncoder.encode(str);
            const compressed = pako.deflate(bytes);
            let bin = "";
            compressed.forEach(b => bin += String.fromCharCode(b));
            const base64 = btoa(bin);
            return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        } catch (e) {
            console.error("Compression/Encoding error", e);
            return "";
        }
    },

    b64uDecode(str) {
        try {
            if (!str) return null;
            str = str.replace(/[^A-Za-z0-9\-_]/g, "");
            const pad = (4 - (str.length % 4)) % 4;
            str += "=".repeat(pad);
            const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
            const decoded = atob(base64);
            const compressedBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
            const decompressedBytes = pako.inflate(compressedBytes);
            const textDecoder = new TextDecoder();
            return textDecoder.decode(decompressedBytes);
        } catch (e) {
            console.error("Decompression/Decoding error", e);
            return null;
        }
    },

    formatDistance(m) {
        if (!m) return "0 م";
        if (m < 1000) return m.toFixed(0) + " م";
        return (m / 1000).toFixed(2) + " كم";
    },

    formatDuration(sec) {
        if (!sec) return "0 دقيقة";
        const m = Math.round(sec / 60);
        if (m < 60) return m + " دقيقة";
        const h = Math.floor(m / 60);
        const r = m % 60;
        return `${h} ساعة ${r} دقيقة`;
    },

    formatArea(meters) {
        if (!meters) return "0 م²";
        if (meters >= 1000000) {
            return (meters / 1000000).toFixed(2) + " كم²";
        }
        return Math.round(meters).toLocaleString('ar-SA') + " م²";
    }
};

/* ============================================================
   MapController — وحدة إدارة الخريطة
============================================================ */
class MapController {

    constructor() {
        this.map = null;
        this.trafficLayer = null;
        this.bicyclingLayer = null;
        this.transitLayer = null;

        this.editMode = true;
        this.shareMode = false;

        this.centerDefault = { lat: 24.7399, lng: 46.5731 };
        this.zoomDefault = 15;

        this.modeAdd = false;
        this.modeRouteAdd = false;
        this.modePolygonAdd = false;

        window.MapController = this;
    }

    init() {
        console.log("Boot v25.0 - My Maps Replica");

        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");
        this.editMode = !this.shareMode;

        // تعريف الأنماط المخصصة للخريطة
        const darkModeStyle = [
            { elementType: "geometry", stylers: [{ color: "#212121" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
            { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
            { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
        ];

        const silverStyle = [
            { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] }
        ];

        this.map = new google.maps.Map(document.getElementById("map"), {
            center: this.centerDefault,
            zoom: this.zoomDefault,
            mapTypeId: "roadmap",
            mapId: "b76177e462344e3ee4d9178b",
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: 'greedy',
            clickableIcons: false
        });

        this.trafficLayer = new google.maps.TrafficLayer();
        this.bicyclingLayer = new google.maps.BicyclingLayer();
        this.transitLayer = new google.maps.TransitLayer();

        this.map.mapTypes.set("dark", new google.maps.StyledMapType(darkModeStyle, { name: "الوضع الليلي" }));
        this.map.mapTypes.set("silver", new google.maps.StyledMapType(silverStyle, { name: "فضي" }));

        this.map.addListener("zoom_changed", () => {
            bus.emit("map:zoom", this.map.getZoom());
        });

        this.map.addListener("bounds_changed", () => {
            bus.emit("map:bounds");
        });

        this.waitForGmpMarkersAndEmit();
    }

    waitForGmpMarkersAndEmit() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            console.log("gmp-markers library is ready. Emitting 'map:ready' event.");
            bus.emit("map:ready", this.map);
        } else {
            console.log("Waiting for gmp-markers library...");
            setTimeout(() => this.waitForGmpMarkersAndEmit(), 100);
        }
    }

    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("hybrid"); }
    setTerrain() { this.map.setMapTypeId("terrain"); }
    setDarkMode() { this.map.setMapTypeId("dark"); }
    setSilverMode() { this.map.setMapTypeId("silver"); }

    toggleTraffic() {
        if (this.trafficLayer.getMap()) this.trafficLayer.setMap(null);
        else this.trafficLayer.setMap(this.map);
    }
    toggleBicycling() {
        if (this.bicyclingLayer.getMap()) this.bicyclingLayer.setMap(null);
        else this.bicyclingLayer.setMap(this.map);
    }
    toggleTransit() {
        if (this.transitLayer.getMap()) this.transitLayer.setMap(null);
        else this.transitLayer.setMap(this.map);
    }

    setCursor(c) {
        this.map.setOptions({ draggableCursor: c });
    }
}

const MAP = new MapController();

/* ============================================================
   LocationManager — المواقع (نظام خرائطي الكامل)
============================================================ */
class LocationManager {

    constructor() {
        this.items = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        
        // ألوان خرائطي القياسية
        this.colors = [
            "#0288D1", "#E53935", "#F09300", "#109D59", 
            "#7B1FA2", "#F06292", "#009688", "#546E7A", "#795548", "#000000"
        ];

        // قاعدة بيانات الأيقونات (تصنيف + رموز)
        this.iconLibrary = {
            "الأشكال": [
                { id: "place", name: "دبوس" },
                { id: "circle", name: "دائرة" },
                { id: "square", name: "مربع" },
                { id: "diamond", name: "معين" },
                { id: "star", name: "نجمة" }
            ],
            "الرياضة والاستجمام": [
                { id: "sports_soccer", name: "كرة قدم" }, { id: "sports_tennis", name: "تنس" },
                { id: "sports_basketball", name: "سلة" }, { id: "pool", name: "مسبح" },
                { id: "fitness_center", name: "نادي رياضي" }, { id: "pedal_bike", name: "دراجة" },
                { id: "hiking", name: "تنزه" }, { id: "kitesurfing", name: "تزلج شراعي" }
            ],
            "الأماكن": [
                { id: "home", name: "منزل" }, { id: "work", name: "عمل" },
                { id: "school", name: "مدرسة" }, { id: "restaurant", name: "مطعم" },
                { id: "local_cafe", name: "مقهى" }, { id: "shopping_cart", name: "تسوق" },
                { id: "local_hospital", name: "مستشفى" }, { id: "mosque", name: "مسجد" }
            ],
            "النقل": [
                { id: "directions_car", name: "سيارة" }, { id: "directions_bus", name: "حافلة" },
                { id: "local_parking", name: "مواقف" }, { id: "flight", name: "طيران" },
                { id: "local_gas_station", name: "محطة وقود" }, { id: "train", name: "قطار" }
            ],
            "الأزمات": [
                { id: "report_problem", name: "تنبيه" }, { id: "local_police", name: "شرطة" },
                { id: "local_fire_department", name: "اطفاء" }, { id: "security", name: "أمن" },
                { id: "medical_services", name: "إسعاف" }, { id: "warning", name: "تحذير" }
            ],
            "الطقس": [
                { id: "wb_sunny", name: "مشمس" }, { id: "cloud", name: "غائم" },
                { id: "thunderstorm", name: "عاصفة" }, { id: "ac_unit", name: "ثلج" },
                { id: "water_drop", name: "مطر" }
            ],
             "الحيوانات": [
                { id: "pets", name: "حيوانات" }, { id: "bug_report", name: "حشرات" }
            ]
        };

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            this.editMode = MAP.editMode;
            this.onMapReady();
        });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        if (!this.shareMode && this.items.length === 0) {
            this.waitForGmpMarkersAndLoad();
        }

        this.map.addListener("click", e => {
            if (!MAP.modeAdd || this.shareMode) return;
            
            for (const item of this.items) {
                const distance = google.maps.geometry.spherical.computeDistanceBetween(e.latLng, item.marker.position);
                const hitRadius = item.iconType === 'circle' ? (item.radius || 20) : 10; 
                if (distance < hitRadius) { 
                    this.openCard(item, false);
                    return; 
                }
            }

            this.addItem({ 
                id: "d" + Date.now() + Math.random(), 
                lat: e.latLng.lat(), 
                lng: e.latLng.lng(), 
                radius: 20, 
                color: "#0288D1", 
                fillOpacity: 0.3, 
                recipients: [], 
                name: "نقطة جديدة",
                iconType: "place", // الافتراضي
                markerStyle: "pin" 
            });

            MAP.modeAdd = false; 
            UI.showDefaultUI(); 
            bus.emit("persist"); 
            bus.emit("toast", "تمت إضافة موقع جديد");
        });
    }

    waitForGmpMarkersAndLoad() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            this.loadDefaultLocations();
        } else {
            setTimeout(() => this.waitForGmpMarkersAndLoad(), 100);
        }
    }

    loadDefaultLocations() { 
        const LOCS = [
            { name: "مواقف نسما", lat: 24.738275, lng: 46.574004, iconType: 'local_parking', color: '#0288D1' },
            { name: "نقطة أمنية", lat: 24.736501, lng: 46.576545, iconType: 'circle', color: '#E53935' }
        ]; 
        LOCS.forEach(loc => this.addItem({ 
            id: "d" + Date.now() + Math.random(), 
            name: loc.name, 
            lat: loc.lat, 
            lng: loc.lng, 
            radius: 22, 
            color: loc.color || "#0288D1", 
            fillOpacity: 0.3, 
            recipients: [],
            iconType: loc.iconType,
        })); 
    }
    
    addItem(data) {
        // تحديد نوع الشكل بناء على الأيقونة
        const isCircleMode = data.iconType === 'circle';

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: this.buildMarkerContent(data),
            gmpDraggable: this.editMode && !this.shareMode && !isCircleMode, // الدائرة لا تسحب من المركز
            title: data.name
        });

        // الدائرة تُرسم دائماً ولكن تظهر فقط إذا كان الوضع دائرة أو نصف القطر > 0 ومطلوب
        const circle = new google.maps.Circle({
            center: { lat: data.lat, lng: data.lng },
            map: isCircleMode ? this.map : null, // تظهر فقط في وضع الدائرة
            radius: data.radius || 20,
            strokeColor: data.color || "#0288D1",
            fillColor: data.color || "#0288D1",
            fillOpacity: data.fillOpacity || 0.3,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            zIndex: 90
        });

        const item = {
            id: data.id,
            name: data.name || "نقطة",
            color: data.color,
            radius: data.radius,
            recipients: data.recipients,
            iconType: data.iconType || 'place',
            marker,
            circle,
            fillOpacity: data.fillOpacity || 0.3
        };

        this.attachListeners(item);
        this.items.push(item);
        return item;
    }

    buildMarkerContent(data) {
        const container = document.createElement("div");

        if (data.iconType === 'circle') {
            // === وضع الدائرة: مخفي تماماً ولكن قابل للنقر ===
            // الهدف: المستخدم طلب عدم وجود "دائرة فوق دائرة".
            // نجعل الماركر شفافاً وصغيراً ليكون نقطة ارتكاز فقط
            container.style.cssText = `
                width: 20px;
                height: 20px;
                background: transparent;
                cursor: pointer;
            `;
            // لا نضيف أي محتوى داخلي
        } else {
            // === وضع الدبوس/الشكل ===
            container.className = 'custom-pin';
            container.style.position = 'relative';
            container.style.cursor = 'pointer';
            
            const color = data.color || "#0288D1";
            
            // رسم الدبوس (شكل الدمعة)
            container.innerHTML = `
                <svg width="30" height="42" viewBox="0 0 30 42" style="filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); display: block;">
                    <path fill="${color}" d="M15 0C6.7 0 0 6.7 0 15c0 10 15 27 15 27s15-17 15-27C30 6.7 23.3 0 15 0z" />
                </svg>
                <i class="material-icons" style="
                    position: absolute; 
                    top: 15px; 
                    left: 50%; 
                    transform: translate(-50%, -50%); 
                    font-size: 18px; 
                    color: white;
                    pointer-events: none;
                ">${data.iconType}</i>
            `;
            // نقطة الارتكاز في الأسفل
            container.style.transform = 'translate(0, -100%)';
        }

        return container;
    }

    attachListeners(item) {
        // تحديث الدائرة عند سحب الماركر (فقط للدبابيس)
        item.marker.addListener("drag", () => {
            if (item.circle) item.circle.setCenter(item.marker.position);
        });
        item.marker.addListener("dragend", () => bus.emit("persist"));
        
        // أحداث النقر
        item.marker.addListener("click", () => this.openCard(item, false));
        
        // أحداث الدائرة (لأن الماركر مخفي في وضع الدائرة)
        if (item.circle) {
            item.circle.addListener("click", () => this.openCard(item, false));
        }
    }

    // --- نافذة اختيار الرموز (Modal) ---
    openIconPicker(item) {
        // إنشاء الخلفية (Overlay)
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 2000;
            display: flex; justify-content: center; align-items: center;
            font-family: 'Roboto', 'Cairo', sans-serif;
        `;

        // إنشاء النافذة (Dialog)
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white; width: 700px; max-width: 95vw; height: 500px; max-height: 90vh;
            border-radius: 2px; box-shadow: 0 4px 24px rgba(0,0,0,0.3);
            display: flex; flex-direction: column; overflow: hidden;
            direction: rtl;
        `;

        // الرأس
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 24px; border-bottom: 1px solid #eee;
            display: flex; justify-content: space-between; align-items: center;
        `;
        header.innerHTML = `<h2 style="margin:0; font-size: 16px; font-weight: 500;">اختيار رمز</h2>`;
        const closeIcon = document.createElement('span');
        closeIcon.innerHTML = '&times;';
        closeIcon.style.cssText = 'font-size: 24px; cursor: pointer; color: #888;';
        closeIcon.onclick = () => document.body.removeChild(overlay);
        header.appendChild(closeIcon);

        // المحتوى (فلاتر + أيقونات)
        const content = document.createElement('div');
        content.style.cssText = `flex: 1; padding: 20px 24px; overflow-y: auto;`;

        // شريط الفلتر والروابط
        const filterBar = document.createElement('div');
        filterBar.style.cssText = `display: flex; align-items: center; margin-bottom: 20px; gap: 15px; flex-wrap: wrap;`;
        
        // مربع البحث
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'الفلتر:';
        searchInput.style.cssText = `border: 1px solid #ccc; padding: 4px 8px; width: 100px; font-size: 12px;`;
        filterBar.appendChild(searchInput);

        // روابط التصنيفات
        const catsContainer = document.createElement('div');
        catsContainer.style.cssText = `display: flex; gap: 10px; font-size: 13px; color: #3367D6; cursor: pointer; user-select: none; flex-wrap: wrap;`;
        Object.keys(this.iconLibrary).forEach(cat => {
            const span = document.createElement('span');
            span.textContent = cat;
            span.onclick = () => {
                document.getElementById(`cat-${cat}`).scrollIntoView({behavior: 'smooth'});
            };
            catsContainer.appendChild(span);
        });
        filterBar.appendChild(catsContainer);
        content.appendChild(filterBar);

        // منطقة الأيقونات
        const iconsArea = document.createElement('div');
        
        // دالة لرسم التصنيفات
        const renderIcons = (filterText = '') => {
            iconsArea.innerHTML = '';
            for (const [catName, icons] of Object.entries(this.iconLibrary)) {
                // تصفية
                const filteredIcons = icons.filter(i => i.name.includes(filterText) || catName.includes(filterText));
                if (filteredIcons.length === 0) continue;

                const catHeader = document.createElement('h3');
                catHeader.id = `cat-${catName}`;
                catHeader.textContent = catName;
                catHeader.style.cssText = `font-size: 14px; margin: 20px 0 10px 0; color: #000; font-weight: bold;`;
                iconsArea.appendChild(catHeader);

                const grid = document.createElement('div');
                grid.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px;`;

                filteredIcons.forEach(iconData => {
                    const iconBtn = document.createElement('div');
                    // تصميم زر الأيقونة الدائري كما في الصورة
                    iconBtn.style.cssText = `
                        width: 30px; height: 30px; border-radius: 50%;
                        background: ${item.iconType === iconData.id ? '#ddd' : '#666'};
                        display: flex; justify-content: center; align-items: center;
                        cursor: pointer; transition: background 0.2s;
                    `;
                    
                    if (iconData.id === 'circle' || iconData.id === 'square' || iconData.id === 'diamond' || iconData.id === 'star' || iconData.id === 'place') {
                        // للأشكال الخاصة (نستخدم Material Icons لبعضها أو نص)
                        let iconSymbol = '';
                        if (iconData.id === 'circle') iconSymbol = 'circle';
                        else if (iconData.id === 'square') iconSymbol = 'square';
                        else if (iconData.id === 'star') iconSymbol = 'star';
                        else if (iconData.id === 'diamond') iconSymbol = 'diamond';
                        else if (iconData.id === 'place') iconSymbol = 'place';
                        
                        iconBtn.innerHTML = `<i class="material-icons" style="font-size: 18px; color: white;">${iconSymbol}</i>`;
                    } else {
                        iconBtn.innerHTML = `<i class="material-icons" style="font-size: 18px; color: white;">${iconData.id}</i>`;
                    }

                    iconBtn.title = iconData.name;
                    iconBtn.onmouseover = () => iconBtn.style.backgroundColor = '#333';
                    iconBtn.onmouseout = () => iconBtn.style.backgroundColor = (item.iconType === iconData.id ? '#ddd' : '#666');
                    
                    iconBtn.onclick = () => {
                        // تحديث الموقع وإغلاق النافذة
                        this.updateIcon(item, iconData.id);
                        document.body.removeChild(overlay);
                    };

                    grid.appendChild(iconBtn);
                });
                iconsArea.appendChild(grid);
            }
        };

        renderIcons();
        content.appendChild(iconsArea);

        // البحث
        searchInput.addEventListener('input', (e) => {
            renderIcons(e.target.value);
        });

        // الفوتر
        const footer = document.createElement('div');
        footer.style.cssText = `padding: 12px 24px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;`;
        footer.innerHTML = `
            <button style="background: white; border: 1px solid #ddd; padding: 6px 12px; border-radius: 2px; cursor: pointer;">رمز مخصص</button>
            <button id="modal-ok" style="background: #4d90fe; color: white; border: 1px solid #3079ed; padding: 6px 18px; border-radius: 2px; font-weight: bold; cursor: pointer;">حسنًا</button>
        `;
        
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        document.getElementById('modal-ok').onclick = () => document.body.removeChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    }

    // دالة مساعدة لتحديث الأيقونة والماركر
    updateIcon(item, newIconType) {
        item.iconType = newIconType;
        
        // التحقق مما إذا كان دائرة
        const isCircle = (newIconType === 'circle');

        if (isCircle) {
            item.marker.gmpDraggable = false; // لا يمكن سحب الدائرة من المركز
            item.circle.setMap(this.map); // إظهار الدائرة
        } else {
            item.marker.gmpDraggable = this.editMode && !this.shareMode;
            item.circle.setMap(null); // إخفاء الدائرة (لأننا في وضع دبوس)
        }

        // تحديث المحتوى
        item.marker.content = this.buildMarkerContent(item);
        
        // تحديث البطاقة المفتوحة إذا وجدت
        this.openCard(item, false); // إعادة فتح البطاقة لتحديث شكل الأيقونة فيها
        bus.emit("persist");
    }

    openCard(item, hoverOnly = false) {
        const name = Utils.escapeHTML(item.name);
        const recipientsHtml = item.recipients.map(r => Utils.escapeHTML(r)).join('<br>');
        const isEditable = !hoverOnly && MAP.editMode;
        
        // نمط البطاقة (أبيض - Google My Maps)
        const cardStyle = `
            font-family: 'Roboto', 'Cairo', sans-serif;
            background: #ffffff;
            border-radius: 2px; /* زوايا حادة قليلاً مثل جوجل */
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            width: 360px;
            max-width: 90vw;
            display: flex; flex-direction: column;
            overflow: hidden;
            direction: rtl;
        `;

        const headerStyle = `
            padding: 15px; 
            background: #fff; 
            display: flex; justify-content: space-between; align-items: flex-start;
        `;

        const bodyStyle = `padding: 0 15px 15px 15px; flex: 1; overflow-y: auto; max-height: 60vh;`;
        
        const footerStyle = `
            padding: 10px 15px; background: #f5f5f5; border-top: 1px solid #ebebeb;
            display: flex; justify-content: flex-end; gap: 8px;
        `;

        const inputStyle = `
            width: 100%; border: none; border-bottom: 1px solid #ddd; 
            padding: 5px 0; outline: none; font-family: 'Cairo', sans-serif; font-size: 14px;
            margin-bottom: 15px; transition: 0.2s;
        `;
        const inputFocus = `onfocus="this.style.borderBottom='2px solid #4d90fe'" onblur="this.style.borderBottom='1px solid #ddd'"`;

        // إنشاء محتوى شبكة الألوان (Color Grid)
        let colorGridHtml = '';
        if (isEditable) {
            colorGridHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 15px;">`;
            this.colors.forEach(clr => {
                const isSelected = (item.color.toLowerCase() === clr.toLowerCase());
                colorGridHtml += `
                    <div class="color-swatch" data-color="${clr}" style="
                        width: 18px; height: 18px; background: ${clr}; cursor: pointer;
                        border: 2px solid ${isSelected ? '#000' : 'transparent'};
                        border-radius: 2px;
                    " onclick="document.dispatchEvent(new CustomEvent('color-pick', {detail: '${clr}'}))"></div>
                `;
            });
            colorGridHtml += `</div>`;
        }

        // الجسم
        let bodyContent = '';
        if (isEditable) {
            bodyContent = `
                <div style="margin-bottom: 10px; display: flex; align-items: flex-end; gap: 10px;">
                    <!-- زر الأيقونة الحالي -->
                    <div id="btn-icon-picker" style="
                        width: 32px; height: 32px; background: ${item.color}; 
                        display: flex; justify-content: center; align-items: center; cursor: pointer;
                        border-top-right-radius: 4px; border-top-left-radius: 4px; border-bottom-left-radius: 4px; /* شكل الدبوس تقريباً */
                    ">
                        <i class="material-icons" style="color: white; font-size: 18px;">${item.iconType === 'circle' ? 'circle' : item.iconType}</i>
                    </div>
                    <div style="flex: 1;">
                        <input id="loc-name" type="text" value="${name}" style="${inputStyle} font-weight: bold; font-size: 16px;" ${inputFocus}>
                    </div>
                </div>

                <!-- شبكة الألوان -->
                ${colorGridHtml}

                <label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px;">الوصف</label>
                <textarea id="loc-rec" style="${inputStyle} min-height: 60px; resize: vertical; border: 1px solid #ddd; padding: 5px;">${item.recipients.join('\n')}</textarea>
                
                ${item.iconType === 'circle' ? `
                    <div style="margin-top: 10px;">
                         <label style="font-size: 12px; color: #666;">نصف القطر (متر)</label>
                         <input id="loc-radius" type="number" value="${item.radius}" style="width: 80px; padding: 4px; border: 1px solid #ddd;">
                    </div>
                ` : ''}
            `;
        } else {
            bodyContent = `
                <div style="font-size: 14px; color: #333; line-height: 1.5;">
                    ${recipientsHtml || 'لا يوجد وصف.'}
                </div>
            `;
        }

        // الفوتر
        let footerContent = '';
        if (isEditable) {
            footerContent = `
                <div style="${footerStyle}">
                     <i id="loc-delete" class="material-icons" style="color: #666; cursor: pointer; margin-left: auto; font-size: 20px;">delete</i>
                     <button id="loc-save" style="background: #4d90fe; color: white; border: none; padding: 6px 16px; border-radius: 2px; font-weight: bold; cursor: pointer;">حفظ</button>
                </div>
            `;
        }

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-size: 16px; font-weight: bold;">${isEditable ? 'تعديل' : name}</h3>
                <i id="loc-close-x" class="material-icons" style="cursor: pointer; color: #888; font-size: 18px;">close</i>
            </div>
            <div style="${bodyStyle}">
                ${bodyContent}
            </div>
            ${footerContent}
        </div>`;

        UI.openSharedInfoCard(html, item.marker.position, !hoverOnly);

        // ربط الأحداث
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => {
            const closeX = document.getElementById("loc-close-x");
            if (closeX) closeX.addEventListener("click", () => UI.forceCloseSharedInfoCard());

            if (!isEditable) return;

            // زر فتح نافذة الرموز
            const pickerBtn = document.getElementById("btn-icon-picker");
            if (pickerBtn) pickerBtn.addEventListener("click", () => this.openIconPicker(item));

            // أزرار الحفظ والحذف
            const saveBtn = document.getElementById("loc-save");
            const delBtn = document.getElementById("loc-delete");
            const nameEl = document.getElementById("loc-name");
            const recEl = document.getElementById("loc-rec");
            const radEl = document.getElementById("loc-radius");

            // حدث اختيار اللون
            document.addEventListener('color-pick', (e) => {
                const newColor = e.detail;
                item.color = newColor;
                // تحديث المعاينة الفورية
                pickerBtn.style.backgroundColor = newColor;
                // تحديث العناصر على الخريطة فوراً
                if (item.circle) {
                    item.circle.setOptions({ fillColor: newColor, strokeColor: newColor });
                }
                const svgPath = item.marker.content.querySelector('path');
                if (svgPath) svgPath.setAttribute('fill', newColor);
            }, { once: false }); // نسمح بتكرار الحدث

            if (saveBtn) {
                saveBtn.addEventListener("click", () => {
                    item.name = nameEl.value.trim();
                    item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean);
                    if (radEl) item.radius = Utils.clamp(+radEl.value, 5, 5000);

                    // تحديث نهائي
                    if (item.iconType === 'circle') {
                        item.circle.setRadius(item.radius);
                    }
                    item.marker.content = this.buildMarkerContent(item);
                    item.marker.title = item.name;

                    bus.emit("persist");
                    UI.forceCloseSharedInfoCard();
                    bus.emit("toast", "تم الحفظ");
                });
            }

            if (delBtn) {
                delBtn.addEventListener("click", () => {
                    if (!confirm("حذف الموقع؟")) return;
                    item.marker.map = null;
                    item.circle.setMap(null);
                    this.items = this.items.filter(x => x.id !== item.id);
                    UI.forceCloseSharedInfoCard();
                    bus.emit("persist");
                });
            }
        });
    }

    exportState() {
        return this.items.map(it => ({
            id: it.id,
            name: it.name,
            lat: typeof it.marker.position.lat === 'function' ? it.marker.position.lat() : it.marker.position.lat,
            lng: it.marker.position.lng,
            color: it.color,
            radius: it.radius,
            fillOpacity: it.fillOpacity,
            iconType: it.iconType,
            recipients: it.recipients
        }));
    }

    applyState(state) {
        if (!state || !state.locations) return;
        this.items.forEach(it => {
            it.marker.map = null;
            it.circle.setMap(null);
        });
        this.items = [];
        state.locations.forEach(loc => this.addItem(loc));
    }
}

const LOCATIONS = new LocationManager();

/* ============================================================
   RouteManager — إدارة المسارات (تصميم Material)
   ============================================================ */
class RouteManager {

    constructor() {
        this.routes = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        this.directionsService = null;
        this.activeRouteIndex = -1;

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;
            this.editMode = MAP.editMode;
            this.onMapReady();
        });

        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        this.map.addListener("click", e => {
            if (!MAP.modeRouteAdd || this.shareMode) return;
            if (this.activeRouteIndex === -1) this.createNewRoute();
            this.addPointToRoute(this.activeRouteIndex, e.latLng);
        });
    }

    startNewRouteSequence() { this.activeRouteIndex = -1; }
    finishCurrentRoute() {
        if (this.activeRouteIndex === -1) return;
        const rt = this.routes[this.activeRouteIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => s.map = null);
        if (rt.points.length >= 2) {
            this.renderRoute(this.activeRouteIndex);
            bus.emit("persist");
        } else {
            this.routes.pop();
        }
        this.activeRouteIndex = -1;
        MAP.modeRouteAdd = false;
        MAP.setCursor("grab");
    }

    createNewRoute() {
        const route = { id: "rt" + Date.now(), points: [], color: "#3344ff", weight: 6, opacity: 0.95, distance: 0, duration: 0, overview: null, poly: null, stops: [], notes: "" };
        this.routes.push(route);
        this.activeRouteIndex = this.routes.length - 1;
        return route;
    }

    addPointToRoute(routeIndex, latLng) {
        const rt = this.routes[routeIndex];
        rt.points.push(latLng);
        const stop = this.createStopMarker(latLng, routeIndex, rt.points.length - 1);
        rt.stops.push(stop);
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else bus.emit("persist");
    }

    createStopMarker(pos, routeIndex, idx) {
        const rt = this.routes[routeIndex];
        const el = document.createElement("div");
        el.style.cssText = `width:20px; height:20px; background:white; border-radius:50%; border:2px solid ${rt.color}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; z-index:101; color:#333; box-shadow: 0 1px 3px rgba(0,0,0,0.3);`;
        el.textContent = idx + 1;
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: pos, map: this.map, content: el, gmpDraggable: !this.shareMode });
        marker.addListener("dragend", () => { rt.points[idx] = marker.position; this.requestRoute(routeIndex); bus.emit("persist"); });
        marker.addListener("contextmenu", () => { if (this.shareMode) return; this.removePoint(routeIndex, idx); });
        return marker;
    }

    removePoint(routeIndex, idx) {
        const rt = this.routes[routeIndex];
        if (rt.stops[idx]) rt.stops[idx].map = null;
        rt.points.splice(idx, 1); rt.stops.splice(idx, 1);
        rt.stops.forEach((m, i) => { m.content.textContent = i + 1; });
        if (rt.points.length >= 2) this.requestRoute(routeIndex);
        else this.clearRoute(routeIndex);
        bus.emit("persist");
    }

    removeRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => s.map = null);
        this.routes.splice(routeIndex, 1);
        this.activeRouteIndex = -1;
        UI.forceCloseSharedInfoCard();
        bus.emit("persist");
    }

    clearRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.poly = null; rt.overview = null;
        rt.distance = 0; rt.duration = 0;
    }

    requestRoute(routeIndex) {
        if (!this.directionsService) this.directionsService = new google.maps.DirectionsService();
        const rt = this.routes[routeIndex]; const pts = rt.points;
        if (pts.length < 2) return;
        const req = { origin: pts[0], destination: pts[pts.length - 1], travelMode: google.maps.TravelMode.DRIVING };
        if (pts.length > 2) req.waypoints = pts.slice(1, -1).map(p => ({ location: p, stopover: true }));
        this.directionsService.route(req, (res, status) => {
            if (status !== "OK") { bus.emit("toast", "تعذر حساب المسار"); return; }
            const r = res.routes[0]; rt.overview = r.overview_polyline;
            rt.distance = r.legs.reduce((s, l) => s + l.distance.value, 0);
            rt.duration = r.legs.reduce((s, l) => s + l.duration.value, 0);
            this.renderRoute(routeIndex);
            bus.emit("persist");
        });
    }

    renderRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        const path = rt.overview ? google.maps.geometry.encoding.decodePath(rt.overview) : rt.points;
        rt.poly = new google.maps.Polyline({ map: this.map, path, strokeColor: rt.color, strokeWeight: rt.weight, strokeOpacity: rt.opacity, zIndex: 10 });
        
        rt.poly.addListener("mouseover", (e) => { 
            if (!UI.infoWindowPinned) this.openRouteCard(routeIndex, true, e.latLng); 
        });
        rt.poly.addListener("mouseout", () => { UI.closeSharedInfoCard(); });
        rt.poly.addListener("click", (e) => this.openRouteCard(routeIndex, false, e.latLng));
    }

    openRouteCard(routeIndex, hoverOnly = false, position = null) {
        const rt = this.routes[routeIndex];
        const dist = Utils.formatDistance(rt.distance);
        const dur = Utils.formatDuration(rt.duration);
        const notes = Utils.escapeHTML(rt.notes || "");
        const isEditable = !hoverOnly && MAP.editMode;

        const cardStyle = `
            font-family: 'Roboto', 'Cairo', sans-serif;
            background: #ffffff;
            border-radius: 2px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            width: 320px;
            max-width: 90vw;
            display: flex; flex-direction: column;
            direction: rtl;
        `;
        const headerStyle = `padding: 12px 15px; background: #fff; border-bottom: 1px solid #eee; display:flex; justify-content:space-between;`;
        const bodyStyle = `padding: 15px;`;
        const footerStyle = `padding: 10px 15px; background: #f5f5f5; border-top: 1px solid #eee; display: flex; justify-content: flex-end;`;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-size: 15px; font-weight: bold;">مسار ${routeIndex + 1}</h3>
                <i id="route-close-x" class="material-icons" style="cursor:pointer; color:#888;">close</i>
            </div>
            <div style="${bodyStyle}">
                <div style="font-size: 13px; color: #555; margin-bottom: 10px;">
                    ${dist} - ${dur}
                </div>
                ${isEditable ? `
                    <textarea id="route-notes" style="width:100%; border:1px solid #ddd; padding:5px; height:50px; resize:none;" placeholder="ملاحظات...">${notes}</textarea>
                ` : `
                    <div style="font-size:13px;">${notes || 'لا توجد ملاحظات'}</div>
                `}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <button id="route-delete" style="color:#666; background:none; border:none; cursor:pointer; margin-left:auto;">حذف</button>
                    <button id="route-save" style="background:#4d90fe; color:white; border:none; padding:5px 15px; cursor:pointer;">حفظ</button>
                </div>
            ` : ''}
        </div>`;

        const cardPos = position || this.getRouteCenter(rt);
        UI.openSharedInfoCard(html, cardPos, !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachRouteCardEvents(routeIndex, hoverOnly));
    }

    getRouteCenter(rt) {
        const path = rt.poly.getPath();
        const bounds = new google.maps.LatLngBounds();
        for (let i = 0; i < path.getLength(); i++) { bounds.extend(path.getAt(i)); }
        return bounds.getCenter();
    }

    attachRouteCardEvents(routeIndex, hoverOnly) {
        if (hoverOnly || !MAP.editMode) return;
        
        const closeX = document.getElementById("route-close-x");
        if(closeX) closeX.addEventListener("click", () => UI.forceCloseSharedInfoCard());

        const rt = this.routes[routeIndex];
        const saveBtn = document.getElementById("route-save"); 
        const delBtn = document.getElementById("route-delete"); 
        const notesEl = document.getElementById("route-notes");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                rt.notes = notesEl.value.trim();
                bus.emit("persist"); UI.forceCloseSharedInfoCard();
            });
        }
        if (delBtn) { delBtn.addEventListener("click", () => { if (!confirm(`حذف المسار ${routeIndex + 1}؟`)) return; this.removeRoute(routeIndex); bus.emit("toast", "تم حذف المسار"); }); }
    }
   
    exportState() {
        return this.routes.map(rt => ({
            id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes,
            points: rt.points.map(p => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng }))
        }));
    }

    applyState(state) {
        if (!state || !state.routes) return;
        this.routes.forEach(rt => { if (rt.poly) rt.poly.setMap(null); rt.stops.forEach(s => s.map = null); });
        this.routes = [];
        state.routes.forEach(rt => {
            const newRoute = { id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes || "", points: rt.points.map(p => new google.maps.LatLng(p.lat, p.lng)), poly: null, stops: [] };
            this.routes.push(newRoute);
            newRoute.points.forEach((pt, i) => { const stop = this.createStopMarker(pt, this.routes.length - 1, i); newRoute.stops.push(stop); });
            this.renderRoute(this.routes.length - 1);
        });
    }
}

const ROUTES = new RouteManager();

/* ============================================================
   PolygonManager — إدارة المضلعات (تصميم Material)
   ============================================================ */
class PolygonManager {
    constructor() {
        this.polygons = []; this.map = null; this.shareMode = false; this.editMode = true; this.activePolygonIndex = -1; this.isEditing = false; this.editingPolygonIndex = -1;
        bus.on("map:ready", map => { this.map = map; this.shareMode = MAP.shareMode; this.editMode = MAP.editMode; this.onMapReady(); });
        bus.on("state:load", st => this.applyState(st)); bus.on("state:save", () => this.exportState());
    }
    onMapReady() { this.map.addListener("click", e => { if (!MAP.modePolygonAdd || this.shareMode) return; if (this.activePolygonIndex === -1) this.createNewPolygon(); this.addPointToPolygon(this.activePolygonIndex, e.latLng); }); }
    startPolygonSequence() { this.activePolygonIndex = -1; }
    finishCurrentPolygon() {
        if (this.activePolygonIndex === -1) return;
        const poly = this.polygons[this.activePolygonIndex];
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.markers.forEach(m => m.map = null);
        if (poly.points.length >= 3) {
            poly.polygon = new google.maps.Polygon({ paths: poly.points, map: this.map, strokeColor: poly.color, strokeOpacity: poly.strokeOpacity, strokeWeight: poly.strokeWeight, fillColor: poly.color, fillOpacity: poly.fillOpacity, zIndex: 5, clickable: true });
            this.addPolygonEditListeners(poly, this.activePolygonIndex);
            bus.emit("persist");
        } else { this.polygons.pop(); }
        this.activePolygonIndex = -1;
    }
    createNewPolygon() {
        const polygon = { id: "poly" + Date.now(), name: "مضلع جديد", notes: "", points: [], color: "#ff9800", strokeWeight: 2, strokeOpacity: 0.8, fillOpacity: 0.35, polygon: null, markers: [], activePolyline: null, vertexMarkers: [] };
        this.polygons.push(polygon);
        this.activePolygonIndex = this.polygons.length - 1;
        return polygon;
    }
    addPointToPolygon(polyIndex, latLng) {
        const poly = this.polygons[polyIndex];
        poly.points.push(latLng);
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: latLng, map: this.map, content: this.buildVertexMarkerContent(poly.color) });
        poly.markers.push(marker);
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.activePolyline = new google.maps.Polyline({ path: poly.points, map: this.map, strokeColor: poly.color, strokeOpacity: 0.6, strokeWeight: 2, zIndex: 10 });
    }
    buildVertexMarkerContent(color) { const el = document.createElement("div"); el.style.width = "10px"; el.style.height = "10px"; el.style.borderRadius = "50%"; el.style.background = "white"; el.style.border = `2px solid ${color}`; el.style.cursor = 'pointer'; return el; }
    addPolygonEditListeners(poly, index) {
        poly.polygon.addListener("click", (e) => {
            if (this.editingPolygonIndex === index) { this.insertVertex(poly, index, e.latLng); }
            else { this.openCard(this.polygons.indexOf(poly), false); }
        });
    }
    enterEditMode(index) {
        this.exitEditMode();
        const poly = this.polygons[index];
        this.isEditing = true; this.editingPolygonIndex = index;
        poly.points.forEach((point, i) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({ position: point, map: this.map, gmpDraggable: true, content: this.buildVertexMarkerContent(poly.color), title: `Vertex ${i + 1}` });
            poly.vertexMarkers.push(marker);
            marker.addListener("drag", (e) => { poly.points[i] = e.latLng; poly.polygon.setPaths(poly.points); });
            marker.addListener("dragend", () => { bus.emit("persist"); });
            marker.addListener("contextmenu", () => { if (confirm(`حذف هذه النقطة؟`)) { this.deleteVertex(poly, index, i); } });
        });
        UI.showPolygonEditingUI();
        bus.emit("toast", "وضع التحرير مفعل. اسحب النقاط لتعديل الشكل.");
    }
    exitEditMode() {
        if (!this.isEditing) return;
        const poly = this.polygons[this.editingPolygonIndex];
        poly.vertexMarkers.forEach(m => m.map = null);
        poly.vertexMarkers = [];
        this.isEditing = false; this.editingPolygonIndex = -1;
        UI.showDefaultUI();
        bus.emit("toast", "تم الخروج من وضع تحرير المضلع");
    }
    insertVertex(poly, index, latLng) { /* ... (لا تغيير هنا) ... */ }
    deleteVertex(poly, index, vertexIndex) { /* ... (لا تغيير هنا) ... */ }

    openCard(polyIndex, hoverOnly = false) {
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        const isEditable = !hoverOnly && MAP.editMode && !isEditingShape;
        const notes = Utils.escapeHTML(poly.notes || "");
        const area = google.maps.geometry.spherical.computeArea(poly.points);
        const areaText = Utils.formatArea(area);

        const cardStyle = `
            font-family: 'Roboto', 'Cairo', sans-serif;
            background: #ffffff;
            border-radius: 2px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            width: 350px;
            max-width: 90vw;
            display: flex; flex-direction: column;
            direction: rtl;
        `;
        const headerStyle = `padding: 12px 15px; background: #fff; border-bottom: 1px solid #eee; display:flex; justify-content:space-between;`;
        const bodyStyle = `padding: 15px;`;
        const footerStyle = `padding: 10px 15px; background: #f5f5f5; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 8px;`;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-size: 15px; font-weight: bold;">${Utils.escapeHTML(poly.name)}</h3>
                <i id="poly-close-x" class="material-icons" style="cursor:pointer; color:#888;">close</i>
            </div>
            <div style="${bodyStyle}">
                <div style="font-size:13px; margin-bottom:10px;"><b>المساحة:</b> ${areaText}</div>
                ${isEditingShape ? `<p style="margin: 0; color: #aaa; text-align:center;">اسحب النقاط لتعديل الشكل.</p>` : (isEditable ? `
                    <textarea id="poly-notes" style="width:100%; height:60px; border:1px solid #ddd; padding:5px; resize:none;" placeholder="ملاحظات">${notes}</textarea>
                ` : `
                    <div style="font-size:13px;">${notes || 'لا توجد ملاحظات'}</div>
                `)
                }
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <button id="poly-edit-shape" style="background:white; border:1px solid #ccc; padding:5px 10px; cursor:pointer;">تعديل الشكل</button>
                    <button id="poly-delete" style="color:#666; background:none; border:none; cursor:pointer;">حذف</button>
                    <button id="poly-save" style="background:#4d90fe; color:white; border:none; padding:5px 15px; cursor:pointer;">حفظ</button>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, this.getPolygonCenter(poly), !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachCardEvents(polyIndex, hoverOnly));
    }

    getPolygonCenter(poly) { const bounds = new google.maps.LatLngBounds(); poly.points.forEach(pt => bounds.extend(pt)); return bounds.getCenter(); }

    attachCardEvents(polyIndex, hoverOnly) {
        const closeX = document.getElementById("poly-close-x");
        if(closeX) closeX.addEventListener("click", () => UI.forceCloseSharedInfoCard());

        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        if (isEditingShape) { const stopEditBtn = document.getElementById("poly-stop-edit"); if (stopEditBtn) stopEditBtn.addEventListener("click", () => { this.exitEditMode(); UI.forceCloseSharedInfoCard(); }); return; }
        if (hoverOnly || !MAP.editMode) return;
        
        const saveBtn = document.getElementById("poly-save"); 
        const editShapeBtn = document.getElementById("poly-edit-shape"); 
        const delBtn = document.getElementById("poly-delete"); 
        const notesEl = document.getElementById("poly-notes");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                poly.notes = notesEl.value.trim();
                bus.emit("persist"); UI.forceCloseSharedInfoCard();
            });
        }
        if (editShapeBtn) { editShapeBtn.addEventListener("click", () => { this.enterEditMode(polyIndex); UI.forceCloseSharedInfoCard(); }); }
        if (delBtn) { delBtn.addEventListener("click", () => { if (!confirm(`حذف "${poly.name}"؟`)) return; poly.polygon.setMap(null); this.polygons = this.polygons.filter(p => p.id !== poly.id); UI.forceCloseSharedInfoCard(); bus.emit("persist"); bus.emit("toast", "تم حذف المضلع"); }); }
    }

    exportState() { return this.polygons.filter(p => p.polygon).map(poly => ({ id: poly.id, name: poly.name, notes: poly.notes, color: poly.color, strokeWeight: poly.strokeWeight, strokeOpacity: poly.strokeOpacity, fillOpacity: poly.fillOpacity, points: poly.points.map(p => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng })) })); }
    applyState(state) {
        if (!state || !state.polygons) return;
        this.polygons.forEach(p => { if (p.polygon) p.polygon.setMap(null); });
        this.polygons = [];
        state.polygons.forEach(polyData => {
            const newPoly = { id: polyData.id, name: polyData.name, notes: polyData.notes || "", color: polyData.color, strokeWeight: polyData.strokeWeight, strokeOpacity: polyData.strokeOpacity, fillOpacity: polyData.fillOpacity, points: polyData.points.map(p => new google.maps.LatLng(p.lat, p.lng)), polygon: null, markers: [], activePolyline: null, vertexMarkers: [] };
            newPoly.polygon = new google.maps.Polygon({ paths: newPoly.points, map: this.map, strokeColor: newPoly.color, strokeOpacity: newPoly.strokeOpacity, strokeWeight: newPoly.strokeWeight, fillColor: newPoly.color, fillOpacity: newPoly.fillOpacity, zIndex: 5, clickable: true });
            this.addPolygonEditListeners(newPoly, this.polygons.length);
            this.polygons.push(newPoly);
        });
    }
}

const POLYGONS = new PolygonManager();

/* ============================================================
   StateManager — إدارة حفظ واسترجاع الحالة
============================================================ */
class StateManager {

    constructor() {
        this.map = null;
        this.shareMode = false;
        this.persistTimer = null;

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;

            const stateFromUrl = this.readShare();

            if (stateFromUrl) {
                console.log("State found in URL, applying...");
                this.applyState(stateFromUrl);
            }

            if (!this.shareMode) {
                bus.on("persist", () => this.schedulePersist());
            }
        });
    }

    buildState() {
        if (!this.map) return null;

        const center = this.map.getCenter();
        return {
            v: 1,
            map: {
                c: [center.lat(), center.lng()],
                z: this.map.getZoom(),
                t: this.map.getMapTypeId(),
                traffic: MAP.trafficLayer?.getMap() ? 1 : 0
            },
            routes: ROUTES.exportState(),
            locations: LOCATIONS.exportState(),
            polygons: POLYGONS.exportState()
        };
    }

    writeShare(st) {
        try {
            const json = JSON.stringify(st);
            const encoded = Utils.b64uEncode(json);
            const base = location.origin + location.pathname;
            const url = base + "?x=" + encoded;
            history.replaceState(null, "", url);
            return url;
        } catch (e) {
            console.error("writeShare error", e);
            return location.href;
        }
    }

    schedulePersist() {
        if (this.shareMode) return;

        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            const st = this.buildState();
            if (st) this.writeShare(st);
        }, 300);
    }

    readShare() {
        try {
            const p = new URLSearchParams(location.search);
            const x = p.get("x");
            if (!x) return null;
            const json = Utils.b64uDecode(x);
            if (!json) return null;
            return JSON.parse(json);
        } catch (e) {
            console.error("State read error", e);
            return null;
        }
    }

    applyState(state) {
        if (!state) return;

        if (state.map) {
            const mapState = state.map;
            if (mapState.c && mapState.z) {
                this.map.setCenter({ lat: mapState.c[0], lng: mapState.c[1] });
                this.map.setZoom(mapState.z);
            }
            if (mapState.t) this.map.setMapTypeId(mapState.t);
            if (mapState.traffic) MAP.trafficLayer.setMap(this.map);
        }

        if (state.locations) LOCATIONS.applyState({ locations: state.locations });
        if (state.routes) ROUTES.applyState({ routes: state.routes });
        if (state.polygons) POLYGONS.applyState({ polygons: state.polygons });
    }
}

const STATE = new StateManager();


/* ============================================================
   ShareManager — نسخ آمن
============================================================ */
class ShareManager {

    constructor() {
        this.btn = document.getElementById("btn-share");
        if (this.btn) {
            this.btn.addEventListener("click", () => this.generateShareLink());
        }
    }

    async generateShareLink() {
        const st = STATE.buildState();
        if (!st) {
            bus.emit("toast", "تعذر إنشاء رابط المشاركة");
            return;
        }

        const longUrl = STATE.writeShare(st);
        const label = this.btn.querySelector(".label");
        const original = label ? label.textContent : null;

        this.btn.disabled = true;
        if (label) label.textContent = "جاري التقصير…";

        let finalUrl = longUrl;

        try {
            const api = "https://is.gd/create.php?format=json&url=" + encodeURIComponent(longUrl);
            const res = await fetch(api);
            const data = await res.json();
            if (data && data.shorturl) finalUrl = data.shorturl;
        } catch (err) {
            console.error("is.gd error", err);
        }

        try {
            await navigator.clipboard.writeText(finalUrl);
            bus.emit("toast", "تم نسخ رابط المشاركة");
        } catch (err) {
            this.showManualCopyDialog(finalUrl);
        }

        this.btn.disabled = false;
        if (label) label.textContent = original || "مشاركة";
    }

    showManualCopyDialog(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); z-index: 10000; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 90%; width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center; direction: rtl;`;
        dialog.innerHTML = `<h3 style="margin-top: 0; margin-bottom: 16px; color: #333;">انسخ الرابط يدويًا</h3><textarea readonly style="width: 100%; height: 80px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 14px; text-align: center; resize: none; direction: ltr;">${url}</textarea><button id="manual-copy-close" style="margin-top: 20px; width: 100%; padding: 12px; background-color: #4285f4; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">إغلاق</button>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.getElementById('manual-copy-close').addEventListener('click', () => { document.body.removeChild(overlay); });
    }
}

const SHARE = new ShareManager();

/* ============================================================
   MeasureManager — أداة القياس
   ============================================================ */
class MeasureManager {
    constructor() {
        this.isActive = false;
        this.points = [];
        this.polyline = null;
        this.polygon = null;
        this.infoWindow = null;
        this.map = null;
        this.mapClickListener = null;
        this.mapRightClickListener = null;
        this.mapDblClickListener = null;

        bus.on("map:ready", map => {
            this.map = map;
        });
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.clearMeasurement();
        MAP.setCursor('crosshair');
        this.attachMapListeners();
        bus.emit("toast", "وضع القياس مفعل.");
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.clearMeasurement();
        MAP.setCursor('grab');
        this.detachMapListeners();
    }

    attachMapListeners() {
        this.mapClickListener = this.map.addListener('click', (e) => this.addPoint(e.latLng));
        this.mapRightClickListener = this.map.addListener('rightclick', () => this.removeLastPoint());
        this.mapDblClickListener = this.map.addListener('dblclick', () => this.finishMeasurement());
    }

    detachMapListeners() {
        if (this.mapClickListener) google.maps.event.removeListener(this.mapClickListener);
        if (this.mapRightClickListener) google.maps.event.removeListener(this.mapRightClickListener);
        if (this.mapDblClickListener) google.maps.event.removeListener(this.mapDblClickListener);
    }

    addPoint(latLng) {
        this.points.push(latLng);
        this.redrawMeasurement();
    }

    removeLastPoint() {
        if (this.points.length > 0) {
            this.points.pop();
            this.redrawMeasurement();
        }
    }

    redrawMeasurement() {
        if (this.polyline) this.polyline.setMap(null);
        if (this.polygon) this.polygon.setMap(null);
        if (this.infoWindow) this.infoWindow.close();

        if (this.points.length === 0) return;

        let distance = 0;
        if (this.points.length > 1) {
            const path = new google.maps.MVCArray(this.points);
            distance = google.maps.geometry.spherical.computeLength(path);
        }

        let area = 0;
        if (this.points.length > 2) {
            area = google.maps.geometry.spherical.computeArea(this.points);
        }

        this.polyline = new google.maps.Polyline({
            path: this.points,
            map: this.map,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            geodesic: true,
        });

        if (this.points.length > 2) {
            this.polygon = new google.maps.Polygon({
                paths: this.points,
                map: this.map,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeOpacity: 0,
            });
        }

        const lastPoint = this.points[this.points.length - 1];
        let content = `<div style="direction: rtl; font-family: 'Cairo', sans-serif;">`;
        content += `<b>المسافة:</b> ${Utils.formatDistance(distance)}<br>`;
        if (area > 0) {
            content += `<b>المساحة:</b> ${Utils.formatArea(area)}`;
        }
        content += `</div>`;

        if (!this.infoWindow) {
            this.infoWindow = new google.maps.InfoWindow({ disableAutoPan: false });
        }
        this.infoWindow.setContent(content);
        this.infoWindow.setPosition(lastPoint);
        this.infoWindow.open(this.map);
    }

    finishMeasurement() {
        this.deactivate();
        bus.emit("toast", "تم الانتهاء من القياس");
    }

    clearMeasurement() {
        if (this.polyline) this.polyline.setMap(null);
        if (this.polygon) this.polygon.setMap(null);
        if (this.infoWindow) this.infoWindow.close();
        this.points = [];
    }
}

const MEASURE = new MeasureManager();

/* ============================================================
   UIManager — واجهة المستخدم
============================================================ */
class UIManager {

    constructor() {
        this.logo = "/img/logo.png";
        this.sharedInfoWindow = null;
        this.infoWindowPinned = false;

        this.btnLayers = document.getElementById("btn-layers");
        this.btnAdd = document.getElementById("btn-add");
        this.btnRoute = document.getElementById("btn-route");
        this.btnPolygon = document.getElementById("btn-polygon");
        this.btnMeasure = document.getElementById("btn-measure");
        this.btnDrawFinish = document.getElementById("btn-draw-finish");
        this.btnRouteClear = document.getElementById("btn-route-clear");
        this.btnEdit = document.getElementById("btn-edit");

        this.layersPanel = document.getElementById("layers-panel");
        this.btnCloseLayers = document.getElementById("btn-close-layers");

        this.modeBadge = document.getElementById("mode-badge");
        this.toastElement = document.getElementById("toast");
        this.toastTimer = null;

        bus.on("map:ready", () => this.initializeUI());
        bus.on("toast", msg => this.showToast(msg));
    }

    initializeUI() {
        if (MAP.shareMode) {
            this.applyShareMode();
        }

        const maxWidth = Math.min(window.innerWidth * 0.9, 420);
        this.sharedInfoWindow = new google.maps.InfoWindow({ maxWidth: maxWidth });

        // حقن CSS لإخفاء عناصر النافذة الافتراضية
        const style = document.createElement('style');
        style.innerHTML = `
            .gm-style-iw.gm-style-iw-c {
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                border-radius: 2px !important; /* زوايا أقل حدة */
            }
            .gm-style-iw-d {
                padding: 0 !important;
                overflow: visible !important;
                max-height: none !important;
            }
            .gm-style-iw-tc {
                display: none !important; /* إخفاء السهم */
            }
            button.gm-ui-hover-effect {
                display: none !important; /* إخفاء زر الإغلاق الافتراضي */
            }
            /* شريط تمرير أنيق */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #f1f1f1; }
            ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: #aaa; }
        `;
        document.head.appendChild(style);

        MAP.map.addListener("click", () => {
            this.closeSharedInfoCard();
        });

        if (this.btnLayers) this.btnLayers.addEventListener("click", () => this.toggleLayersPanel());
        if (this.btnCloseLayers) this.btnCloseLayers.addEventListener("click", () => this.toggleLayersPanel());

        const baseMapRadios = document.querySelectorAll('input[name="base-map"]');
        baseMapRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.setBaseMap(radio.value);
            });
        });

        const layerCheckboxes = document.querySelectorAll('#layer-traffic, #layer-bicycling, #layer-transit');
        layerCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleLayer(checkbox.id, checkbox.checked);
            });
        });

        if (this.btnEdit && !MAP.shareMode) {
            this.btnEdit.addEventListener("click", () => {
                MAP.editMode = !MAP.editMode;
                this.btnEdit.setAttribute("aria-pressed", MAP.editMode ? "true" : "false");
                this.updateModeBadge();
                if (!MAP.editMode) {
                    this.showDefaultUI();
                }
            });
        }

        if (this.btnAdd && !MAP.shareMode) {
            this.btnAdd.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('add');
            });
        }

        if (this.btnRoute && !MAP.shareMode) {
            this.btnRoute.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('route');
            });
        }

        if (this.btnPolygon && !MAP.shareMode) {
            this.btnPolygon.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('polygon');
            });
        }

        if (this.btnMeasure && !MAP.shareMode) {
            this.btnMeasure.addEventListener("click", () => {
                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");
                this.setActiveMode('measure');
            });
        }

        if (this.btnDrawFinish && !MAP.shareMode) {
            this.btnDrawFinish.addEventListener("click", () => {
                if (MAP.modeRouteAdd) {
                    ROUTES.finishCurrentRoute();
                } else if (MAP.modePolygonAdd) {
                    POLYGONS.finishCurrentPolygon();
                }
                this.showDefaultUI();
            });
        }

        if (this.btnRouteClear && !MAP.shareMode) {
            this.btnRouteClear.addEventListener("click", () => {
                if (ROUTES.activeRouteIndex === -1) return this.showToast("لا يوجد مسار نشط لحذفه");
                if (!confirm("حذف المسار الحالي؟")) return;
                ROUTES.removeRoute(ROUTES.activeRouteIndex);
                this.showDefaultUI();
                this.showToast("تم حذف المسار");
            });
        }

        this.updateModeBadge();
    }

    toggleLayersPanel() {
        if (this.layersPanel) {
            this.layersPanel.classList.toggle("show");
            const isPressed = this.layersPanel.classList.contains("show");
            this.btnLayers.setAttribute("aria-pressed", isPressed ? "true" : "false");
        }
    }

    setBaseMap(mapTypeId) {
        switch (mapTypeId) {
            case 'roadmap': MAP.setRoadmap(); break;
            case 'satellite': MAP.setSatellite(); break;
            case 'terrain': MAP.setTerrain(); break;
            case 'dark': MAP.setDarkMode(); break;
            case 'silver': MAP.setSilverMode(); break;
        }
    }

    toggleLayer(layerId, isChecked) {
        switch (layerId) {
            case 'layer-traffic': MAP.toggleTraffic(); break;
            case 'layer-bicycling': MAP.toggleBicycling(); break;
            case 'layer-transit': MAP.toggleTransit(); break;
        }
    }

    openSharedInfoCard(content, position, isPinned = false) {
        this.sharedInfoWindow.close();
        
        this.sharedInfoWindow.setContent(content);
        this.sharedInfoWindow.setPosition(position);
        
        // إزاحة بسيطة للأعلى
        this.sharedInfoWindow.setOptions({
            maxWidth: 360,
            pixelOffset: new google.maps.Size(0, -50),
            zIndex: 1000
        });
        
        this.sharedInfoWindow.open({ map: MAP.map });
        
        // تأكيد إخفاء زر الإغلاق الافتراضي
        google.maps.event.addListenerOnce(this.sharedInfoWindow, 'domready', () => {
            const closeBtn = document.querySelector('.gm-style-iw button[title="Close"]');
            if (closeBtn) closeBtn.style.display = 'none';
        });
        
        this.infoWindowPinned = isPinned;
    }
   
    closeSharedInfoCard() {
        if (this.sharedInfoWindow && !this.infoWindowPinned) {
            this.sharedInfoWindow.close();
        }
        this.infoWindowPinned = false;
    }

    forceCloseSharedInfoCard() {
        if (this.sharedInfoWindow) {
            this.sharedInfoWindow.close();
        }
        this.infoWindowPinned = false;
    }

    setActiveMode(mode) {
        if (POLYGONS.isEditing) {
            this.showToast("يرجى إنهاء تحرير المضلع الحالي أولاً");
            return;
        }

        MAP.modeAdd = false;
        MAP.modeRouteAdd = false;
        MAP.modePolygonAdd = false;
        MEASURE.deactivate();

        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        if (this.btnRoute) this.btnRoute.setAttribute("aria-pressed", "false");
        if (this.btnPolygon) this.btnPolygon.setAttribute("aria-pressed", "false");
        if (this.btnMeasure) this.btnMeasure.setAttribute("aria-pressed", "false");

        MAP.setCursor("grab");

        switch (mode) {
            case 'add':
                MAP.modeAdd = true;
                if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "true");
                MAP.setCursor("crosshair");
                this.showDefaultUI();
                this.showToast("اضغط لإضافة موقع");
                break;
            case 'route':
                ROUTES.startNewRouteSequence();
                MAP.modeRouteAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة نقاط المسار");
                break;
            case 'polygon':
                POLYGONS.startPolygonSequence();
                MAP.modePolygonAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة رؤوس المضلع");
                break;
            case 'measure':
                MEASURE.activate();
                if (this.btnMeasure) this.btnMeasure.setAttribute("aria-pressed", "true");
                this.showDefaultUI();
                break;
        }
    }

    applyShareMode() {
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
        if (this.btnRouteClear) this.btnRouteClear.style.display = "none";
        if (this.btnEdit) this.btnEdit.style.display = "none";
        if (this.btnLayers) this.btnLayers.style.display = "none";
        this.updateModeBadge("view");
    }

    showDrawFinishUI() {
        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "inline-block";
    }

    showDefaultUI() {
        if (this.btnRoute) this.btnRoute.style.display = "inline-block";
        if (this.btnPolygon) this.btnPolygon.style.display = "inline-block";
        if (this.btnMeasure) this.btnMeasure.style.display = "inline-block";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
    }

    showPolygonEditingUI() {
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnMeasure) this.btnMeasure.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
    }

    updateModeBadge(forceMode = null) {
        if (!this.modeBadge) return;
        const mode = forceMode || (MAP.editMode ? "edit" : "view");
        this.modeBadge.style.display = "block";
        this.modeBadge.textContent = (mode === "edit") ? "وضع التحرير" : "وضع العرض";
        this.modeBadge.className = "";
        this.modeBadge.classList.add("badge", mode);
    }

    showToast(message) {
        if (!this.toastElement) return;
        this.toastElement.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${this.logo}" style="width:22px;height:22px;border-radius:6px;opacity:0.9;">
                <span>${message}</span>
            </div>
        `;
        this.toastElement.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
            this.toastElement.classList.remove("show");
        }, 2600);
    }
}

const UI = new UIManager();

/* ============================================================
   BootLoader — التشغيل النهائي
============================================================ */
class BootLoader {

    constructor() {
        this.booted = false;
        this.tryBoot();
        document.addEventListener("DOMContentLoaded", () => this.tryBoot());
        window.addEventListener("load", () => this.tryBoot());
    }

    tryBoot() {
        if (this.booted) return;
        if (window.google && google.maps && document.readyState !== "loading") {
            this.booted = true;
            this.start();
        }
    }

    start() {
        console.log("System Ready");
        bus.on("map:zoom", z => bus.emit("markers:scale", z));
        bus.on("map:bounds", () => bus.emit("persist"));
        this.finish();
    }

    finish() {
        console.log("Initialization completed.");
        bus.emit("toast", "تم تحميل النظام بنجاح");
    }
}

const BOOT = new BootLoader();
