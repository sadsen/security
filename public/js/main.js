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
    }
};


/* ============================================================
   MapController — وحدة إدارة الخريطة
============================================================ */
class MapController {

    constructor() {

        this.map = null;
        this.trafficLayer = null;

        this.editMode = true;
        this.shareMode = false;

        this.centerDefault = { lat: 24.7399, lng: 46.5731 };
        this.zoomDefault = 15;

        this.modeAdd = false;
        this.modeRouteAdd = false;

        window.MapController = this;
    }

    init() {

        console.log("Boot v22.0");

        const params = new URLSearchParams(location.search);
        this.shareMode = params.has("x");

        this.editMode = !this.shareMode;

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
            clickableIcons: false,
            styles: [
                { featureType: "poi", stylers: [{ visibility: "off" }] }
            ]
        });

        this.trafficLayer = new google.maps.TrafficLayer();

        bus.emit("map:ready", this.map);

        this.map.addListener("zoom_changed", () => {
            bus.emit("map:zoom", this.map.getZoom());
        });

        this.map.addListener("bounds_changed", () => {
            bus.emit("map:bounds");
        });
    }

    setRoadmap() { this.map.setMapTypeId("roadmap"); }
    setSatellite() { this.map.setMapTypeId("hybrid"); }

    toggleTraffic() {
        if (this.trafficLayer.getMap())
            this.trafficLayer.setMap(null);
        else
            this.trafficLayer.setMap(this.map);
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
   LocationManager — المواقع + بطاقات Glass (متجاوبة مع الجوال)
============================================================ */
/* ============================================================
   LocationManager — المواقع + بطاقات Glass (مُصلح)
============================================================ */
class LocationManager {

    constructor() {
        this.items = []; this.map = null; this.shareMode = false; this.editMode = true;
        this.infoWin = null; this.cardPinned = false;
        bus.on("map:ready", map => { this.map = map; this.shareMode = MAP.shareMode; this.editMode = MAP.editMode; this.onMapReady(); });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        if (!this.shareMode && this.items.length === 0) this.loadDefaultLocations();

        // مستمع النقر لإضافة موقع جديد (كان مفقودًا)
        this.map.addListener("click", e => {
            if (!MAP.modeAdd || this.shareMode) return;
            this.addItem({
                id: "d" + Date.now() + Math.random(),
                lat: e.latLng.lat(),
                lng: e.latLng.lng(),
                radius: 22,
                color: "#ff0000",
                fillOpacity: 0.3,
                recipients: []
            });
            // إيقاف وضع الإضافة بعد إضافة موقع واحد
            MAP.modeAdd = false;
            UI.showDefaultUI();
            bus.emit("persist");
            bus.emit("toast", "تمت إضافة موقع جديد");
        });

        // مستمع النقر لإغلاق الكروت
        this.map.addListener("click", () => {
            if (!this.cardPinned && this.infoWin) this.infoWin.close();
            this.cardPinned = false;
        });
    }

    loadDefaultLocations() {
        const LOCS = [{ name: "بوابة سمحان", lat: 24.742132, lng: 46.569503 }, { name: "منطقة سمحان", lat: 24.740913, lng: 46.571891 }, { name: "دوار البجيري", lat: 24.737521, lng: 46.574069 }, { name: "إشارة البجيري", lat: 24.737662, lng: 46.575429 }];
        LOCS.forEach(loc => this.addItem({ id: "d" + Date.now() + Math.random(), name: loc.name, lat: loc.lat, lng: loc.lng, radius: 22, color: "#ff0000", fillOpacity: 0.3, recipients: [] }));
    }

    addItem(data) {
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: { lat: data.lat, lng: data.lng }, map: this.map, content: document.createElement('div'), gmpDraggable: this.editMode && !this.shareMode });
        const circle = new google.maps.Circle({ center: { lat: data.lat, lng: data.lng }, map: this.map, radius: data.radius || 22, strokeColor: data.color || "#ff0000", fillColor: data.color || "#ff0000", fillOpacity: data.fillOpacity || 0.3, strokeOpacity: 0.9, strokeWeight: 2, zIndex: 100 });
        const item = { id: data.id, name: data.name || "نقطة", color: data.color, radius: data.radius, fillOpacity: data.fillOpacity || 0.3, recipients: data.recipients, marker, circle };
        this.attachListeners(item); this.items.push(item); return item;
    }

    attachListeners(item) {
        item.marker.addListener("drag", () => item.circle.setCenter(item.marker.position));
        item.marker.addListener("dragend", () => bus.emit("persist"));
        item.circle.addListener("mouseover", () => { if (!this.cardPinned) this.openCard(item, true); });
        item.circle.addListener("mouseout", () => { if (!this.cardPinned && this.infoWin) setTimeout(() => { if (!this.cardPinned && this.infoWin) this.infoWin.close(); }, 120); });
        item.circle.addListener("click", () => this.openCard(item, false));
    }

    openCard(item, hoverOnly = false) {
        const html = this.buildCardHTML(item, hoverOnly);
        if (!this.infoWin) this.infoWin = new google.maps.InfoWindow({ maxWidth: 380, pixelOffset: new google.maps.Size(0, -28) });
        this.infoWin.setContent(html);
        this.infoWin.setPosition(item.marker.position);
        this.infoWin.open({ map: this.map, anchor: item.marker });
        if (!hoverOnly) this.cardPinned = true;
        google.maps.event.addListenerOnce(this.infoWin, "domready", () => this.attachCardEvents(item, hoverOnly));
    }

    buildCardHTML(item, hover) {
        const name = Utils.escapeHTML(item.name);
        const recipientsHtml = item.recipients.map(r => Utils.escapeHTML(r)).join('<br>');
        const isEditable = !hover && MAP.editMode;
        const cardStyle = `background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.5); padding: 0; color: #333; direction: rtl; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.2); max-width: 95vw; width: auto; box-sizing: border-box; overflow: hidden;`;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.5); border-bottom: 1px solid rgba(255, 255, 255, 0.4);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.5); border-top: 1px solid rgba(255, 255, 255, 0.4);`;
        return `<div style="${cardStyle}"><div style="${headerStyle}"><h3 style="margin:0; font-size: 18px; font-weight: 700;">${name}</h3><img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;"></div><div style="${bodyStyle}"><p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">المستلمون:</p>${isEditable ? `<textarea id="loc-rec" rows="3" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ccc; resize: none; box-sizing: border-box;">${item.recipients.join("\n")}</textarea>` : `<div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; min-height: 40px; font-size: 14px; line-height: 1.6;">${recipientsHtml || '<span style="color: #888;">لا يوجد مستلمين</span>'}</div>`}</div>${isEditable ? `<div style="${footerStyle}"><div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;"><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">اللون:</label><input id="loc-color" type="color" value="${item.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">الحجم:</label><input id="loc-radius" type="number" value="${item.radius}" min="5" max="5000" step="5" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box;"></div></div><div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px;">شفافية التعبئة: <span id="loc-opacity-val">${Math.round(item.fillOpacity * 100)}%</span></label><input id="loc-opacity" type="range" min="0" max="100" value="${Math.round(item.fillOpacity * 100)}" style="width:100%;"></div><div style="display:flex;gap:8px; flex-wrap: wrap;"><button id="loc-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 100px;">حفظ</button><button id="loc-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">حذف</button><button id="loc-close" style="flex:1;background:rgba(0,0,0,0.1);color:#333;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">إغلاق</button></div></div>` : ''}</div>`;
    }

    attachCardEvents(item, hoverOnly) {
        const closeBtn = document.getElementById("loc-close");
        if (closeBtn) closeBtn.addEventListener("click", () => { if (this.infoWin) this.infoWin.close(); this.cardPinned = false; });
        if (hoverOnly || !MAP.editMode) return;
        const saveBtn = document.getElementById("loc-save"); const delBtn = document.getElementById("loc-delete");
        const recEl = document.getElementById("loc-rec"); const colEl = document.getElementById("loc-color"); const radEl = document.getElementById("loc-radius");
        const opEl = document.getElementById("loc-opacity"); const opValEl = document.getElementById("loc-opacity-val");
        if(opEl) { opEl.addEventListener("input", () => { if(opValEl) opValEl.textContent = opEl.value + "%"; }); }
        if (saveBtn) saveBtn.addEventListener("click", () => { item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean); item.color = colEl.value; item.radius = Utils.clamp(+radEl.value, 5, 5000); item.fillOpacity = Utils.clamp(+opEl.value, 0, 100) / 100; item.circle.setOptions({ fillColor: item.color, strokeColor: item.color, radius: item.radius, fillOpacity: item.fillOpacity }); bus.emit("persist"); this.infoWin.close(); this.cardPinned = false; bus.emit("toast", "تم حفظ التعديلات"); });
        if (delBtn) delBtn.addEventListener("click", () => { if (!confirm(`حذف "${item.name}"؟`)) return; item.marker.map = null; item.circle.setMap(null); this.items = this.items.filter(x => x.id !== item.id); this.infoWin.close(); this.cardPinned = false; bus.emit("persist"); bus.emit("toast", "تم حذف الموقع"); });
    }

    exportState() { return this.items.map(it => ({ id: it.id, name: it.name, lat: typeof it.marker.position.lat === 'function' ? it.marker.position.lat() : it.marker.position.lat, lng: typeof it.marker.position.lng === 'function' ? it.marker.position.lng() : it.marker.position.lng, color: it.color, radius: it.radius, fillOpacity: it.fillOpacity, recipients: it.recipients })); }
    applyState(state) { if (!state || !state.locations) return; this.items.forEach(it => { it.marker.map = null; it.circle.setMap(null); }); this.items = []; state.locations.forEach(loc => this.addItem(loc)); }
}
const LOCATIONS = new LocationManager();

/* ============================================================
   RouteManager — إدارة المسارات + بطاقات Glass (تصميم موحد)
============================================================ */
/* ============================================================
   RouteManager — إدارة المسارات (محدث لدعم عدة مسارات)
============================================================ */
class RouteManager {

    constructor() {
        this.routes = []; this.map = null; this.shareMode = false; this.editMode = true;
        this.directionsService = null; this.infoWin = null; this.cardPinned = false; this.activeRouteIndex = -1;
        bus.on("map:ready", map => { this.map = map; this.shareMode = MAP.shareMode; this.editMode = MAP.editMode; this.onMapReady(); });
        bus.on("state:load", st => this.applyState(st));
        bus.on("state:save", () => this.exportState());
    }

    onMapReady() {
        this.map.addListener("click", e => {
            // لا تفعل شيئًا إذا لم نكن في وضع إضافة مسار
            if (!MAP.modeRouteAdd) return;
            if (this.shareMode) return;

            // إذا لم يكن هناك مسار نشط، قم بإنشاء واحد جديد
            if (this.activeRouteIndex === -1) {
                this.createNewRoute();
            }

            // أضف النقطة إلى المسار النشط
            this.addPointToRoute(this.activeRouteIndex, e.latLng);
        });

        this.map.addListener("click", () => {
            if (!this.cardPinned && this.infoWin) this.infoWin.close();
            this.cardPinned = false;
        });
    }

    // دالة جديدة لبدء تسلسل مسار جديد
    startNewRouteSequence() {
        this.activeRouteIndex = -1; // إعادة تعيين المسار النشط
        UI.showRouteAddingUI();   // تحديث واجهة المستخدم
    }

    // دالة جديدة لإنهاء المسار الحالي
    finishCurrentRoute() {
        this.activeRouteIndex = -1; // إعادة تعيين المسار النشط
        UI.showDefaultUI();       // إعادة الواجهة إلى وضعها الافتراضي
    }

    createNewRoute() {
        const route = { id: "rt" + Date.now(), points: [], color: "#3344ff", weight: 6, opacity: 0.95, distance: 0, duration: 0, overview: null, poly: null, stops: [], notes: "" };
        this.routes.push(route);
        this.activeRouteIndex = this.routes.length - 1;
        return route;
    }

    addPointToRoute(routeIndex, latLng) {
        const rt = this.routes[routeIndex]; rt.points.push(latLng);
        const stop = this.createStopMarker(latLng, routeIndex, rt.points.length - 1); rt.stops.push(stop);
        if (rt.points.length >= 2) this.requestRoute(routeIndex); else bus.emit("persist");
    }

    createStopMarker(pos, routeIndex, idx) {
        const rt = this.routes[routeIndex];
        const el = document.createElement("div"); el.style.cssText = "width:22px;height:22px;background:white;border-radius:50%;border:2px solid "+rt.color+";display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;z-index:101;"; el.textContent = idx + 1;
        const marker = new google.maps.marker.AdvancedMarkerElement({ position: pos, map: this.map, content: el, gmpDraggable: !this.shareMode });
        marker.addListener("dragend", () => { rt.points[idx] = marker.position; this.requestRoute(routeIndex); bus.emit("persist"); });
        marker.addListener("contextmenu", () => { if (this.shareMode) return; this.removePoint(routeIndex, idx); });
        return marker;
    }

    removePoint(routeIndex, idx) {
        const rt = this.routes[routeIndex]; if (rt.stops[idx]) rt.stops[idx].map = null;
        rt.points.splice(idx, 1); rt.stops.splice(idx, 1); rt.stops.forEach((m, i) => { m.content.textContent = i + 1; });
        if (rt.points.length >= 2) this.requestRoute(routeIndex); else this.clearRoute(routeIndex);
        bus.emit("persist");
    }

    removeRoute(routeIndex) {
        const rt = this.routes[routeIndex]; if (rt.poly) rt.poly.setMap(null); rt.stops.forEach(s => s.map = null);
        this.routes.splice(routeIndex, 1); this.activeRouteIndex = -1; if (this.infoWin) this.infoWin.close(); this.cardPinned = false; bus.emit("persist");
    }

    clearRoute(routeIndex) { const rt = this.routes[routeIndex]; if (rt.poly) rt.poly.setMap(null); rt.poly = null; rt.overview = null; rt.distance = 0; rt.duration = 0; }
    requestRoute(routeIndex) { if (!this.directionsService) this.directionsService = new google.maps.DirectionsService(); const rt = this.routes[routeIndex]; const pts = rt.points; if (pts.length < 2) return; const req = { origin: pts[0], destination: pts[pts.length - 1], travelMode: google.maps.TravelMode.DRIVING }; if (pts.length > 2) req.waypoints = pts.slice(1, -1).map(p => ({ location: p, stopover: true })); this.directionsService.route(req, (res, status) => { if (status !== "OK") { bus.emit("toast", "تعذر حساب المسار"); return; } const r = res.routes[0]; rt.overview = r.overview_polyline; rt.distance = r.legs.reduce((s, l) => s + l.distance.value, 0); rt.duration = r.legs.reduce((s, l) => s + l.duration.value, 0); this.renderRoute(routeIndex); bus.emit("persist"); }); }
    renderRoute(routeIndex) { const rt = this.routes[routeIndex]; if (rt.poly) rt.poly.setMap(null); let path = rt.overview ? google.maps.geometry.encoding.decodePath(rt.overview) : rt.points; rt.poly = new google.maps.Polyline({ map: this.map, path, strokeColor: rt.color, strokeWeight: rt.weight, strokeOpacity: rt.opacity, zIndex: 10 }); rt.poly.addListener("mouseover", () => { if (!this.cardPinned) this.openRouteCard(routeIndex, true); }); rt.poly.addListener("mouseout", () => { if (!this.cardPinned && this.infoWin) setTimeout(() => { if (!this.cardPinned && this.infoWin) this.infoWin.close(); }, 150); }); rt.poly.addListener("click", () => this.openRouteCard(routeIndex, false)); }

    openRouteCard(routeIndex, hoverOnly = false) {
        const rt = this.routes[routeIndex]; const dist = Utils.formatDistance(rt.distance); const dur = Utils.formatDuration(rt.duration); const notes = Utils.escapeHTML(rt.notes || ""); const isEditable = !hoverOnly && MAP.editMode;
        const cardStyle = `background: rgba(30, 30, 30, 0.75); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2); padding: 0; color: #f0f0f0; direction: rtl; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4); max-width: 95vw; width: auto; box-sizing: border-box; overflow: hidden;`;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(0, 0, 0, 0.3); border-bottom: 1px solid rgba(255, 255, 255, 0.1);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1);`;
        const html = `<div style="${cardStyle}"><div style="${headerStyle}"><h3 style="margin:0; font-size: 18px; font-weight: 700;">معلومات المسار ${routeIndex + 1}</h3><img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;"></div><div style="${bodyStyle}"><div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px;"><span><b>المسافة:</b> ${dist}</span><span><b>الوقت:</b> ${dur}</span></div><p style="margin: 0 0 8px 0; font-size: 14px; color: #ccc;">ملاحظات:</p>${isEditable ? `<textarea id="route-notes" rows="3" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; resize: none; box-sizing: border-box;">${notes}</textarea>` : `<div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 8px; min-height: 40px; font-size: 14px; line-height: 1.6;">${notes || '<span style="color: #888;">لا توجد ملاحظات</span>'}</div>`}</div>${isEditable ? `<div style="${footerStyle}"><div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;"><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">اللون:</label><input id="rt-color" type="color" value="${rt.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">السماكة: <span id="rt-weight-val">${rt.weight}px</span></label><input id="rt-weight" type="range" min="1" max="15" value="${rt.weight}" style="width:100%;"></div></div><div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px;">شفافية الخط: <span id="rt-opacity-val">${Math.round(rt.opacity * 100)}%</span></label><input id="rt-opacity" type="range" min="0" max="100" value="${Math.round(rt.opacity * 100)}" style="width:100%;"></div><div style="display:flex;gap:8px; flex-wrap: wrap;"><button id="route-save" style="flex:2;background:#34a853;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 100px;">حفظ</button><button id="route-close" style="flex:1;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">إغلاق</button></div></div>` : ''}</div>`;
        if (!this.infoWin) this.infoWin = new google.maps.InfoWindow({ maxWidth: 400 });
        this.infoWin.setContent(html);
        this.infoWin.setPosition(this.getRouteCenter(rt));
        this.infoWin.open({ map: this.map });
        if (!hoverOnly) this.cardPinned = true;
        google.maps.event.addListenerOnce(this.infoWin, "domready", () => this.attachRouteCardEvents(routeIndex, hoverOnly));
    }

    getRouteCenter(rt) { const path = rt.poly.getPath(); const bounds = new google.maps.LatLngBounds(); for (let i = 0; i < path.getLength(); i++) bounds.extend(path.getAt(i)); return bounds.getCenter(); }
    attachRouteCardEvents(routeIndex, hoverOnly) {
        if (hoverOnly) return;
        const rt = this.routes[routeIndex];
        const saveBtn = document.getElementById("route-save"); const closeBtn = document.getElementById("route-close"); const notesEl = document.getElementById("route-notes");
        const colEl = document.getElementById("rt-color"); const weightEl = document.getElementById("rt-weight"); const opEl = document.getElementById("rt-opacity");
        const weightValEl = document.getElementById("rt-weight-val"); const opValEl = document.getElementById("rt-opacity-val");
        if(weightEl) { weightEl.addEventListener("input", () => { if(weightValEl) weightValEl.textContent = weightEl.value + "px"; }); }
        if(opEl) { opEl.addEventListener("input", () => { if(opValEl) opValEl.textContent = opEl.value + "%"; }); }
        if (saveBtn) saveBtn.addEventListener("click", () => { rt.notes = notesEl.value.trim(); rt.color = colEl.value; rt.weight = Utils.clamp(+weightEl.value, 1, 15); rt.opacity = Utils.clamp(+opEl.value, 0, 100) / 100; this.renderRoute(routeIndex); bus.emit("persist"); this.infoWin.close(); this.cardPinned = false; bus.emit("toast", "تم حفظ إعدادات المسار"); });
        if (closeBtn) closeBtn.addEventListener("click", () => { this.infoWin.close(); this.cardPinned = false; });
    }

    exportState() { return this.routes.map(rt => ({ id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes, points: rt.points.map(p => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng })) })); }
    applyState(state) { if (!state || !state.routes) return; this.routes.forEach(rt => { if (rt.poly) rt.poly.setMap(null); rt.stops.forEach(s => s.map = null); }); this.routes = []; state.routes.forEach(rt => { const newRoute = { id: rt.id, color: rt.color, weight: rt.weight, opacity: rt.opacity, distance: rt.distance, duration: rt.duration, overview: rt.overview, notes: rt.notes || "", points: rt.points.map(p => new google.maps.LatLng(p.lat, p.lng)), poly: null, stops: [] }; this.routes.push(newRoute); newRoute.points.forEach((pt, i) => { const stop = this.createStopMarker(pt, this.routes.length - 1, i); newRoute.stops.push(stop); }); this.renderRoute(this.routes.length - 1); }); }
}

