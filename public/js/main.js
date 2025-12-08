'use strict';

/* ============================================================
   Diriyah Security Map – v24.0 (Glass UI + My Maps Icons)
   • استعادة تصميم Glassmorphism (شفاف، بدون إطار أبيض)
   • نظام أيقونات مطابق لـ Google My Maps (مجموعات)
   • دعم التبديل بين "دبوس" و "دائرة"
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
        console.log("Boot v24.0 - Glass UI + My Maps Icons");

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
   LocationManager — المواقع (نظام الدبابيس والدوائر)
============================================================ */
class LocationManager {

    constructor() {
        this.items = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        
        // تصنيف الأيقونات مطابق لـ Google My Maps
        this.iconGroups = {
            "شائعة": [
                { value: 'place', label: 'موقع' },
                { value: 'home', label: 'منزل' },
                { value: 'work', label: 'عمل' },
                { value: 'star', label: 'نجمة' },
                { value: 'favorite', label: 'مفضلة' }
            ],
            "نقل": [
                { value: 'directions_car', label: 'سيارة' },
                { value: 'directions_bus', label: 'حافلة' },
                { value: 'local_parking', label: 'مواقف' },
                { value: 'local_gas_station', label: 'محطة وقود' },
                { value: 'flight', label: 'مطار' }
            ],
            "أزمات": [
                { value: 'report_problem', label: 'تنبيه' },
                { value: 'local_hospital', label: 'مستشفى' },
                { value: 'local_police', label: 'شرطة' },
                { value: 'local_fire_department', label: 'اطفاء' },
                { value: 'security', label: 'أمن' },
                { value: 'medical_services', label: 'خدمات طبية' }
            ],
            "مرافق وخدمات": [
                { value: 'restaurant', label: 'مطعم' },
                { value: 'local_cafe', label: 'مقهى' },
                { value: 'shopping_cart', label: 'تسوق' },
                { value: 'school', label: 'مدرسة' },
                { value: 'wc', label: 'دورة مياه' }
            ],
            "حيوانات وطبيعة": [
                { value: 'pets', label: 'حيوانات' },
                { value: 'park', label: 'منتزه' },
                { value: 'hiking', label: 'تنزه' },
                { value: 'terrain', label: 'جبل' },
                { value: 'water_drop', label: 'مياه' }
            ],
            "الطقس": [
                { value: 'wb_sunny', label: 'مشمس' },
                { value: 'cloud', label: 'غائم' },
                { value: 'thunderstorm', label: 'عاصفة' },
                { value: 'ac_unit', label: 'بارد' }
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
                const hitRadius = item.markerStyle === 'pin' ? 5 : (item.radius || 20); 
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
                color: "#0288d1", 
                fillOpacity: 0.3, 
                recipients: [], 
                name: "نقطة جديدة",
                markerStyle: "pin",
                iconType: "place"
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
            { name: "مواقف نسما", lat: 24.738275, lng: 46.574004, iconType: 'local_parking', markerStyle: 'pin', color: '#1976d2' },
            { name: "نقطة أمنية", lat: 24.736501, lng: 46.576545, iconType: 'security', markerStyle: 'circle', color: '#d32f2f' }
        ]; 
        LOCS.forEach(loc => this.addItem({ 
            id: "d" + Date.now() + Math.random(), 
            name: loc.name, 
            lat: loc.lat, 
            lng: loc.lng, 
            radius: 22, 
            color: loc.color || "#0288d1", 
            fillOpacity: 0.3, 
            recipients: [],
            iconType: loc.iconType,
            markerStyle: loc.markerStyle || 'pin'
        })); 
    }
    
    addItem(data) {
        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: this.buildMarkerContent(data),
            gmpDraggable: this.editMode && !this.shareMode,
            title: data.name
        });

