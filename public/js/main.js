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
     * Base64 URL-Safe encoding to avoid iOS/Safari corruptions
     */
    b64uEncode(str) {
        try {
            const bytes = new TextEncoder().encode(str);
            let bin = "";
            bytes.forEach(b => bin += String.fromCharCode(b));

            return btoa(bin)
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");  // no padding
        } catch (e) {
            console.error("Encoding error", e);
            return "";
        }
    },

    /* 
     * Base64 URL-safe decode tolerant to iOS URL mangling
     */
    b64uDecode(str) {
        try {
            if (!str) return null;

            str = str.replace(/[^A-Za-z0-9\-_]/g, "");

            const pad = (4 - (str.length % 4)) % 4;
            str += "=".repeat(pad);

            const normal = str
                .replace(/-/g, "+")
                .replace(/_/g, "/");

            const decoded = atob(normal);

            const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (e) {
            console.error("Decoding error", e);
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
   Mobile URL Recovery Logic — استعادة الروابط على الجوال
============================================================ */

class MobileURLFixer {

    static async tryFixURL() {

        const url = window.location.href;
        const hasX = url.includes("?x=");

        if (hasX) return; // الرابط صحيح

        // iOS أحياناً يحذف الـ ?x عند فتح الرابط من واتساب
        // نحاول جلب النسخة الكاملة من الـ clipboard خلال أول ثانية

        try {
            const clip = await navigator.clipboard.readText();

            if (clip.includes("?x=")) {
                // إعادة تحميل بالرابط الصحيح
                window.location.replace(clip.trim());
            }

        } catch (e) {
            // الأجهزة التي تمنع قراءة clipboard
            console.log("No clipboard access", e);
        }
    }
}

// نجرب الإصلاح قبل تحميل الخريطة
MobileURLFixer.tryFixURL();



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
        this.map.addListener("click", () => { if (!this.cardPinned && this.infoWin) this.infoWin.close(); this.cardPinned = false; });
    }

    loadDefaultLocations() {
        const LOCS = [{ name: "نقطة الحبيب", lat: 24.709466574642548, lng:  46.59394349401716 }, { name: "نقطة راس النعامة", lat: 24.710367751013603, lng:  46.572909747949716 }, { name: "نقطة دوار صفار", lat: 24.72490650528227, lng:  46.57345442507346 }, { name: "نقطة بيت مبارك", lat: 24.73258723792855, lng:  46.578281049954626 }, { name: "غصيبة", lat: 24.745868749375994, lng:  46.56062200182871 }, { name: "دوار الروقية", lat: 24.741955461299774, lng:  46.5626435899081 }, { name: "مواقف الأمن", lat: 24.73789331677763, lng:  46.577883707394676 }, { name: "كار بارك", lat: 24.738312836363594, lng:  46.577887233188875 }, { name: "م 9", lat: 24.738863654773827, lng: 46.580461229561074 }, { name: "بوابة سمحان", lat: 24.742132, lng: 46.569503 }, { name: "منطقة سمحان", lat: 24.740913, lng: 46.571891 }, { name: "دوار البجيري", lat: 24.737521, lng: 46.574069 }, { name: "مسار المشاة عذيبة", lat: 24.73615951318394, lng: 46.576994024788895 }, { name: "نقطة فرز الشلهوب", lat: 24.73521034223403, lng: 46.57782136115348 }, { name: "مسار المشاة المديد", lat: 24.735478057536785, lng: 46.581036921033615 }, { name: "ميدان الملك سلمان", lat: 24.736162553141824, lng: 46.58399121850484 }, { name: "دوار الضوء الخافت", lat: 24.73977210676454, lng: 46.58359282165422 }, { name: "دوار البلدية", lat: 24.739257985106182, lng: 46.58175727235508 }, { name: "إشارة البجيري", lat: 24.737662, lng: 46.575429 }];
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
        if (!this.infoWin) this.infoWin = new google.maps.InfoWindow({ maxWidth: 400, pixelOffset: new google.maps.Size(0, -28) });
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

        // === تعديل التصميم ليكون متجاوبًا ===
        const cardStyle = `
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px) saturate(1.8);
            -webkit-backdrop-filter: blur(20px) saturate(1.8);
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            padding: 0;
            color: #333;
            direction: rtl;
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.2);
            max-width: 95vw; /* عرض متجاوب */
            width: auto;    /* عرض مرن */
            box-sizing: border-box; /* لضمان احتساب الحجم بشكل صحيح */
            overflow: hidden;
        `;
        // ==================================

        const headerStyle = `display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: rgba(255, 255, 255, 0.5); border-bottom: 1px solid rgba(255, 255, 255, 0.4);`;
        const bodyStyle = `padding: 20px;`;
        const footerStyle = `padding: 12px 20px; background: rgba(255, 255, 255, 0.5); border-top: 1px solid rgba(255, 255, 255, 0.4);`;

        return `
        <div style="${cardStyle}">
            <div style="${headerStyle}">
                <h3 style="margin:0; font-size: 18px; font-weight: 700;">${name}</h3>
                <img src="img/logo.png" style="width: 36px; height: 36px; border-radius: 8px;">
            </div>
            <div style="${bodyStyle}">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #555;">المستلمون:</p>
                ${isEditable ? `<textarea id="loc-rec" rows="3" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ccc; resize: none; box-sizing: border-box;">${item.recipients.join("\n")}</textarea>` : `<div style="background: rgba(0,0,0,0.05); padding: 8px; border-radius: 8px; min-height: 40px; font-size: 14px; line-height: 1.6;">${recipientsHtml || '<span style="color: #888;">لا يوجد مستلمين</span>'}</div>`}
            </div>
            ${isEditable ? `
                <div style="${footerStyle}">
                    <div style="display:flex; gap:10px; align-items:center; margin-bottom:14px; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">اللون:</label><input id="loc-color" type="color" value="${item.color}" style="width:100%;height:32px;border:none;border-radius:6px;cursor:pointer;"></div>
                        <div style="flex:1; min-width: 120px;"><label style="font-size:12px; display:block; margin-bottom:4px;">الحجم:</label><input id="loc-radius" type="number" value="${item.radius}" min="5" max="5000" step="5" style="width:100%;padding:7px;border-radius:6px;border:1px solid #ccc;box-sizing:border-box;"></div>
                    </div>
                    <div style="margin-bottom:14px;">
                        <label style="font-size:12px; display:block; margin-bottom:4px;">شفافية التعبئة: <span id="loc-opacity-val">${Math.round(item.fillOpacity * 100)}%</span></label>
                        <input id="loc-opacity" type="range" min="0" max="100" value="${Math.round(item.fillOpacity * 100)}" style="width:100%;">
                    </div>
                    <div style="display:flex;gap:8px; flex-wrap: wrap;">
                        <button id="loc-save" style="flex:2;background:#4285f4;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 100px;">حفظ</button>
                        <button id="loc-delete" style="flex:1;background:#e94235;color:white;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">حذف</button>
                        <button id="loc-close" style="flex:1;background:rgba(0,0,0,0.1);color:#333;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:600; min-width: 80px;">إغلاق</button>
                    </div>
                </div>
            ` : ''}
        </div>`;
    }

    attachCardEvents(item, hoverOnly) {
        const closeBtn = document.getElementById("loc-close");
        if (closeBtn) closeBtn.addEventListener("click", () => { if (this.infoWin) this.infoWin.close(); this.cardPinned = false; });
        if (hoverOnly || !MAP.editMode) return;
        const saveBtn = document.getElementById("loc-save"); const delBtn = document.getElementById("loc-delete");
        const recEl = document.getElementById("loc-rec"); const colEl = document.getElementById("loc-color"); const radEl = document.getElementById("loc-radius");
        const opEl = document.getElementById("loc-opacity"); const opValEl = document.getElementById("loc-opacity-val");
        if(opEl) { opEl.addEventListener("input", () => { if(opValEl) opValEl.textContent = opEl.value + "%"; }); }
        if (saveBtn) saveBtn.addEventListener("click", () => {
            item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean); item.color = colEl.value; item.radius = Utils.clamp(+radEl.value, 5, 5000); item.fillOpacity = Utils.clamp(+opEl.value, 0, 100) / 100;
            item.circle.setOptions({ fillColor: item.color, strokeColor: item.color, radius: item.radius, fillOpacity: item.fillOpacity });
            bus.emit("persist"); this.infoWin.close(); this.cardPinned = false; bus.emit("toast", "تم حفظ التعديلات");
        });
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
            locations: LOCATIONS.exportState()
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
    }
}

const STATE = new StateManager();




/* ============================================================
   ShareManager — محاولة اختصار + fallback تلقائي
============================================================ */
/* ============================================================
   ShareManager — نسخ آمن مع حل يدوي للجوال
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
        if (label) label.textContent = "جاري النسخ…";

        let finalUrl = longUrl;

        try {
            const api = "https://is.gd/create.php?format=json&url=" +
                        encodeURIComponent(longUrl);
            const res = await fetch(api);
            const data = await res.json();
            if (data && data.shorturl) {
                finalUrl = data.shorturl;
            }
        } catch (err) {
            console.error("is.gd error", err);
            finalUrl = longUrl;
        }

        // === محاولة النسخ الحديث، وإذا فشل نعرض النافذة اليدوية ===
        try {
            await navigator.clipboard.writeText(finalUrl);
            bus.emit("toast", "تم نسخ رابط المشاركة");
        } catch (err) {
            console.error("Clipboard copy failed, showing manual dialog.", err);
            this.showManualCopyDialog(finalUrl);
        }
        // ==========================================================

        this.btn.disabled = false;
        if (label) label.textContent = original || "مشاركة";
    }

    // دالة لعرض نافذة النسخ اليدوي
    showManualCopyDialog(url) {
        // إنشاء طبقة خلفية شفافة
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        // إنشاء صندوق المحتوى
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 90%;
            width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            text-align: center;
            direction: rtl;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 16px; color: #333;">تعذر النسخ التلقائي</h3>
            <p style="margin-bottom: 20px; color: #666; line-height: 1.5;">
                الرجاء الضغط مطولاً على الرابط أدناه واختيار "نسخ" من القائمة.
            </p>
            <textarea readonly style="
                width: 100%;
                height: 80px;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #ccc;
                font-size: 14px;
                text-align: center;
                resize: none;
                direction: ltr;
                box-sizing: border-box;
            ">${url}</textarea>
            <button id="manual-copy-close" style="
                margin-top: 20px;
                width: 100%;
                padding: 12px;
                background-color: #4285f4;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
            ">إغلاق</button>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // إضافة حدث للإغلاق
        document.getElementById('manual-copy-close').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // إغلاق عند الضغط على الخلفية
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }
}

const SHARE = new ShareManager();


/* ============================================================
   UIManager — واجهة المستخدم
============================================================ */
/* ============================================================
   UIManager — واجهة المستخدم (محدث لدعم عدة مسارات)
============================================================ */
class UIManager {

    constructor() {

        this.logo = "/img/logo.png";

        this.btnRoadmap    = document.getElementById("btn-roadmap");
        this.btnSatellite  = document.getElementById("btn-satellite");
        this.btnTraffic    = document.getElementById("btn-traffic");
        this.btnAdd        = document.getElementById("btn-add");
        this.btnRoute      = document.getElementById("btn-route");
        this.btnRouteFinish = document.getElementById("btn-route-finish"); // <-- إضافة: تعريف زر إنهاء المسار
        this.btnRouteClear = document.getElementById("btn-route-clear");
        this.btnEdit       = document.getElementById("btn-edit");

        this.modeBadge     = document.getElementById("mode-badge");

        this.toastElement  = document.getElementById("toast");
        this.toastTimer    = null;

        bus.on("map:ready", () => this.initializeUI());
        bus.on("toast", msg => this.showToast(msg));
    }

    initializeUI() {

        if (MAP.shareMode) this.applyShareMode();

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
                const active =
                    this.btnTraffic.getAttribute("aria-pressed") === "true";
                this.btnTraffic.setAttribute(
                    "aria-pressed", active ? "false" : "true"
                );
            });
        }

        if (this.btnEdit && !MAP.shareMode) {
            this.btnEdit.addEventListener("click", () => {
                MAP.editMode = !MAP.editMode;
                this.btnEdit.setAttribute("aria-pressed",
                    MAP.editMode ? "true" : "false");
                this.updateModeBadge();

                if (!MAP.editMode) {
                    MAP.modeAdd = false;
                    MAP.modeRouteAdd = false;
                    if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed","false");
                    if (this.btnRoute) this.btnRoute.setAttribute("aria-pressed","false");
                    // إعادة الواجهة إلى وضعها الافتراضي عند إيقاف التحرير
                    this.showDefaultUI();
                }
            });
        }

        if (this.btnAdd && !MAP.shareMode) {
            this.btnAdd.addEventListener("click", () => {
                if (!MAP.editMode)
                    return this.showToast("فعّل وضع التحرير");

                MAP.modeAdd = !MAP.modeAdd;
                MAP.modeRouteAdd = false;

                this.btnAdd.setAttribute("aria-pressed",
                    MAP.modeAdd ? "true" : "false");
                this.btnRoute.setAttribute("aria-pressed","false");

                MAP.setCursor(MAP.modeAdd ? "crosshair" : "grab");

                if (MAP.modeAdd)
                    this.showToast("اضغط على الخريطة لإضافة موقع");
            });
        }

        // <-- تعديل: تغيير منطق زر إضافة المسار
        if (this.btnRoute && !MAP.shareMode) {
            this.btnRoute.addEventListener("click", () => {

                if (!MAP.editMode)
                    return this.showToast("فعّل وضع التحرير");

                // بدء تسلسل مسار جديد بدلاً من التبديل
                ROUTES.startNewRouteSequence();
                this.showRouteAddingUI(); // تحديث الواجهة
                this.showToast("اضغط لإضافة نقاط المسار الأول");
            });
        }

        // <-- إضافة: حدث لزر إنهاء المسار
        if (this.btnRouteFinish && !MAP.shareMode) {
            this.btnRouteFinish.addEventListener("click", () => {
                ROUTES.finishCurrentRoute();
                this.showDefaultUI(); // إعادة الواجهة
                this.showToast("تم إنهاء المسار، يمكنك البدء في مسار جديد");
            });
        }

        if (this.btnRouteClear && !MAP.shareMode) {
            this.btnRouteClear.addEventListener("click", () => {
                if (ROUTES.activeRouteIndex === -1)
                    return this.showToast("لا يوجد مسار نشط لحذفه");

                if (!confirm("حذف المسار الحالي؟")) return;

                ROUTES.removeRoute(ROUTES.activeRouteIndex);
                this.showDefaultUI(); // إعادة الواجهة بعد الحذف
                this.showToast("تم حذف المسار");
            });
        }

        this.updateModeBadge();
    }

    applyShareMode() {

        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnRouteFinish) this.btnRouteFinish.style.display = "none"; // <-- إضافة: إخفاء الزر الجديد في وضع المشاركة
        if (this.btnRouteClear) this.btnRouteClear.style.display = "none";
        if (this.btnEdit) this.btnEdit.style.display = "none";

        this.updateModeBadge("view");
    }

    // <-- إضافة: دالة لتحديث الواجهة عند بدء مسار جديد
    showRouteAddingUI() {
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnRouteFinish) this.btnRouteFinish.style.display = "inline-block";
        if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed", "false");
        MAP.modeAdd = false;
        MAP.modeRouteAdd = true;
        MAP.setCursor("cell");
    }

    // <-- إضافة: دالة لإعادة الواجهة إلى وضعها الافتراضي
    showDefaultUI() {
        if (this.btnRoute) this.btnRoute.style.display = "inline-block";
        if (this.btnRouteFinish) this.btnRouteFinish.style.display = "none";
        MAP.modeRouteAdd = false;
        MAP.setCursor("grab");
    }

    updateModeBadge(forceMode=null) {

        if (!this.modeBadge) return;

        const mode =
            forceMode || (MAP.editMode ? "edit" : "view");

        this.modeBadge.style.display = "block";
        this.modeBadge.textContent =
            (mode === "edit") ? "وضع التحرير" : "وضع العرض";

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