const ROUTES = new RouteManager();

/* ============================================================
   PolygonManager — إدارة المضلعات + بطاقات Glass
============================================================ */
/* ============================================================
   PolygonManager — إدارة المضلعات + بطاقات Glass (مُصلح)
============================================================ */
/* ============================================================
   PolygonManager — إدارة المضلعات + بطاقات Glass (مُصلح)
============================================================ */
class PolygonManager {

    constructor() {
        this.polygons = [];
        this.map = null;
        this.shareMode = false;
        this.editMode = true;
        this.infoWin = null;
        this.cardPinned = false;
        this.activePolygonIndex = -1;

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
            // لا تفعل شيئًا إذا لم نكن في وضع إضافة مضلع
            if (!MAP.modePolygonAdd) return;
            if (this.shareMode) return;

            if (this.activePolygonIndex === -1) {
                this.createNewPolygon();
            }
            this.addPointToPolygon(this.activePolygonIndex, e.latLng);
        });

        this.map.addListener("click", () => {
            if (!this.cardPinned && this.infoWin) {
                this.infoWin.close();
            }
            this.cardPinned = false;
        });
    }

    // تم تصحيح هذه الدالة
    startPolygonSequence() {
        this.activePolygonIndex = -1;
        // تم حذف الاستدعاء الخاطئ لدالة غير موجودة
        // UI.showPolygonAddingUI(); // هذا السطر كان يسبب الخطأ
    }

    finishCurrentPolygon() {
        if (this.activePolygonIndex === -1) return;
        
        const poly = this.polygons[this.activePolygonIndex];

        // إزالة الخط المؤقت والعلامات المؤقتة
        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.markers.forEach(m => m.map = null);

        // إنشاء المضلع النهائي إذا كان به 3 نقاط على الأقل
        if (poly.points.length >= 3) {
            poly.polygon = new google.maps.Polygon({
                paths: poly.points,
                map: this.map,
                strokeColor: poly.color,
                strokeOpacity: poly.strokeOpacity,
                strokeWeight: poly.strokeWeight,
                fillColor: poly.color,
                fillOpacity: poly.fillOpacity,
                zIndex: 5
            });

            poly.polygon.addListener("mouseover", () => { if (!this.cardPinned) this.openCard(this.polygons.indexOf(poly), true); });
            poly.polygon.addListener("mouseout", () => { if (!this.cardPinned && this.infoWin) setTimeout(() => { if (!this.cardPinned && this.infoWin) this.infoWin.close(); }, 150); });
            poly.polygon.addListener("click", () => this.openCard(this.polygons.indexOf(poly), false));
            
            bus.emit("persist");
        } else {
            // إذا كان أقل من 3 نقاط، احذف المضلع غير المكتمل
            this.polygons.pop();
        }

        this.activePolygonIndex = -1;
    }

    createNewPolygon() {
        const polygon = {
            id: "poly" + Date.now(),
            name: "مضلع جديد",
            points: [],
            color: "#ff9800",
            strokeWeight: 2,
            strokeOpacity: 0.8,
            fillOpacity: 0.35,
            polygon: null,
            markers: [],
            activePolyline: null
        };
        this.polygons.push(polygon);
        this.activePolygonIndex = this.polygons.length - 1;
        return polygon;
    }

    addPointToPolygon(polyIndex, latLng) {
        const poly = this.polygons[polyIndex];
        poly.points.push(latLng);

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: latLng,
            map: this.map,
            content: this.buildVertexMarkerContent(poly.color)
        });
        poly.markers.push(marker);

        if (poly.activePolyline) poly.activePolyline.setMap(null);
        poly.activePolyline = new google.maps.Polyline({
            path: poly.points,
            map: this.map,
            strokeColor: poly.color,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            zIndex: 10
        });
    }

    buildVertexMarkerContent(color) {
        const el = document.createElement("div");
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.background = "white";
        el.style.border = `2px solid ${color}`;
        return el;
    }

    openCard(polyIndex, hoverOnly = false) {
        const poly = this.polygons[polyIndex];
        const isEditable = !hoverOnly && MAP.editMode;
        const cardStyle = `background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8); border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.5); padding: 0; color: #333; direction: rtl; box-shadow: 0 8px 32px rgba(31, 38, 135, 0.2); max-width: 95vw; width: auto; box-sizing: border-box; overflow: hidden;`;
        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.5); border-bottom: 1px solid rgba(255, 255, 255, 0.4);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.5); border-top: 1px solid rgba(255, 255, 255, 0.4);`;
        const html = `<div style="${cardStyle}"><div style="${headerStyle}"><h3 style="margin:0; font-size: 18px; font-weight: 700;">${Utils.escapeHTML(poly.name)}</h3><img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;"></div>${isEditable ? `<div style="${bodyStyle}"><div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px;">الاسم:</label><input id="poly-name" type="text" value="${Utils.escapeHTML(poly.name)}" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box;"></div><div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;"><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">اللون:</label><input id="poly-color" type="color" value="${poly.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div><div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">سماكة الخط:</label><input id="poly-stroke" type="number" value="${poly.strokeWeight}" min="1" max="10" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box;"></div></div><div style="margin-bottom:14px;"><label style="font-size:12px; display:block; margin-bottom:4px;">شفافية التعبئة: <span id="poly-fill-opacity-val">${Math.round(poly.fillOpacity * 100)}%</span></label><input id="poly-fill-opacity" type="range" min="0" max="100" value="${Math.round(poly.fillOpacity * 100)}" style="width:100%;"></div></div><div style="${footerStyle}"><div style="display:flex;gap:8px; flex-wrap: wrap;"><button id="poly-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 100px;">حفظ</button><button id="poly-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">حذف</button><button id="poly-close" style="flex:1;background:rgba(0,0,0,0.1);color:#333;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">إغلاق</button></div></div>` : ''}</div>`;
        if (!this.infoWin) this.infoWin = new google.maps.InfoWindow({ maxWidth: 400 });
        this.infoWin.setContent(html);
        this.infoWin.setPosition(this.getPolygonCenter(poly));
        this.infoWin.open({ map: this.map });
        if (!hoverOnly) this.cardPinned = true;
        google.maps.event.addListenerOnce(this.infoWin, "domready", () => this.attachCardEvents(polyIndex, hoverOnly));
    }
    
    getPolygonCenter(poly) { const bounds = new google.maps.LatLngBounds(); poly.points.forEach(pt => bounds.extend(pt)); return bounds.getCenter(); }
    attachCardEvents(polyIndex, hoverOnly) {
        if (hoverOnly) return;
        const poly = this.polygons[polyIndex];
        const saveBtn = document.getElementById("poly-save"); const delBtn = document.getElementById("poly-delete"); const closeBtn = document.getElementById("poly-close");
        const nameEl = document.getElementById("poly-name"); const colEl = document.getElementById("poly-color"); const strokeEl = document.getElementById("poly-stroke");
        const fillOpEl = document.getElementById("poly-fill-opacity"); const fillOpValEl = document.getElementById("poly-fill-opacity-val");
        if(fillOpEl) { fillOpEl.addEventListener("input", () => { if(fillOpValEl) fillOpValEl.textContent = fillOpEl.value + "%"; }); }
        if (saveBtn) saveBtn.addEventListener("click", () => { poly.name = nameEl.value.trim(); poly.color = colEl.value; poly.strokeWeight = Utils.clamp(+strokeEl.value, 1, 10); poly.fillOpacity = Utils.clamp(+fillOpEl.value, 0, 100) / 100; poly.polygon.setOptions({ fillColor: poly.color, strokeColor: poly.color, strokeWeight: poly.strokeWeight, fillOpacity: poly.fillOpacity }); bus.emit("persist"); this.infoWin.close(); this.cardPinned = false; bus.emit("toast", "تم حفظ تعديلات المضلع"); });
        if (delBtn) delBtn.addEventListener("click", () => { if (!confirm(`حذف "${poly.name}"؟`)) return; poly.polygon.setMap(null); this.polygons = this.polygons.filter(p => p.id !== poly.id); this.infoWin.close(); this.cardPinned = false; bus.emit("persist"); bus.emit("toast", "تم حذف المضلع"); });
        if (closeBtn) closeBtn.addEventListener("click", () => { this.infoWin.close(); this.cardPinned = false; });
    }

    exportState() { return this.polygons.filter(p => p.polygon).map(poly => ({ id: poly.id, name: poly.name, color: poly.color, strokeWeight: poly.strokeWeight, strokeOpacity: poly.strokeOpacity, fillOpacity: poly.fillOpacity, points: poly.points.map(p => ({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng })) })); }
    applyState(state) { if (!state || !state.polygons) return; this.polygons.forEach(p => { if (p.polygon) p.polygon.setMap(null); }); this.polygons = []; state.polygons.forEach(polyData => { const newPoly = { id: polyData.id, name: polyData.name, color: polyData.color, strokeWeight: polyData.strokeWeight, strokeOpacity: polyData.strokeOpacity, fillOpacity: polyData.fillOpacity, points: polyData.points.map(p => new google.maps.LatLng(p.lat, p.lng)), polygon: null, markers: [], activePolyline: null }; newPoly.polygon = new google.maps.Polygon({ paths: newPoly.points, map: this.map, strokeColor: newPoly.color, strokeOpacity: newPoly.strokeOpacity, strokeWeight: newPoly.strokeWeight, fillColor: newPoly.color, fillOpacity: newPoly.fillOpacity, zIndex: 5 }); newPoly.polygon.addListener("mouseover", () => { if (!this.cardPinned) this.openCard(this.polygons.length, true); }); newPoly.polygon.addListener("mouseout", () => { if (!this.cardPinned && this.infoWin) setTimeout(() => { if (!this.cardPinned && this.infoWin) this.infoWin.close(); }, 150); }); newPoly.polygon.addListener("click", () => this.openCard(this.polygons.length, false)); this.polygons.push(newPoly); }); }
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
   UIManager — واجهة المستخدم
