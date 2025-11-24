'use strict';

/* ============================================================
   Diriyah Security Map – v22.0 (Mobile-Safe Share System)
   • إصلاح جميع مشاكل رابط المشاركة
   • دعم هواتف iOS + Android بدون فقد بيانات
   • State آمنة 100%
   • ShareMode يعمل فعلياً
   • Glass UI كامل للمواقع والمسارات
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
   Utilities — أدوات عامة (مع دعم للجوال)
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

    /* 
     * Base64 URL-Safe encoding with compression
     */
    b64uEncode(str) {
        try {
            // 1. تحويل النص إلى بايتات (UTF-8)
            const textEncoder = new TextEncoder();
            const bytes = textEncoder.encode(str);

            // 2. ضغط البايتات باستخدام pako
            const compressed = pako.deflate(bytes);

            // 3. تحويل البايتات المضغوطة إلى نص Base64
            let bin = "";
            compressed.forEach(b => bin += String.fromCharCode(b));
            const base64 = btoa(bin);

            // 4. جعل الرابط آمنًا للاستخدام في الـ URL
            return base64
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
        } catch (e) {
            console.error("Compression/Encoding error", e);
            return "";
        }
    },

    /* 
     * Base64 URL-safe decode with decompression
     */
    b64uDecode(str) {
        try {
            if (!str) return null;

            // 1. إعادة الرابط إلى صيغة Base64 قياسية
            str = str.replace(/[^A-Za-z0-9\-_]/g, "");
            const pad = (4 - (str.length % 4)) % 4;
            str += "=".repeat(pad);
            const base64 = str.replace(/-/g, "+").replace(/_/g, "/");

            // 2. فك ترميز Base64 إلى بايتات
            const decoded = atob(base64);
            const compressedBytes = Uint8Array.from(decoded, c => c.charCodeAt(0));

            // 3. فك ضغط البايتات باستخدام pako
            const decompressedBytes = pako.inflate(compressedBytes);

            // 4. تحويل البايتات المستعادة إلى نص (UTF-8)
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

    // === هذه هي الدالة الجديدة التي يجب إضافتها ===
    formatArea(meters) {
        if (!meters) return "0 م²";
        if (meters >= 1000000) {
            return (meters / 1000000).toFixed(2) + " كم²";
        }
        // استخدام toLocaleString لتنسيق الأرقام الكبيرة (مثل 500,000)
        return Math.round(meters).toLocaleString('ar-SA') + " م²";
    }
};

/* ============================================================
   MapController — وحدة إدارة الخريطة (مع دعم الطبقات المتقدمة)
============================================================ */
class MapController {

    constructor() {
        this.map = null;
        this.trafficLayer = null;
        this.bicyclingLayer = null; // طبقة جديدة
        this.transitLayer = null;     // طبقة جديدة

        this.editMode = true;
        this.shareMode = false;

        this.centerDefault = { lat: 24.7399, lng: 46.5731 };
        this.zoomDefault = 15;

        this.modeAdd = false;
        this.modeRouteAdd = false;

        window.MapController = this;
    }

    init() {
        console.log("Boot v22.0 - Layers Update");

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
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
            { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
            { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
            { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
            { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
        ];

        const silverStyle = [
            { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
            { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
            { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
            { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
            { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
            { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
            { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
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

        // تهيئة الطبقات
        this.trafficLayer = new google.maps.TrafficLayer();
        this.bicyclingLayer = new google.maps.BicyclingLayer();
        this.transitLayer = new google.maps.TransitLayer();

        // تسجيل الأنماط المخصصة
        this.map.mapTypes.set("dark", new google.maps.StyledMapType(darkModeStyle, { name: "الوضع الليلي" }));
        this.map.mapTypes.set("silver", new google.maps.StyledMapType(silverStyle, { name: "فضي" }));

        // إضافة مستمعي الأحداث للخريطة
        this.map.addListener("zoom_changed", () => {
            bus.emit("map:zoom", this.map.getZoom());
        });

        this.map.addListener("bounds_changed", () => {
            bus.emit("map:bounds");
        });

        // *** التعديل الجديد: استدعاء دالة الانتظار بدلاً من إطلاق الحدث مباشرة ***
        this.waitForGmpMarkersAndEmit();
    }

    // *** الدالة الجديدة التي تنتظر تحميل المكتبة ***
    waitForGmpMarkersAndEmit() {
        if (typeof google.maps.marker !== 'undefined' && typeof google.maps.marker.AdvancedMarkerElement !== 'undefined') {
            // المكتبة تم تحميلها، الآن يمكننا إطلاق الحدث بأمان
            console.log("gmp-markers library is ready. Emitting 'map:ready' event.");
            bus.emit("map:ready", this.map);
        } else {
            // المكتبة لم تتحمل بعد، انتظر 100 ميلي ثانية وحاول مرة أخرى
            console.log("Waiting for gmp-markers library...");
            setTimeout(() => this.waitForGmpMarkersAndEmit(), 100);
        }
    }

    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("hybrid"); }
    setTerrain() { this.map.setMapTypeId("terrain"); } // دالة جديدة
    setDarkMode() { this.map.setMapTypeId("dark"); }   // دالة جديدة
    setSilverMode() { this.map.setMapTypeId("silver"); } // دالة جديدة

    toggleTraffic() {
        if (this.trafficLayer.getMap()) {
            this.trafficLayer.setMap(null);
        } else {
            this.trafficLayer.setMap(this.map);
        }
    }

    toggleBicycling() { // دالة جديدة
        if (this.bicyclingLayer.getMap()) {
            this.bicyclingLayer.setMap(null);
        } else {
            this.bicyclingLayer.setMap(this.map);
        }
    }

    toggleTransit() { // دالة جديدة
        if (this.transitLayer.getMap()) {
            this.transitLayer.setMap(null);
        } else {
            this.transitLayer.setMap(this.map);
        }
    }

    setCursor(c) {
        this.map.setOptions({ draggableCursor: c });
    }
}

const MAP = new MapController();

/* ============================================================
   LocationManager — المواقع + بطاقات Glass (تصميم موحد)
============================================================ */

/* ============================================================
   LocationManager — إدارة المواقع + بطاقات Glass (نسخة مُصلحة بالكامل)
   ============================================================ */
class LocationManager {

    constructor() {
        this.items = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        
        // إضافة قائمة الأيقونات المتاحة
        this.availableIcons = [
            { value: 'report_problem', label: '-' },
            { value: 'report_problem', label: 'نقطة فرز' },
            { value: 'report', label: 'تنظيم مروري' },
            { value: 'gpp_good', label: 'نقطة ثابتة' }
        ];

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
                if (distance < 5) { 
                    this.openCard(item, false);
                    return; 
                }
            }

            this.addItem({ 
                id: "d" + Date.now() + Math.random(), 
                lat: e.latLng.lat(), 
                lng: e.latLng.lng(), 
                radius: 22, 
                color: "#ff0000", 
                fillOpacity: 0.3, 
                recipients: [], 
                name: "موقع جديد"
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
            { name: "مواقف نسما", lat: 24.738275101689318, lng: 46.57400430256134, iconType: 'local_police' },
            { name: "طريق الملك فيصل", lat: 24.736501294584695, lng: 46.576545241653285, iconType: 'local_police' },
            { name: "الحبيب", lat: 24.709422313107773, lng: 46.59397105888831, iconType: 'security' },
            { name: "راس النعامة", lat: 24.71033234430099, lng: 46.57294855439484, iconType: 'local_police' },
            { name: "دوار صفار", lat: 24.724914620418065, lng: 46.573466184564616, iconType: 'traffic' },
            { name: "بيت مبارك", lat: 24.73261214957373, lng: 46.57825334260031, iconType: 'apartment' },
            { name: "غصيبة", lat: 24.74573909383749, lng: 46.56052051492614, iconType: 'local_hospital' },
            { name: "دوار الروقية", lat: 24.742007409023923, lng: 46.56268048966995, iconType: 'local_police' },
            { name: "ميدان الملك سلمان", lat: 24.736130683456725, lng: 46.584028930317025, iconType: 'directions_car' },
            { name: "المسار الرياضي المديد", lat: 24.735384906613607, lng: 46.58133312296764, iconType: 'parking' },
            { name: "نقطة الشلهوب", lat: 24.73524079555137, lng: 46.57779729574876, iconType: 'local_fire_department' },
            { name: "مواقف الأمن", lat: 24.73785440668389, lng: 46.577909186352535, iconType: 'security' },
            { name: "كار بارك", lat: 24.73829475280005, lng: 46.577901024011375, iconType: 'parking' },
            { name: "م 9", lat: 24.73889215714233, lng: 46.580699315602104, iconType: 'business' },
            { name: "دوار البلدية", lat: 24.739271712116125, lng: 46.581809386523894, iconType: 'local_police' },
            { name: "دوار الضوء الخافت", lat: 24.739746153778835, lng: 46.58352836407099, iconType: 'report_problem' },
            { name: "مسار المشاة طريق الملك خالد الفرعي", lat: 24.74079938101476, lng: 46.586711589990585, iconType: 'report' },
            { name: "بوابة سمحان", lat: 24.742132, lng: 46.569503, iconType: 'local_police' },
            { name: "منطقة سمحان", lat: 24.740913, lng: 46.571891, iconType: 'gpp_good' },
            { name: "دوار البجيري", lat: 24.737521, lng: 46.574069, iconType: 'local_police' },
            { name: "إشارة البجيري", lat: 24.737662, lng: 46.575429, iconType: 'report_problem' }
        ]; 
        LOCS.forEach(loc => this.addItem({ 
            id: "d" + Date.now() + Math.random(), 
            name: loc.name, 
            lat: loc.lat, 
            lng: loc.lng, 
            radius: 22, 
            color: "#ff0000", 
            fillOpacity: 0.3, 
            recipients: [],
            iconType: loc.iconType 
        })); 
    }
    
    addItem(data) {
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: this.buildMarkerContent(data),
            gmpDraggable: this.editMode && !this.shareMode
        });

        const circle = new google.maps.Circle({
            center: { lat: data.lat, lng: data.lng },
            map: this.map,
            radius: data.radius || 22,
            strokeColor: data.color || "#ff0000",
            fillColor: data.color || "#ff0000",
            fillOpacity: data.fillOpacity || 0.3,
            strokeOpacity: 0.9,
            strokeWeight: 2,
            zIndex: 100
        });

        const item = {
            id: data.id,
            name: data.name || "نقطة",
            color: data.color,
            radius: data.radius,
            recipients: data.recipients,
            iconType: data.iconType || 'default',
            usePin: data.usePin || false,
            showCircle: data.showCircle || true,
            marker,
            circle
        };

        this.attachListeners(item);
        this.items.push(item);
        return item;
    }

    buildMarkerContent(data) {
        let markerContent;

        if (data.usePin) {
            const iconEl = document.createElement("i");
            iconEl.className = 'material-icons';
            iconEl.textContent = this.availableIcons.find(icon => icon.value === data.iconType)?.label.split(' ')[0] || 'place';
            iconEl.style.color = 'white';
            iconEl.style.fontSize = '20px';

            markerContent = document.createElement("div");
            markerContent.style.cssText = `
                background-color: ${data.color || "#ff0000"};
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg) translate(-8px, 8px);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            `;
            markerContent.appendChild(iconEl);
        } else {
            markerContent = document.createElement("div");
            markerContent.style.cssText = `
                width: 16px;
                height: 16px;
                background-color: transparent; 
                border: none;
                cursor: pointer;
            `;
        }

        return markerContent;
    }

    attachListeners(item) {
        item.marker.addListener("drag", () => item.circle.setCenter(item.marker.position));
        item.marker.addListener("dragend", () => bus.emit("persist"));
        item.circle.addListener("mouseover", () => { if (!UI.infoWindowPinned) this.openCard(item, true); });
        item.circle.addListener("mouseout", () => { UI.closeSharedInfoCard(); });
        item.circle.addListener("click", () => this.openCard(item, false));
    }

    // *** هنا التعديل الجذري لتصميم الكرت الزجاجي ***
    openCard(item, hoverOnly = false) {
        const name = Utils.escapeHTML(item.name);
        const recipientsHtml = item.recipients.map(r => Utils.escapeHTML(r)).join('<br>');
        const isEditable = !hoverOnly && MAP.editMode;

        // --- تصميم الزجاج المحسن ---
        // لاحظ تقليل الشفافية في rgba إلى 0.65 واستخدام backdrop-filter
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.60); /* شفافية عالية لتظهر الخريطة */
            backdrop-filter: blur(12px); /* تمويه الخلفية (الخريطة) */
            -webkit-backdrop-filter: blur(12px); /* لمتصفح سفاري */
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.4); /* حدود بيضاء خفيفة */
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15); /* ظل ناعم */
            padding: 0;
            color: #333;
            direction: rtl;
            width: 340px;
            max-width: 90vw;
            overflow: hidden;
            position: relative;
        `;

        // هيدر شفاف
        const headerStyle = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px 16px; 
            background: rgba(255, 255, 255, 0.2); 
            border-bottom: 1px solid rgba(255, 255, 255, 0.3);
        `;

        const bodyStyle = `padding: 16px;`;
        
        const footerStyle = `
            padding: 12px 16px; 
            background: rgba(255, 255, 255, 0.25); 
            border-top: 1px solid rgba(255, 255, 255, 0.3);
        `;

        // زر إغلاق (X) مدمج
        const closeIconStyle = `
            cursor: pointer; 
            padding: 4px; 
            border-radius: 50%; 
            color: #666; 
            transition: 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // تنسيق الحقول لتبدو زجاجية
        const inputStyle = `
            width: 100%; 
            padding: 8px 12px; 
            border-radius: 10px; 
            border: 1px solid rgba(255, 255, 255, 0.5); 
            background: rgba(255, 255, 255, 0.4); 
            box-sizing: border-box; 
            font-family: 'Cairo', sans-serif; 
            font-size: 13px; 
            outline: none;
            color: #222;
        `;

        const labelStyle = `font-size:11px; display:block; margin-bottom:4px; font-weight: 700; color: #444;`;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <div style="display:flex; align-items:center; gap: 8px;">
                     <!-- زر الإغلاق المدمج -->
                    <div id="loc-close-x" style="${closeIconStyle}" onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="material-icons" style="font-size: 18px;">close</i>
                    </div>
                    <img src="img/logo.png" style="width: 32px; height: 32px; border-radius: 50%;">
                </div>
                <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 700;">${name}</h3>
            </div>
            
            <div style="${bodyStyle}">
                ${isEditable ? `
                    <!-- وضع التحرير -->
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">نوع الموقع:</label>
                        <select id="loc-icon-type" style="${inputStyle}">
                            ${this.availableIcons.map(icon => `<option value="${icon.value}" ${item.iconType === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
                        </select>
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">الاسم:</label>
                        <input id="loc-name" type="text" value="${name}" style="${inputStyle}">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">تفاصيل:</label>
                        <textarea id="loc-rec" style="${inputStyle} min-height:60px; resize:vertical;">${item.recipients.join('\n')}</textarea>
                    </div>
                ` : `
                    <!-- وضع العرض -->
                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <div style="flex:1;">
                             <label style="${labelStyle}">نوع الموقع:</label>
                             <div style="background: rgba(255,255,255,0.5); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight:600;">
                                ${this.availableIcons.find(icon => icon.value === item.iconType)?.label || 'مكان عام'}
                             </div>
                        </div>
                    </div>
                    <div>
                        <label style="${labelStyle}">التفاصيل:</label>
                        <div style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 12px; font-size: 13px; line-height: 1.5; min-height: 40px; border: 1px solid rgba(255,255,255,0.2);">
                            ${recipientsHtml || '<span style="color: #666; font-style: italic;">لا توجد تفاصيل إضافية</span>'}
                        </div>
                    </div>
                `}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
                        <div style="flex:1;">
                            <label style="${labelStyle}">اللون:</label>
                            <input id="loc-color" type="color" value="${item.color}" style="width:100%; height:30px; border:none; background:none; cursor:pointer;">
                        </div>
                        <div style="flex:1;">
                            <label style="${labelStyle}">المدى:</label>
                            <input id="loc-radius" type="number" value="${item.radius}" min="5" max="5000" step="5" style="${inputStyle}">
                        </div>
                    </div>
                    <div style="margin-bottom:12px;">
                       <label style="${labelStyle}">الشفافية: <span id="loc-opacity-val">${Math.round(item.fillOpacity * 100)}%</span></label>
                       <input id="loc-opacity" type="range" min="0" max="100" value="${Math.round(item.fillOpacity * 100)}" style="width:100%; accent-color: #555;">
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="loc-save" style="flex:2; background: rgba(33, 150, 243, 0.8); color:white; border:none; border-radius: 8px; padding:8px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">حفظ</button>
                        <button id="loc-delete" style="flex:1; background: rgba(244, 67, 54, 0.1); color:#d32f2f; border:1px solid rgba(244, 67, 54, 0.3); border-radius: 8px; padding:8px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">حذف</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, item.marker.position, !hoverOnly);
        
        // ربط الأحداث (Events)
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => {
            this.attachCardEvents(item, hoverOnly);
            
            // ربط زر الإغلاق الجديد (X)
            const closeX = document.getElementById("loc-close-x");
            if(closeX) closeX.addEventListener("click", () => UI.forceCloseSharedInfoCard());
        });
    }
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 100px;">
                            <label style="${labelStyle}">اللون:</label>
                            <input id="loc-color" type="color" value="${item.color}" style="width:100%; height:36px; border:none; background:none; cursor:pointer;">
                        </div>
                        <div style="flex:1; min-width: 100px;">
                            <label style="${labelStyle}">الحجم (متر):</label>
                            <input id="loc-radius" type="number" value="${item.radius}" min="5" max="5000" step="5" style="${inputStyle}">
                        </div>
                    </div>
                    <div style="margin-bottom:20px;">
                        <label style="${labelStyle}">الشفافية: <span id="loc-opacity-val">${Math.round(item.fillOpacity * 100)}%</span></label>
                        <input id="loc-opacity" type="range" min="0" max="100" value="${Math.round(item.fillOpacity * 100)}" style="width:100%; accent-color: #4285f4;">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button id="loc-save" style="flex:2; background: linear-gradient(135deg, #4285f4, #3b71ca); color:white; border:none; border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif; box-shadow: 0 4px 10px rgba(66, 133, 244, 0.3);">حفظ</button>
                        <button id="loc-delete" style="flex:1; background: rgba(233, 66, 53, 0.1); color:#d93025; border:1px solid rgba(233, 66, 53, 0.3); border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">حذف</button>
                        <button id="loc-close" style="flex:1; background: rgba(0,0,0,0.05); color:#444; border:1px solid rgba(0,0,0,0.1); border-radius: 12px; padding:12px; cursor:pointer; font-weight:bold; font-family: 'Tajawal', sans-serif;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, item.marker.position, !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachCardEvents(item, hoverOnly));
    }

    attachCardEvents(item, hoverOnly = false) {
        const closeBtn = document.getElementById("loc-close");
        if (closeBtn) closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard(); });
        if (hoverOnly || !MAP.editMode) return;

        const saveBtn = document.getElementById("loc-save");
        const delBtn = document.getElementById("loc-delete");
        const nameEl = document.getElementById("loc-name");
        const recEl = document.getElementById("loc-rec");
        const colEl = document.getElementById("loc-color");
        const radEl = document.getElementById("loc-radius");
        const opEl = document.getElementById("loc-opacity");
        const opValEl = document.getElementById("loc-opacity-val");
        const iconTypeEl = document.getElementById("loc-icon-type");

        if (opEl) { opEl.addEventListener("input", () => { if(opValEl) opValEl.textContent = opEl.value + "%"; }); }

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean);
                item.name = nameEl.value.trim();
                item.iconType = iconTypeEl.value;
                item.color = colEl.value;
                item.radius = Utils.clamp(+radEl.value, 5, 5000);
                item.fillOpacity = Utils.clamp(+opEl.value, 0, 100) / 100;

                item.circle.setOptions({
                    fillColor: item.color,
                    strokeColor: item.color,
                    radius: item.radius,
                    fillOpacity: item.fillOpacity
                });
                
                item.marker.content = this.buildMarkerContent(item);

                bus.emit("persist");
                UI.forceCloseSharedInfoCard();
                bus.emit("toast", "تم حفظ التعديلات");
            });
        }

        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (!confirm(`حذف "${item.name}"؟`)) return;
                item.marker.map = null;
                item.circle.setMap(null);
                this.items = this.items.filter(x => x.id !== item.id);
                UI.forceCloseSharedInfoCard();
                bus.emit("persist");
                bus.emit("toast", "تم حذف الموقع");
            });
        }
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
            usePin: it.usePin,
            showCircle: it.showCircle,
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
   RouteManager — إدارة المسارات + بطاقات Glass (تصميم موحد)
============================================================ */

/* ============================================================
   RouteManager — إدارة المسارات + بطاقات Glass (متجاوبة بالكامل)
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
        el.style.cssText = `width:22px; height:22px; background:white; border-radius:50%; border:2px solid ${rt.color}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; z-index:101;`;
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
        rt.poly.addListener("mouseover", () => { if (!UI.infoWindowPinned) this.openRouteCard(routeIndex, true); });
        rt.poly.addListener("mouseout", () => { UI.closeSharedInfoCard(); });
        rt.poly.addListener("click", () => this.openRouteCard(routeIndex, false));
    }

    openRouteCard(routeIndex, hoverOnly = false) {
        const rt = this.routes[routeIndex];
        const dist = Utils.formatDistance(rt.distance);
        const dur = Utils.formatDuration(rt.duration);
        const notes = Utils.escapeHTML(rt.notes || "");
        const isEditable = !hoverOnly && MAP.editMode;

        // === تعديل تجاوب الكرت ===
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(20, 20, 20, 0.95);
            backdrop-filter: blur(40px) saturate(1.8);
            -webkit-backdrop-filter: blur(40px) saturate(1.8);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0;
            color: #f0f0f0;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            max-width: 90vw; /* تغيير */
            width: 360px; /* تغيير */
            overflow: hidden;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.1); border-top: 1px solid rgba(255, 255, 255, 0.1);`;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 18px; font-weight: 700;">معلومات المسار ${routeIndex + 1}</h3>
                <img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;">
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; font-family: 'Cairo', sans-serif;">
                    <span><b>المسافة:</b> ${dist}</span>
                    <span><b>الوقت:</b> ${dur}</span>
                </div>
                ${isEditable ? `
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">اللون:</label><input id="route-color" type="color" value="${rt.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">الحجم:</label><input id="route-weight" type="number" value="${rt.weight}" min="1" max="20" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">شفافية الخط: <span id="route-opacity-val">${Math.round(rt.opacity * 100)}%</span></label>
                        <input id="route-opacity" type="range" min="0" max="100" value="${Math.round(rt.opacity * 100)}" style="width:100%;">
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">ملاحظات:</label>
                        <textarea id="route-notes" rows="3" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #ddd; resize: none; box-sizing: border-box; font-family: 'Cairo', sans-serif; font-size: 14px; color: #333;">${notes}</textarea>
                    </div>
                ` : `
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #ccc; font-family: 'Cairo', sans-serif;">ملاحظات:</p>
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 10px; border-radius: 10px; min-height: 40px; font-size: 14px; line-height: 1.6; font-family: 'Cairo', sans-serif;">
                        ${notes || '<span style="color: #888;">لا توجد ملاحظات</span>'}
                    </div>
                `}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="route-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 100px;">حفظ</button>
                        <button id="route-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">حذف</button>
                        <button id="route-close" style="flex:1;background:rgba(255,255,255,0.1);color:#f0f0f0;border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, this.getRouteCenter(rt), !hoverOnly);
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
        const rt = this.routes[routeIndex];
        const saveBtn = document.getElementById("route-save"); const delBtn = document.getElementById("route-delete"); const closeBtn = document.getElementById("route-close");
        const colEl = document.getElementById("route-color"); const weightEl = document.getElementById("route-weight");
        const opEl = document.getElementById("route-opacity"); const opValEl = document.getElementById("route-opacity-val"); const notesEl = document.getElementById("route-notes");
        if (opEl) { opEl.addEventListener("input", () => { if (opValEl) opValEl.textContent = opEl.value + "%"; }); }
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                rt.color = colEl.value; rt.weight = Utils.clamp(+weightEl.value, 1, 20); rt.opacity = Utils.clamp(+opEl.value, 0, 100) / 100; rt.notes = notesEl.value.trim();
                rt.poly.setOptions({ strokeColor: rt.color, strokeWeight: rt.weight, strokeOpacity: rt.opacity });
                bus.emit("persist"); UI.forceCloseSharedInfoCard(); bus.emit("toast", "تم حفظ تعديلات المسار");
            });
        }
        if (delBtn) { delBtn.addEventListener("click", () => { if (!confirm(`حذف المسار ${routeIndex + 1}؟`)) return; this.removeRoute(routeIndex); bus.emit("toast", "تم حذف المسار"); }); }
        if (closeBtn) { closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard(); }); }
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
   PolygonManager — إدارة المضلعات + بطاقات Glass
============================================================ */

/* ============================================================
   PolygonManager — إدارة المضلعات + بطاقات Glass (متجاوبة بالكامل)
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
    buildVertexMarkerContent(color) { const el = document.createElement("div"); el.style.width = "12px"; el.style.height = "12px"; el.style.borderRadius = "50%"; el.style.background = "white"; el.style.border = `2px solid ${color}`; el.style.cursor = 'pointer'; return el; }
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
    distanceToSegment(point, segStart, segEnd) { /* ... (لا تغيير هنا) ... */ }

    openCard(polyIndex, hoverOnly = false) {
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        const isEditable = !hoverOnly && MAP.editMode && !isEditingShape;
        const notes = Utils.escapeHTML(poly.notes || "");
        const area = google.maps.geometry.spherical.computeArea(poly.points);
        const areaText = Utils.formatArea(area);

        // === تعديل تجاوب الكرت ===
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px) saturate(1.8);
            -webkit-backdrop-filter: blur(20px) saturate(1.8);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 0;
            color: #333;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
            max-width: 90vw; /* تغيير */
            width: 360px; /* تغيير */
            overflow: hidden;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.6); border-bottom: 1px solid rgba(255, 255, 255, 0.2);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.6); border-top: 1px solid rgba(255, 255, 255, 0.2);`;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 18px; font-weight: 700;">${Utils.escapeHTML(poly.name)}</h3>
                <img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;">
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; font-family: 'Cairo', sans-serif;">
                    <span><b>المساحة:</b> ${areaText}</span>
                </div>
                ${isEditingShape ? `<p style="margin: 0; color: #555; text-align:center; font-family: 'Cairo', sans-serif;">اسحب النقاط لتعديل الشكل. انقر على الحدود لإضافة نقطة. انقر بزر الماوس الأيمن على نقطة لحذفها.</p>` : (isEditable ? `
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">الاسم:</label><input id="poly-name" type="text" value="${Utils.escapeHTML(poly.name)}" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">اللون:</label><input id="poly-color" type="color" value="${poly.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">سماكة الخط:</label><input id="poly-stroke" type="number" value="${poly.strokeWeight}" min="1" max="10" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ddd;box-sizing:border-box;"></div>
                    </div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">شفافية الحدود: <span id="poly-stroke-opacity-val">${Math.round(poly.strokeOpacity * 100)}%</span></label><input id="poly-stroke-opacity" type="range" min="0" max="100" value="${Math.round(poly.strokeOpacity * 100)}" style="width:100%;"></div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">شفافية التعبئة: <span id="poly-fill-opacity-val">${Math.round(poly.fillOpacity * 100)}%</span></label><input id="poly-fill-opacity" type="range" min="0" max="100" value="${Math.round(poly.fillOpacity * 100)}" style="width:100%;"></div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px; font-family: 'Cairo', sans-serif;">ملاحظات:</label><textarea id="poly-notes" rows="3" style="width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #ddd; resize: none; box-sizing: border-box; font-family: 'Cairo', sans-serif; font-size: 14px;">${notes}</textarea></div>
                ` : `
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #555; font-family: 'Cairo', sans-serif;">ملاحظات:</p>
                    <div style="background: rgba(52, 168, 83, 0.1); padding: 10px; border-radius: 10px; min-height: 40px; font-size: 14px; line-height: 1.6; font-family: 'Cairo', sans-serif;">
                        ${notes || '<span style="color: #888;">لا توجد ملاحظات</span>'}
                    </div>
                `)
                }
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="poly-save-properties" style="flex:2;background:#ff9800;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 100px;">حفظ الخصائص</button>
                        <button id="poly-edit-shape" style="flex:2;background:#34a853;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 100px;">تعديل الشكل</button>
                        <button id="poly-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">حذف</button>
                        <button id="poly-close" style="flex:1;background:rgba(0,0,0,0.05);color:#333;border:1px solid #ddd;border-radius:12px;padding:10px;cursor:pointer;font-weight:600; font-family: 'Tajawal', sans-serif; min-width: 80px;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;

        UI.openSharedInfoCard(html, this.getPolygonCenter(poly), !hoverOnly);
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => this.attachCardEvents(polyIndex, hoverOnly));
    }

    getPolygonCenter(poly) { const bounds = new google.maps.LatLngBounds(); poly.points.forEach(pt => bounds.extend(pt)); return bounds.getCenter(); }

    attachCardEvents(polyIndex, hoverOnly) {
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        if (isEditingShape) { const stopEditBtn = document.getElementById("poly-stop-edit"); if (stopEditBtn) stopEditBtn.addEventListener("click", () => { this.exitEditMode(); UI.forceCloseSharedInfoCard(); }); return; }
        if (hoverOnly || !MAP.editMode) return;
        const savePropsBtn = document.getElementById("poly-save-properties"); const editShapeBtn = document.getElementById("poly-edit-shape"); const delBtn = document.getElementById("poly-delete"); const closeBtn = document.getElementById("poly-close");
        const nameEl = document.getElementById("poly-name"); const notesEl = document.getElementById("poly-notes");
        const colEl = document.getElementById("poly-color"); const strokeEl = document.getElementById("poly-stroke");
        const strokeOpEl = document.getElementById("poly-stroke-opacity"); const fillOpEl = document.getElementById("poly-fill-opacity");
        const strokeOpValEl = document.getElementById("poly-stroke-opacity-val"); const fillOpValEl = document.getElementById("poly-fill-opacity-val");
        if (strokeOpEl) { strokeOpEl.addEventListener("input", () => { if (strokeOpValEl) strokeOpValEl.textContent = strokeOpEl.value + "%"; }); }
        if (fillOpEl) { fillOpEl.addEventListener("input", () => { if (fillOpValEl) fillOpValEl.textContent = fillOpEl.value + "%"; }); }
        if (savePropsBtn) {
            savePropsBtn.addEventListener("click", () => {
                poly.name = nameEl.value.trim(); poly.notes = notesEl.value.trim(); poly.color = colEl.value;
                poly.strokeWeight = Utils.clamp(+strokeEl.value, 1, 10); poly.strokeOpacity = Utils.clamp(+strokeOpEl.value, 0, 100) / 100;
                poly.fillOpacity = Utils.clamp(+fillOpEl.value, 0, 100) / 100;
                poly.polygon.setOptions({ fillColor: poly.color, strokeColor: poly.color, strokeWeight: poly.strokeWeight, strokeOpacity: poly.strokeOpacity, fillOpacity: poly.fillOpacity });
                bus.emit("persist"); UI.forceCloseSharedInfoCard(); bus.emit("toast", "تم حفظ خصائص المضلع");
            });
        }
        if (editShapeBtn) { editShapeBtn.addEventListener("click", () => { this.enterEditMode(polyIndex); UI.forceCloseSharedInfoCard(); }); }
        if (delBtn) { delBtn.addEventListener("click", () => { if (!confirm(`حذف "${poly.name}"؟`)) return; poly.polygon.setMap(null); this.polygons = this.polygons.filter(p => p.id !== poly.id); UI.forceCloseSharedInfoCard(); bus.emit("persist"); bus.emit("toast", "تم حذف المضلع"); }); }
        if (closeBtn) { closeBtn.addEventListener("click", () => { UI.forceCloseSharedInfoCard(); }); }
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
   StateManager — النظام الرئيس لحفظ واسترجاع state
============================================================ */
/* ============================================================
   StateManager — إدارة حفظ واسترجاع الحالة
============================================================ */
/* ============================================================
/* ============================================================
   StateManager — إدارة حفظ واسترجاع الحالة (مُصلح)
============================================================ */
class StateManager {

    constructor() {
        this.map = null;
        this.shareMode = false;
        this.persistTimer = null;

        bus.on("map:ready", map => {
            this.map = map;
            // نحصل على قيمة الوضع من MapController بعد أن يحددها
            this.shareMode = MAP.shareMode;

            // 1. دائماً حاول قراءة الحالة من الرابط، بغض النظر عن الوضع
            const stateFromUrl = this.readShare();

            // 2. إذا تم العثور على حالة في الرابط، قم بتطبيقها
            if (stateFromUrl) {
                console.log("State found in URL, applying...");
                this.applyState(stateFromUrl);
            } else {
                console.log("No state found in URL.");
            }

            // 3. فقط إذا لم نكن في وضع المشاركة، قم بتفعيل الحفظ التلقائي
            if (!this.shareMode) {
                console.log("Enabling auto-persist for edit mode.");
                bus.on("persist", () => this.schedulePersist());
            }
        });
    }

    // بناء الحالة الكاملة الحالية (خريطة + مواقع + مسارات)
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

    // كتابة الحالة في URL (بدون اختصار)
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

    // حفظ تلقائي
    schedulePersist() {
        if (this.shareMode) return;

        clearTimeout(this.persistTimer);
        this.persistTimer = setTimeout(() => {
            const st = this.buildState();
            if (st) this.writeShare(st);
        }, 300);
    }

    // قراءة حالة المشاركة من ?x=
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

    // تطبيق الحالة المستعادة على الخريطة
    applyState(state) {
        console.log("Applying state:", state);

        if (!state) return;

        // تطبيق حالة الخريطة
        if (state.map) {
            const mapState = state.map;
            if (mapState.c && mapState.z) {
                this.map.setCenter({ lat: mapState.c[0], lng: mapState.c[1] });
                this.map.setZoom(mapState.z);
            }
            if (mapState.t) {
                this.map.setMapTypeId(mapState.t);
            }
            if (mapState.traffic) {
                MAP.trafficLayer.setMap(this.map);
            } else {
                MAP.trafficLayer.setMap(null);
            }
        }

        // تطبيق حالة المواقع
        if (state.locations) {
            LOCATIONS.applyState({ locations: state.locations });
        }

        // تطبيق حالة المسارات
        if (state.routes) {
            ROUTES.applyState({ routes: state.routes });
         }
        // تطبيق حالة المضلعات
         if (state.polygons) {
            POLYGONS.applyState({ polygons: state.polygons });
        }
    }
}

const STATE = new StateManager();




/* ============================================================
   ShareManager — محاولة اختصار + fallback تلقائي
============================================================ */
/* ============================================================
   ShareManager — نسخ آمن مع تحقق من طول الرابط
============================================================ */
/* ============================================================
   ShareManager — نسخ آمن مع ضغط البيانات
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
            // الآن الرابط سيكون قصيرًا بفضل الضغط، وفرص النجاح أعلى
            const api = "https://is.gd/create.php?format=json&url=" +
                        encodeURIComponent(longUrl);
            const res = await fetch(api);
            const data = await res.json();

            if (data && data.shorturl) {
                finalUrl = data.shorturl;
            }
        } catch (err) {
            console.error("is.gd error, using long URL.", err);
            finalUrl = longUrl;
        }

        // محاولة النسخ
        try {
            await navigator.clipboard.writeText(finalUrl);
            bus.emit("toast", "تم نسخ رابط المشاركة");
        } catch (err) {
            console.error("Clipboard copy failed, showing manual dialog.", err);
            this.showManualCopyDialog(finalUrl);
        }

        this.btn.disabled = false;
        if (label) label.textContent = original || "مشاركة";
    }

    // دالة لعرض نافذة النسخ اليدوي (تبقى كما هي)
    showManualCopyDialog(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.6); z-index: 10000; display: flex; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;`;
        const dialog = document.createElement('div');
        dialog.style.cssText = `background: white; border-radius: 12px; padding: 24px; max-width: 90%; width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); text-align: center; direction: rtl;`;
        dialog.innerHTML = `<h3 style="margin-top: 0; margin-bottom: 16px; color: #333;">انسخ الرابط يدويًا</h3><p style="margin-bottom: 20px; color: #666; line-height: 1.5;">الرجاء الضغط مطولاً على الرابط واختيار "نسخ".</p><textarea readonly style="width: 100%; height: 80px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 14px; text-align: center; resize: none; direction: ltr; box-sizing: border-box;">${url}</textarea><button id="manual-copy-close" style="margin-top: 20px; width: 100%; padding: 12px; background-color: #4285f4; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">إغلاق</button>`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        document.getElementById('manual-copy-close').addEventListener('click', () => { document.body.removeChild(overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { document.body.removeChild(overlay); } });
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
        bus.emit("toast", "وضع القياس مفعل. انقر لإضافة نقاط، انقر بزر الماوس الأيمن للحذف، انقر نقرًا مزدوجًا للإنهاء.");
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
        // مسح الرسومات السابقة
        if (this.polyline) this.polyline.setMap(null);
        if (this.polygon) this.polygon.setMap(null);
        if (this.infoWindow) this.infoWindow.close();

        if (this.points.length === 0) return;

        // حساب المسافة
        let distance = 0;
        if (this.points.length > 1) {
            const path = new google.maps.MVCArray(this.points);
            distance = google.maps.geometry.spherical.computeLength(path);
        }

        // حساب المساحة
        let area = 0;
        if (this.points.length > 2) {
            area = google.maps.geometry.spherical.computeArea(this.points);
        }

        // رسم الخط
        this.polyline = new google.maps.Polyline({
            path: this.points,
            map: this.map,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            geodesic: true,
        });

        // رسم المضلع (إذا كانت هناك 3 نقاط أو أكثر)
        if (this.points.length > 2) {
            this.polygon = new google.maps.Polygon({
                paths: this.points,
                map: this.map,
                fillColor: "#FF0000",
                fillOpacity: 0.2,
                strokeOpacity: 0,
            });
        }

        // عرض النتيجة في نافذة معلومات
        const lastPoint = this.points[this.points.length - 1];
        let content = `<div style="direction: rtl; font-family: 'Cairo', sans-serif;">`;
        content += `<b>المسافة الإجمالية:</b> ${Utils.formatDistance(distance)}<br>`;
        if (area > 0) {
            content += `<b>المساحة الإجمالية:</b> ${Utils.formatArea(area)}`;
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
        if (this.polyline) {
            this.polyline.setMap(null);
            this.polyline = null;
        }
        if (this.polygon) {
            this.polygon.setMap(null);
            this.polygon = null;
        }
        if (this.infoWindow) {
            this.infoWindow.close();
        }
        this.points = [];
    }
}

// هذا السطر مهم جدًا لإنشاء نسخة من الكلاس
const MEASURE = new MeasureManager();

/* ============================================================
   UIManager — واجهة المستخدم
============================================================ */

/* ============================================================
   UIManager — واجهة المستخدم (مع نافذة معلومات متجاوبة بالكامل)
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
        console.log("UI: initializeUI() called.");
        if (MAP.shareMode) {
            this.applyShareMode();
        }

        // === التعديل الرئيسي هنا ===
        // إنشاء نافذة المعلومات بعرض متجاوب
        const maxWidth = Math.min(window.innerWidth * 0.9, 400);
        this.sharedInfoWindow = new google.maps.InfoWindow({ maxWidth: maxWidth });

        MAP.map.addListener("click", () => {
            this.closeSharedInfoCard();
        });

        // مستمع أحداث لوحة الطبقات
        if (this.btnLayers) {
            this.btnLayers.addEventListener("click", () => this.toggleLayersPanel());
        }
        if (this.btnCloseLayers) {
            this.btnCloseLayers.addEventListener("click", () => this.toggleLayersPanel());
        }

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
        // أغلق النافذة الحالية دائمًا قبل فتح نافذة جديدة
        this.sharedInfoWindow.close();
        
        this.sharedInfoWindow.setContent(content);
        this.sharedInfoWindow.setPosition(position);
        this.sharedInfoWindow.open({ map: MAP.map });
        
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
                this.showToast("اضغط على الخريطة لإضافة موقع");
                break;
            case 'route':
                ROUTES.startNewRouteSequence();
                MAP.modeRouteAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة نقاط المسار الأول");
                break;
            case 'polygon':
                POLYGONS.startPolygonSequence();
                MAP.modePolygonAdd = true;
                MAP.setCursor("crosshair");
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة رؤوس المضلع، ثم 'إنهاء الرسم'");
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
                <img src="${this.logo}" style="
                    width:22px;height:22px;border-radius:6px;opacity:0.9;">
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

        if (window.google && google.maps &&
            document.readyState !== "loading") {

            this.booted = true;
            this.start();
        }
    }

    start() {

        console.log("Diriyah Security Map v22.0 — Ready");

        bus.on("map:zoom", z => {
            bus.emit("markers:scale", z);
        });

        bus.on("map:bounds", () => {
            bus.emit("persist");
        });

        this.finish();
    }

    finish() {
        console.log("System initialization completed.");
        bus.emit("toast", "تم تحميل النظام بنجاح");
    }
}

const BOOT = new BootLoader();