        const circle = new google.maps.Circle({
            center: { lat: data.lat, lng: data.lng },
            map: (data.markerStyle === 'circle') ? this.map : null,
            radius: data.radius || 20,
            strokeColor: data.color || "#0288d1",
            fillColor: data.color || "#0288d1",
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
            markerStyle: data.markerStyle || 'pin',
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

        if (data.markerStyle === 'circle') {
            container.style.cssText = `
                width: 14px;
                height: 14px;
                background-color: ${data.color}; 
                border: 2px solid white;
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
        } else {
            container.className = 'custom-pin';
            container.style.position = 'relative';
            container.style.cursor = 'pointer';
            
            const pinColor = data.color || "#0288d1";
            
            container.innerHTML = `
                <svg width="36" height="50" viewBox="0 0 30 42" style="filter: drop-shadow(0 3px 4px rgba(0,0,0,0.4)); display: block;">
                    <path fill="${pinColor}" d="M15 0C6.7 0 0 6.7 0 15c0 10 15 27 15 27s15-17 15-27C30 6.7 23.3 0 15 0z" />
                    <circle cx="15" cy="15" r="7" fill="rgba(0,0,0,0.1)" />
                </svg>
                <i class="material-icons" style="
                    position: absolute; 
                    top: 5px; 
                    left: 50%; 
                    transform: translateX(-50%); 
                    font-size: 20px; 
                    color: white;
                    pointer-events: none;
                ">${data.iconType || 'place'}</i>
            `;
            container.style.transform = 'translate(0, -50%)'; 
        }

        return container;
    }

    attachListeners(item) {
        item.marker.addListener("drag", () => {
            if (item.circle) item.circle.setCenter(item.marker.position);
        });
        item.marker.addListener("dragend", () => bus.emit("persist"));
        item.marker.addListener("click", () => this.openCard(item, false));
        if (item.circle) {
            item.circle.addListener("click", () => this.openCard(item, false));
        }
    }

    openCard(item, hoverOnly = false) {
        const name = Utils.escapeHTML(item.name);
        const recipientsHtml = item.recipients.map(r => Utils.escapeHTML(r)).join('<br>');
        const isEditable = !hoverOnly && MAP.editMode;

        // --- تصميم Glass UI الشفاف (بدون إطار أبيض) ---
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(30, 30, 30, 0.75); /* شفافية داكنة */
            backdrop-filter: blur(16px) saturate(1.8);
            -webkit-backdrop-filter: blur(16px) saturate(1.8);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1); /* إطار شفاف جداً */
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            padding: 0;
            color: #f0f0f0; /* نص أبيض */
            direction: rtl;
            width: 360px;
            max-width: 90vw;
            display: flex;
            flex-direction: column;
            max-height: 70vh;
            overflow: hidden;
        `;

        const headerStyle = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 16px 20px; 
            background: rgba(255, 255, 255, 0.05); 
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        `;

        const bodyStyle = `
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        `;
        
        const footerStyle = `
            padding: 12px 20px; 
            background: rgba(255, 255, 255, 0.05); 
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
        `;

        const inputStyle = `
            width: 100%; 
            padding: 8px 12px; 
            border-radius: 8px; 
            border: 1px solid rgba(255, 255, 255, 0.2); 
            background: rgba(0, 0, 0, 0.3); 
            font-family: 'Cairo', sans-serif; 
            font-size: 14px; 
            outline: none;
            color: #fff;
            margin-bottom: 16px;
        `;

        const labelStyle = `font-size:12px; display:block; margin-bottom:4px; font-weight: 600; color: #ccc;`;

        // إنشاء خيارات القائمة المنسدلة باستخدام المجموعات (Categories)
        let optionsHtml = '';
        for (const [group, icons] of Object.entries(this.iconGroups)) {
            optionsHtml += `<optgroup label="${group}" style="color: #333;">`; // color needed for optgroup visibility in some browsers
            optionsHtml += icons.map(icon => 
                `<option value="${icon.value}" ${item.iconType === icon.value ? 'selected' : ''}>${icon.label}</option>`
            ).join('');
            optionsHtml += `</optgroup>`;
        }

        let bodyContent = '';
        if (isEditable) {
            bodyContent = `
                <div style="margin-bottom: 16px;">
                    <label style="${labelStyle}">الاسم</label>
                    <input id="loc-name" type="text" value="${name}" style="${inputStyle}" placeholder="أدخل الاسم">
                </div>

                <div style="display: flex; gap: 15px; margin-bottom: 16px;">
                    <div style="flex:1;">
                        <label style="${labelStyle}">الشكل</label>
                        <select id="loc-marker-style" style="${inputStyle} padding: 8px;">
                            <option value="pin" ${item.markerStyle === 'pin' ? 'selected' : ''} style="color:#333;">دبوس أيقونة</option>
                            <option value="circle" ${item.markerStyle === 'circle' ? 'selected' : ''} style="color:#333;">دائرة فقط</option>
                        </select>
                    </div>
                    <div style="flex:1;">
                        <label style="${labelStyle}">الأيقونة</label>
                        <select id="loc-icon-type" style="${inputStyle} padding: 8px;" ${item.markerStyle === 'circle' ? 'disabled' : ''}>
                            ${optionsHtml}
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="${labelStyle}">الوصف</label>
                    <textarea id="loc-rec" style="${inputStyle} min-height:80px; resize:vertical;" placeholder="أضف وصفاً...">${item.recipients.join('\n')}</textarea>
                </div>
            `;
        } else {
            const groupName = Object.keys(this.iconGroups).find(g => this.iconGroups[g].some(i => i.value === item.iconType));
            const iconLabel = this.iconGroups[groupName]?.find(i => i.value === item.iconType)?.label || '';
            
            bodyContent = `
                <div style="font-size: 14px; line-height: 1.6; color: #ddd; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">
                    ${recipientsHtml || '<span style="color:#aaa; font-style:italic;">لا يوجد وصف.</span>'}
                </div>
                ${item.markerStyle === 'pin' ? `<div style="margin-top:12px; font-size:12px; color:#aaa;">التصنيف: ${iconLabel}</div>` : ''}
            `;
        }

        let footerContent = '';
        if (isEditable) {
            footerContent = `
                <div style="${footerStyle}">
                    <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 16px;">
                         <div style="width: 32px; height: 32px; border-radius: 50%; overflow:hidden; border: 1px solid rgba(255,255,255,0.3); position:relative; cursor:pointer;" title="تغيير اللون">
                            <input id="loc-color" type="color" value="${item.color}" style="position:absolute; top:-50%; left:-50%; width:200%; height:200%; cursor:pointer; padding:0; border:none; background:none;">
                         </div>
                         <div style="flex:1;">
                            <label style="font-size:10px; color:#ccc;">نطاق الدائرة (متر)</label>
                            <input id="loc-radius" type="range" min="10" max="1000" step="10" value="${item.radius}" style="width:100%; accent-color: #4285f4;">
                         </div>
                    </div>

                    <div style="display:flex; justify-content: space-between; gap: 10px;">
                        <button id="loc-save" style="flex:2; background: linear-gradient(135deg, #4285f4, #3b71ca); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Tajawal', sans-serif;">حفظ</button>
                        <button id="loc-close" style="flex:1; background: rgba(255,255,255,0.1); color: #ddd; border: 1px solid rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; cursor: pointer; font-family: 'Tajawal', sans-serif;">إلغاء</button>
                        <button id="loc-delete" style="flex:0.5; background: rgba(233, 66, 53, 0.2); color: #ff8a80; border: 1px solid rgba(233, 66, 53, 0.4); padding: 10px; border-radius: 8px; cursor: pointer; display:flex; justify-content:center; align-items:center;"><i class="material-icons">delete</i></button>
                    </div>
                </div>
            `;
        }

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <div style="display:flex; align-items:center; gap:8px;">
                     <img src="img/logo.png" style="width: 24px; height: 24px; opacity: 0.8;">
                     <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 700; color: #fff;">${name}</h3>
                </div>
            </div>
            
            <div style="${bodyStyle}">
                ${bodyContent}
            </div>
            ${footerContent}
        </div>`;

        UI.openSharedInfoCard(html, item.marker.position, !hoverOnly);
        
        google.maps.event.addListenerOnce(UI.sharedInfoWindow, "domready", () => {
            this.attachCardEvents(item, hoverOnly);
            // لا حاجة لزر الإغلاق X لأن المستخدم طلب إزالته
        });
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
        const iconTypeEl = document.getElementById("loc-icon-type");
        const markerStyleEl = document.getElementById("loc-marker-style");

        if (markerStyleEl && iconTypeEl) {
            markerStyleEl.addEventListener("change", () => {
                if (markerStyleEl.value === 'circle') {
                    iconTypeEl.disabled = true;
                } else {
                    iconTypeEl.disabled = false;
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean);
                item.name = nameEl.value.trim();
                item.iconType = iconTypeEl.value;
                item.markerStyle = markerStyleEl.value;
                item.color = colEl.value;
                item.radius = Utils.clamp(+radEl.value, 5, 5000);

                if (item.markerStyle === 'circle') {
                    item.circle.setMap(this.map);
                    item.circle.setOptions({
                        fillColor: item.color,
                        strokeColor: item.color,
                        radius: item.radius,
                        fillOpacity: item.fillOpacity
                    });
                } else {
                    item.circle.setMap(null);
                }
                
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
            markerStyle: it.markerStyle,
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
   RouteManager — إدارة المسارات (تصميم Glass UI)
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

        // --- استعادة تصميم Glass UI ---
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(30, 30, 30, 0.75);
            backdrop-filter: blur(16px) saturate(1.8);
            -webkit-backdrop-filter: blur(16px) saturate(1.8);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0;
            color: #f0f0f0;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 90vw;
            width: 320px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 60vh;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;`;
        const bodyStyle = `padding: 16px; overflow-y: auto; flex: 1;`;
        const footerStyle = `padding: 10px 16px; background: rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;`;

        const inputStyle = `
            width: 100%; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); 
            background: rgba(0,0,0,0.3); color: #fff; font-family: 'Cairo', sans-serif;
        `;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <div style="display:flex; align-items:center; gap:8px;">
                    <img src="img/logo.png" style="width: 20px; opacity:0.8;">
                    <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 700;">معلومات المسار ${routeIndex + 1}</h3>
                </div>
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 14px;">
                    <span><b>المسافة:</b> ${dist}</span>
                    <span><b>الوقت:</b> ${dur}</span>
                </div>
                ${isEditable ? `
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;">
                            <label style="font-size:11px; color:#ccc;">اللون</label>
                            <input id="route-color" type="color" value="${rt.color}" style="width:100%;height:30px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0;">
                        </div>
                        <div style="flex:1; min-width: 120px;">
                            <label style="font-size:11px; color:#ccc;">السماكة</label>
                            <input id="route-weight" type="number" value="${rt.weight}" min="1" max="20" style="${inputStyle}">
                        </div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:11px; color:#ccc; display:block; margin-bottom:5px;">ملاحظات</label>
                        <textarea id="route-notes" rows="2" style="${inputStyle} resize: none;">${notes}</textarea>
                    </div>
                ` : `
                    <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.5;">
                        ${notes || '<span style="color: #aaa;">لا توجد ملاحظات</span>'}
                    </div>
                `}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px;">
                        <button id="route-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:bold;">حفظ</button>
                        <button id="route-delete" style="flex:1;background:rgba(233,66,53,0.2);color:#ff8a80;border:1px solid rgba(233,66,53,0.4);border-radius:8px;padding:8px;cursor:pointer;">حذف</button>
                        <button id="route-close" style="flex:1;background:rgba(255,255,255,0.1);color:#ddd;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px;cursor:pointer;">إغلاق</button>
                    </div>
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
        const rt = this.routes[routeIndex];
        const saveBtn = document.getElementById("route-save"); const delBtn = document.getElementById("route-delete"); const closeBtn = document.getElementById("route-close");
        const colEl = document.getElementById("route-color"); const weightEl = document.getElementById("route-weight");
        const notesEl = document.getElementById("route-notes");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                rt.color = colEl.value; rt.weight = Utils.clamp(+weightEl.value, 1, 20); rt.notes = notesEl.value.trim();
                rt.poly.setOptions({ strokeColor: rt.color, strokeWeight: rt.weight });
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
   PolygonManager — إدارة المضلعات (تصميم Glass UI)
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

    openCard(polyIndex, hoverOnly = false) {
        const poly = this.polygons[polyIndex];
        const isEditingShape = this.editingPolygonIndex === polyIndex;
        const isEditable = !hoverOnly && MAP.editMode && !isEditingShape;
        const notes = Utils.escapeHTML(poly.notes || "");
        const area = google.maps.geometry.spherical.computeArea(poly.points);
        const areaText = Utils.formatArea(area);

        // --- استعادة تصميم Glass UI ---
        const cardStyle = `
            font-family: 'Cairo', sans-serif;
            background: rgba(30, 30, 30, 0.75);
            backdrop-filter: blur(16px) saturate(1.8);
            -webkit-backdrop-filter: blur(16px) saturate(1.8);
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0;
            color: #f0f0f0;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 90vw;
            width: 350px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 65vh;
        `;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;`;
        const bodyStyle = `padding: 16px; overflow-y: auto; flex: 1;`;
        const footerStyle = `padding: 10px 16px; background: rgba(255, 255, 255, 0.05); border-top: 1px solid rgba(255, 255, 255, 0.1); flex-shrink: 0;`;

        const inputStyle = `
            width: 100%; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); 
            background: rgba(0,0,0,0.3); color: #fff; font-family: 'Cairo', sans-serif;
        `;

        const html = `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <div style="display:flex; align-items:center; gap:8px;">
                     <img src="img/logo.png" style="width: 24px; opacity:0.8;">
                     <h3 style="margin:0; font-family: 'Tajawal', sans-serif; font-size: 16px; font-weight: 700;">${Utils.escapeHTML(poly.name)}</h3>
                </div>
            </div>
            <div style="${bodyStyle}">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px;">
                    <span><b>المساحة:</b> ${areaText}</span>
                </div>
                ${isEditingShape ? `<p style="margin: 0; color: #aaa; text-align:center;">اسحب النقاط لتعديل الشكل.</p>` : (isEditable ? `
                    <div style="margin-bottom:14px;"><label style="font-size:11px; color:#ccc;">الاسم</label><input id="poly-name" type="text" value="${Utils.escapeHTML(poly.name)}" style="${inputStyle}"></div>
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:11px; color:#ccc;">اللون</label><input id="poly-color" type="color" value="${poly.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:11px; color:#ccc;">سماكة الخط</label><input id="poly-stroke" type="number" value="${poly.strokeWeight}" min="1" max="10" style="${inputStyle}"></div>
                    </div>
                    <div style="margin-bottom:14px;"><label style="font-size:11px; color:#ccc; display:block; margin-bottom:4px;">ملاحظات</label><textarea id="poly-notes" rows="3" style="${inputStyle} resize: none;">${notes}</textarea></div>
                ` : `
                    <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.6;">
                        ${notes || '<span style="color: #aaa;">لا توجد ملاحظات</span>'}
                    </div>
                `)
                }
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="poly-save-properties" style="flex:2;background:#ff9800;color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;font-weight:bold;">حفظ</button>
                        <button id="poly-edit-shape" style="flex:2;background:#34a853;color:white;border:none;border-radius:8px;padding:8px;cursor:pointer;">تعديل الشكل</button>
                        <button id="poly-delete" style="flex:1;background:rgba(233,66,53,0.2);color:#ff8a80;border:1px solid rgba(233,66,53,0.4);border-radius:8px;padding:8px;cursor:pointer;">حذف</button>
                        <button id="poly-close" style="flex:1;background:rgba(255,255,255,0.1);color:#ddd;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px;cursor:pointer;">إغلاق</button>
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

        if (savePropsBtn) {
            savePropsBtn.addEventListener("click", () => {
                poly.name = nameEl.value.trim(); poly.notes = notesEl.value.trim(); poly.color = colEl.value;
                poly.strokeWeight = Utils.clamp(+strokeEl.value, 1, 10);
                poly.polygon.setOptions({ fillColor: poly.color, strokeColor: poly.color, strokeWeight: poly.strokeWeight });
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
                border-radius: 16px !important;
            }
            .gm-style-iw-d {
                padding: 0 !important;
                overflow: visible !important;
                max-height: none !important;
            }
            .gm-style-iw-tc {
                display: none !important;
            }
            button.gm-ui-hover-effect {
                display: none !important; /* إخفاء زر الإغلاق الافتراضي */
            }
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
        
        this.sharedInfoWindow.setOptions({
            maxWidth: 360,
            pixelOffset: new google.maps.Size(0, -65),
            zIndex: 1000
        });
        
        this.sharedInfoWindow.open({ map: MAP.map });
        
        // إخفاء زر الإغلاق الافتراضي مرة أخرى للتأكد
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