============================================================ */

/* ============================================================
   UIManager — واجهة المستخدم (النسخة المصححة والكاملة)
============================================================ */
class UIManager {

    constructor() {
        this.logo = "/img/logo.png";
        this.btnRoadmap = document.getElementById("btn-roadmap");
        this.btnSatellite = document.getElementById("btn-satellite");
        this.btnTraffic = document.getElementById("btn-traffic");
        this.btnAdd = document.getElementById("btn-add");
        this.btnRoute = document.getElementById("btn-route");
        this.btnPolygon = document.getElementById("btn-polygon");
        this.btnDrawFinish = document.getElementById("btn-draw-finish");
        this.btnRouteClear = document.getElementById("btn-route-clear");
        this.btnEdit = document.getElementById("btn-edit");

        this.modeBadge = document.getElementById("mode-badge");
        this.toastElement = document.getElementById("toast");
        this.toastTimer = null;

        bus.on("map:ready", () => this.initializeUI());
        bus.on("toast", msg => this.showToast(msg));
    }

    initializeUI() {
        if (MAP.shareMode) this.applyShareMode();

        // أحداث الخريطة
        if (this.btnRoadmap) {
            this.btnRoadmap.addEventListener("click", () => {
                MAP.setRoadmap();
                this.btnRoadmap.setAttribute("aria-pressed","true");
                this.btnSatellite.setAttribute("aria-pressed","false");
                this.showToast("تم التبديل لخريطة الطرق");
            });
        }

        if (this.btnSatellite) {
            this.btnSatellite.addEventListener("click", () => {
                MAP.setSatellite();
                this.btnRoadmap.setAttribute("aria-pressed","false");
                this.btnSatellite.setAttribute("aria-pressed","true");
                this.showToast("تم التبديل للأقمار الصناعية");
            });
        }

        if (this.btnTraffic) {
            this.btnTraffic.addEventListener("click", () => {
                MAP.toggleTraffic();
                const active = this.btnTraffic.getAttribute("aria-pressed") === "true";
                this.btnTraffic.setAttribute("aria-pressed", active ? "false" : "true");
            });
        }

        // أحداث التحرير
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

        // --- منطق الأزرار المُصلح ---
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

    // دالة لتنظيم أوضاع الرسم (تم تصحيحها)
    setActiveMode(mode) {
        // إيقاف جميع الأوضاع أولاً
        MAP.modeAdd = false;
        MAP.modeRouteAdd = false;
        MAP.modePolygonAdd = false;

        // إعادة تعيين حالة الأزرار
        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        if (this.btnRoute) this.btnRoute.setAttribute("aria-pressed", "false");
        if (this.btnPolygon) this.btnPolygon.setAttribute("aria-pressed", "false");

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
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة نقاط المسار الأول");
                break;
            case 'polygon':
                // تم تصحيح هذا الجزء
                POLYGONS.startPolygonSequence();
                MAP.modePolygonAdd = true; // <-- هذا السطر كان مفقودًا
                this.showDrawFinishUI();
                this.showToast("اضغط لإضافة رؤوس المضلع، ثم 'إنهاء الرسم'");
                break;
        }
    }

    applyShareMode() {
        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
        if (this.btnRouteClear) this.btnRouteClear.style.display = "none";
        if (this.btnEdit) this.btnEdit.style.display = "none";
        this.updateModeBadge("view");
    }

    showDrawFinishUI() {
        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnPolygon) this.btnPolygon.style.display = "none";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "inline-block";
    }
    
    showDefaultUI() {
        if (this.btnRoute) this.btnRoute.style.display = "inline-block";
        if (this.btnPolygon) this.btnPolygon.style.display = "inline-block";
        if (this.btnDrawFinish) this.btnDrawFinish.style.display = "none";
    }

    updateModeBadge(forceMode=null) {
        if (!this.modeBadge) return;
        const mode = forceMode || (MAP.editMode ? "edit" : "view");
        this.modeBadge.style.display = "block";
        this.modeBadge.textContent = (mode === "edit") ? "وضع التحرير" : "وضع العرض";
        this.modeBadge.className = "";
        this.modeBadge.classList.add("badge", mode);
    }

    showToast(message) {
        if (!this.toastElement) return;
        this.toastElement.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><img src="${this.logo}" style="width:22px;height:22px;border-radius:6px;opacity:0.9;"><span>${message}</span></div>`;
        this.toastElement.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { this.toastElement.classList.remove("show"); }, 2600);
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
