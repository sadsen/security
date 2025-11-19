'use strict';

/* ============================================================
   Diriyah Security Map – v21.0
   • إصلاح حفظ/تحميل الحالة
   • بطاقات Glass للمواقع والمسارات (Hover + Click + Pin)
   • دعم تعدد المسارات بالكامل
   • إصلاح وضع المشاركة + أدوات التحرير
   • تحسين Directions + Polyline Rendering
   ============================================================ */


/* ------------------------------------------------------------
   Event Bus — ربط الوحدات ببعض (Pub/Sub)
------------------------------------------------------------ */
window.initMap = function () {
    if (window.MapController && typeof window.MapController.init === 'function') {
        window.MapController.init();
    } else {
        console.error("MapController غير جاهز بعد.");
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
            this.events[event].forEach(handler => handler(data));
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
            const bytes = new TextEncoder().encode(str);
            const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
            return btoa(binary)
                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (e) {
            console.error("Encoding Error:", e);
            return '';
        }
    },

    b64uDecode(str) {
        try {
            str = str.replace(/[^A-Za-z0-9\-_]/g, '');
            const padded = str + "=".repeat((4 - str.length % 4) % 4);
            const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
            const bytes = Uint8Array.from(decoded.split('').map(c => c.charCodeAt(0)));
            return new TextDecoder().decode(bytes);
        } catch (e) {
            console.error("Decoding Error:", e);
            return null;
        }
    },

    formatDistance(meters) {
        if (!meters) return "0 م";
        if (meters < 1000) return meters.toFixed(0) + " م";
        return (meters / 1000).toFixed(2) + " كم";
    },

    formatDuration(seconds) {
        if (!seconds) return "0 دقيقة";
        const min = Math.round(seconds / 60);
        if (min < 60) return min + " دقيقة";
        const hr = Math.floor(min / 60);
        const rem = min % 60;
        return `${hr} ساعة ${rem} دقيقة`;
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

        console.log("Booting Diriyah Security Map v21.0");

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

    setRoadmap() {
        this.map.setMapTypeId("roadmap");
    }

    setSatellite() {
        this.map.setMapTypeId("hybrid");
    }

    toggleTraffic() {
        if (this.trafficLayer.getMap()) {
            this.trafficLayer.setMap(null);
        } else {
            this.trafficLayer.setMap(this.map);
        }
    }

    setCursor(c) {
        this.map.setOptions({ draggableCursor: c });
    }
}

const MAP = new MapController();




/* ============================================================
   LocationManager — إدارة المواقع + بطاقات Glass
============================================================ */
class LocationManager {

    constructor() {

        this.items = [];
        this.map = null;

        this.shareMode = false;
        this.editMode = true;

        this.infoWin = null;
        this.cardPinned = false;

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
            this.loadDefaultLocations();
        }

        this.map.addListener("click", () => {
            if (!this.cardPinned && this.infoWin) {
                this.infoWin.close();
            }
            this.cardPinned = false;
        });
    }


    loadDefaultLocations() {

        const LOCS = [
            { name: "بوابة سمحان", lat: 24.742132, lng: 46.569503 },
            { name: "منطقة سمحان", lat: 24.740913, lng: 46.571891 },
            { name: "دوار البجيري", lat: 24.737521, lng: 46.574069 },
            { name: "إشارة البجيري", lat: 24.737662, lng: 46.575429 }
        ];

        LOCS.forEach(loc => this.addItem({
            id: "d" + Date.now() + Math.random(),
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            radius: 22,
            color: "#ff0000",
            recipients: []
        }));
    }


    addItem(data) {

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: data.lat, lng: data.lng },
            map: this.map,
            content: this.buildMarkerContent(data.color),
            gmpDraggable: this.editMode && !this.shareMode
        });

        const circle = new google.maps.Circle({
            center: { lat: data.lat, lng: data.lng },
            map: this.map,
            radius: data.radius || 22,
            strokeColor: data.color || "#ff0000",
            fillColor: data.color || "#ff0000",
            fillOpacity: 0.30,
            strokeOpacity: 0.9,
            strokeWeight: 2
        });

        const item = {
            id: data.id,
            name: data.name || "نقطة",
            color: data.color || "#ff0000",
            radius: data.radius || 22,
            recipients: data.recipients || [],
            marker,
            circle
        };

        this.attachListeners(item);
        this.items.push(item);

        return item;
    }


    buildMarkerContent(color) {
        const el = document.createElement("div");
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "50%";
        el.style.background = color || "#ff0000";
        el.style.border = "2px solid #fff";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
        return el;
    }


    attachListeners(item) {

        item.marker.addListener("drag", () => {
            item.circle.setCenter(item.marker.position);
        });

        item.marker.addListener("dragend", () => {
            bus.emit("persist");
        });

        item.marker.addListener("click", () => this.openCard(item, false));
        item.circle.addListener("click", () => this.openCard(item, false));

        item.circle.addListener("mouseover", () => {
            if (!this.cardPinned) this.openCard(item, true);
        });

        item.circle.addListener("mouseout", () => {
            if (!this.cardPinned && this.infoWin) {
                setTimeout(() => {
                    if (!this.cardPinned && this.infoWin) this.infoWin.close();
                }, 120);
            }
        });
    }



    openCard(item, hoverOnly = false) {

        const html = this.buildCardHTML(item, hoverOnly);

        if (!this.infoWin) {
            this.infoWin = new google.maps.InfoWindow({
                maxWidth: 350,
                pixelOffset: new google.maps.Size(0, -28)
            });
        }

        this.infoWin.setContent(html);
        this.infoWin.setPosition(item.marker.position);
        this.infoWin.open({ map: this.map, anchor: item.marker });

        if (!hoverOnly) {
            this.cardPinned = true;
        }

        google.maps.event.addListenerOnce(this.infoWin, "domready", () => {
            this.attachCardEvents(item, hoverOnly);
        });
    }



    buildCardHTML(item, hover) {

        const name = Utils.escapeHTML(item.name);
        const recipients = item.recipients.join("، ");
        const color = item.color;

        const logoHTML = `
            <div style="
                width:48px;
                height:48px;
                border-radius:12px;
                background:rgba(255,255,255,0.12);
                display:flex;
                align-items:center;
                justify-content:center;
                margin-left:8px;
            ">
                <img src="img/logo.png" style="width:36px;">
            </div>
        `;

        return `
        <div style="
            background:rgba(255,255,255,0.92);
            backdrop-filter:blur(16px);
            border-radius:18px;
            padding:16px;
            color:#111;
            direction:rtl;
        ">
            <div style="display:flex;align-items:center;margin-bottom:10px;">
                ${logoHTML}
                <div>
                    <div style="font-weight:800;font-size:17px;">${name}</div>
                    <div style="font-size:12px;color:#666;">نطاق الموقع: ${item.radius} م</div>
                </div>
            </div>

            ${hover || !MAP.editMode ? `
                <div style="text-align:center;margin-top:10px;">
                    <button id="loc-close" style="
                        padding:6px 14px;
                        background:#fff;
                        border:1px solid #ccc;
                        border-radius:10px;
                    ">إغلاق</button>
                </div>
            ` : `
                <div style="margin-top:10px;">
                    <label style="font-size:12px;">اسم الموقع:</label>
                    <input id="loc-name" type="text" value="${name}" 
                        style="width:100%;padding:7px;border:1px solid #ccc;border-radius:8px;">
                </div>

                <div style="margin-top:10px;">
                    <label style="font-size:12px;">المستلمون:</label>
                    <textarea id="loc-rec" rows="3"
                        style="width:100%;padding:7px;border-radius:8px;border:1px solid #ccc;">${item.recipients.join("\n")}</textarea>
                </div>

                <div style="display:flex;gap:10px;margin-top:10px;">
                    <div style="flex:1;">
                        <label style="font-size:12px;">اللون:</label>
                        <input id="loc-color" type="color" value="${color}"
                            style="width:100%;height:35px;border:none;">
                    </div>

                    <div style="flex:1;">
                        <label style="font-size:12px;">نصف القطر (م):</label>
                        <input id="loc-radius" type="number" value="${item.radius}"
                            min="5" max="5000" step="5"
                            style="width:100%;padding:7px;border-radius:8px;border:1px solid #ccc;">
                    </div>
                </div>

                <div style="display:flex;gap:8px;margin-top:14px;">
                    <button id="loc-save" style="
                        flex:2;background:#4285f4;color:white;
                        border:none;border-radius:10px;padding:8px;">حفظ</button>

                    <button id="loc-delete" style="
                        flex:1;background:#e94235;color:white;
                        border:none;border-radius:10px;padding:8px;">حذف</button>

                    <button id="loc-close" style="
                        flex:1;background:#fff;color:#333;
                        border:1px solid #ccc;border-radius:10px;padding:8px;">إغلاق</button>
                </div>
            `}
        </div>
        `;
    }



    attachCardEvents(item, hoverOnly) {

        const closeBtn = document.getElementById("loc-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => {
                if (this.infoWin) this.infoWin.close();
                this.cardPinned = false;
            });
        }

        if (hoverOnly || !MAP.editMode) return;

        const saveBtn = document.getElementById("loc-save");
        const delBtn = document.getElementById("loc-delete");

        const nameEl = document.getElementById("loc-name");
        const recEl = document.getElementById("loc-rec");
        const colEl = document.getElementById("loc-color");
        const radEl = document.getElementById("loc-radius");

        if (saveBtn) {
            saveBtn.addEventListener("click", () => {

                item.name = nameEl.value.trim();
                item.color = colEl.value;
                item.radius = Utils.clamp(+radEl.value, 5, 5000);
                item.recipients = recEl.value.split("\n").map(s => s.trim()).filter(Boolean);

                item.circle.setOptions({
                    fillColor: item.color,
                    strokeColor: item.color,
                    radius: item.radius
                });

                item.marker.content.style.background = item.color;

                bus.emit("persist");

                this.infoWin.close();
                this.cardPinned = false;

                bus.emit("toast", "تم حفظ التعديلات");
            });
        }

        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (!confirm(`حذف "${item.name}"؟`)) return;

                item.marker.map = null;
                item.circle.setMap(null);

                this.items = this.items.filter(x => x.id !== item.id);

                this.infoWin.close();
                this.cardPinned = false;

                bus.emit("persist");
                bus.emit("toast", "تم حذف الموقع");
            });
        }
    }



    exportState() {
        return this.items.map(it => ({
            id: it.id,
            name: it.name,
            lat: it.marker.position.lat,
            lng: it.marker.position.lng,
            color: it.color,
            radius: it.radius,
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
   RouteManager — إدارة مسارات متعددة + بطاقات Glass + Directions
============================================================ */
class RouteManager {

    constructor() {

        this.routes = [];
        this.map = null;

        this.shareMode = false;
        this.editMode = true;

        this.directionsService = null;

        this.routeCard = null;
        this.infoCard = null;
        this.cardPinned = false;

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
            if (!MAP.modeRouteAdd) return;
            if (this.shareMode) return;

            if (this.activeRouteIndex === -1) {
                this.createNewRoute();
            }
            this.addPointToRoute(this.activeRouteIndex, e.latLng);
        });

        this.map.addListener("click", () => {
            if (!this.cardPinned) {
                if (this.routeCard) this.routeCard.close();
                if (this.infoCard) this.infoCard.close();
            }
            this.cardPinned = false;
        });
    }



    createNewRoute() {

        const route = {
            id: "rt" + Date.now(),
            points: [],
            color: "#3344ff",
            weight: 6,
            opacity: 0.95,
            distance: 0,
            duration: 0,
            overview: null,
            poly: null,
            stops: []
        };

        this.routes.push(route);
        this.activeRouteIndex = this.routes.length - 1;

        return route;
    }



    addPointToRoute(routeIndex, latLng) {

        const rt = this.routes[routeIndex];
        rt.points.push(latLng);

        const stop = this.createStopMarker(latLng, routeIndex, rt.points.length - 1);
        rt.stops.push(stop);

        if (rt.points.length >= 2) {
            this.requestRoute(routeIndex);
        } else {
            bus.emit("persist");
        }
    }



    createStopMarker(pos, routeIndex, idx) {

        const rt = this.routes[routeIndex];

        const el = document.createElement("div");
        el.style.width = "22px";
        el.style.height = "22px";
        el.style.background = "white";
        el.style.borderRadius = "50%";
        el.style.border = `2px solid ${rt.color}`;
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.fontSize = "12px";
        el.style.fontWeight = "bold";
        el.textContent = idx + 1;

        const marker = new google.maps.marker.AdvancedMarkerElement({
            position: pos,
            map: this.map,
            content: el,
            gmpDraggable: !this.shareMode
        });

        marker.addListener("dragend", () => {
            rt.points[idx] = marker.position;
            this.requestRoute(routeIndex);
            bus.emit("persist");
        });

        marker.addListener("contextmenu", () => {
            if (this.shareMode) return;
            this.removePoint(routeIndex, idx);
        });

        return marker;
    }



    removePoint(routeIndex, idx) {

        const rt = this.routes[routeIndex];

        if (rt.stops[idx]) rt.stops[idx].map = null;

        rt.points.splice(idx, 1);
        rt.stops.splice(idx, 1);

        rt.stops.forEach((m, i) => {
            m.content.textContent = i + 1;
        });

        if (rt.points.length >= 2) {
            this.requestRoute(routeIndex);
        } else {
            this.clearRoute(routeIndex);
        }

        bus.emit("persist");
    }



    removeRoute(routeIndex) {

        const rt = this.routes[routeIndex];

        if (rt.poly) rt.poly.setMap(null);
        rt.stops.forEach(s => s.map = null);

        this.routes.splice(routeIndex, 1);
        this.activeRouteIndex = -1;

        if (this.routeCard) this.routeCard.close();
        if (this.infoCard) this.infoCard.close();
        this.cardPinned = false;

        bus.emit("persist");
    }



    clearRoute(routeIndex) {
        const rt = this.routes[routeIndex];
        if (rt.poly) rt.poly.setMap(null);
        rt.poly = null;
        rt.distance = 0;
        rt.duration = 0;
        rt.overview = null;
    }



    requestRoute(routeIndex) {

        if (!this.directionsService) {
            this.directionsService = new google.maps.DirectionsService();
        }

        const rt = this.routes[routeIndex];
        const pts = rt.points;

        if (pts.length < 2) return;

        const req = {
            origin: pts[0],
            destination: pts[pts.length - 1],
            travelMode: google.maps.TravelMode.DRIVING
        };

        if (pts.length > 2) {
            req.waypoints = pts.slice(1, -1).map(p => ({ location: p, stopover: true }));
        }

        this.directionsService.route(req, (res, status) => {

            if (status !== "OK") {
                bus.emit("toast", "تعذر حساب المسار");
                return;
            }

            const dir = res.routes[0];
            rt.overview = dir.overview_polyline;

            rt.distance = dir.legs.reduce((s, l) => s + l.distance.value, 0);
            rt.duration = dir.legs.reduce((s, l) => s + l.duration.value, 0);

            this.renderRoute(routeIndex);

            bus.emit("persist");
        });
    }



    renderRoute(routeIndex) {

        const rt = this.routes[routeIndex];

        if (rt.poly) rt.poly.setMap(null);

        let path = [];
        if (rt.overview) {
            path = google.maps.geometry.encoding.decodePath(rt.overview);
        } else {
            path = rt.points;
        }

        rt.poly = new google.maps.Polyline({
            map: this.map,
            path,
            strokeColor: rt.color,
            strokeWeight: rt.weight,
            strokeOpacity: rt.opacity,
            zIndex: 9
        });


        rt.poly.addListener("mouseover", () => {
            if (!this.cardPinned) {
                this.openInfoCard(routeIndex, false);
            }
        });

        rt.poly.addListener("mouseout", () => {
            if (!this.cardPinned && this.infoCard) {
                setTimeout(() => {
                    if (!this.cardPinned && this.infoCard) this.infoCard.close();
                }, 150);
            }
        });

        rt.poly.addListener("click", e => {

            if (this.shareMode) {
                this.openInfoCard(routeIndex, true);
            } else {
                this.openRouteCard(routeIndex, e.latLng);
            }
        });
    }



    openInfoCard(routeIndex, pinned = false) {

        const rt = this.routes[routeIndex];

        const dist = Utils.formatDistance(rt.distance);
        const dur = Utils.formatDuration(rt.duration);

        const html = `
        <div style="
            background:rgba(20,20,20,0.78);
            backdrop-filter:blur(18px);
            color:white;
            border-radius:16px;
            padding:14px;
            direction:rtl;
            min-width:260px;
            border:1px solid rgba(255,255,255,0.35);
            box-shadow:0 6px 18px rgba(0,0,0,0.35);
        ">
            <div style="font-weight:800;font-size:16px;margin-bottom:8px;">
                معلومات المسار ${routeIndex + 1}
            </div>

            <div style="display:flex;justify-content:space-between;margin-top:8px;">
                <div>المسافة: <b>${dist}</b></div>
                <div>الوقت: <b>${dur}</b></div>
            </div>
        </div>
        `;

        if (!this.infoCard) {
            this.infoCard = new google.maps.InfoWindow();
        }

        this.infoCard.setContent(html);
        this.infoCard.open({ map: this.map });

        this.cardPinned = pinned;

        google.maps.event.addListenerOnce(this.infoCard, "closeclick", () => {
            this.cardPinned = false;
        });
    }



    openRouteCard(routeIndex, pos) {

        const rt = this.routes[routeIndex];

        const html = `
        <div style="
            background:rgba(255,255,255,0.92);
            backdrop-filter:blur(16px);
            border-radius:18px;
            padding:14px;
            direction:rtl;
            min-width:300px;
        ">
            <div style="font-weight:bold;font-size:17px;margin-bottom:10px;">
                إعدادات المسار ${routeIndex + 1}
            </div>

            <label style="font-size:12px;">اللون:</label>
            <input id="rt-color" type="color" value="${rt.color}"
                style="width:100%;height:32px;border:none;margin-bottom:12px;">

            <label style="font-size:12px;">السماكة:</label>
            <input id="rt-w" type="range" min="1" max="12" value="${rt.weight}"
                style="width:100%;">
            <div style="margin-bottom:12px;font-size:12px;color:#555;">${rt.weight}px</div>

            <label style="font-size:12px;">الشفافية:</label>
            <input id="rt-op" type="range" min="0.2" max="1" step="0.05" value="${rt.opacity}"
                style="width:100%;">

            <div style="display:flex;gap:8px;margin-top:14px;">
                <button id="rt-save" style="
                    flex:2;background:#4285f4;color:white;
                    border:none;border-radius:8px;padding:8px;">حفظ</button>

                <button id="rt-del" style="
                    flex:1;background:#e94235;color:white;
                    border:none;border-radius:8px;padding:8px;">حذف</button>

                <button id="rt-close" style="
                    flex:1;background:white;border:1px solid #ccc;
                    border-radius:8px;padding:8px;">إغلاق</button>
            </div>
        </div>
        `;

        if (!this.routeCard) {
            this.routeCard = new google.maps.InfoWindow({
                maxWidth: 360,
                pixelOffset: new google.maps.Size(0, -8)
            });
        }

        this.routeCard.setContent(html);
        this.routeCard.setPosition(pos);
        this.routeCard.open({ map: this.map });

        this.cardPinned = true;

        google.maps.event.addListenerOnce(this.routeCard, "domready", () => {
            this.attachRouteCardEvents(routeIndex);
        });

        google.maps.event.addListenerOnce(this.routeCard, "closeclick", () => {
            this.cardPinned = false;
        });
    }



    attachRouteCardEvents(routeIndex) {

        const rt = this.routes[routeIndex];

        const colorEl = document.getElementById("rt-color");
        const wEl = document.getElementById("rt-w");
        const opEl = document.getElementById("rt-op");

        const saveBtn = document.getElementById("rt-save");
        const delBtn = document.getElementById("rt-del");
        const closeBtn = document.getElementById("rt-close");

        saveBtn.addEventListener("click", () => {

            rt.color = colorEl.value;
            rt.weight = +wEl.value;
            rt.opacity = +opEl.value;

            this.renderRoute(routeIndex);

            bus.emit("persist");

            this.routeCard.close();
            this.cardPinned = false;

            bus.emit("toast", "تم حفظ إعدادات المسار");
        });

        delBtn.addEventListener("click", () => {
            if (!confirm("هل تريد حذف هذا المسار؟")) return;
            this.removeRoute(routeIndex);
            bus.emit("toast", "تم حذف المسار");
        });

        closeBtn.addEventListener("click", () => {
            this.routeCard.close();
            this.cardPinned = false;
        });
    }



    exportState() {
        return this.routes.map(rt => ({
            id: rt.id,
            color: rt.color,
            weight: rt.weight,
            opacity: rt.opacity,
            distance: rt.distance,
            duration: rt.duration,
            overview: rt.overview,
            points: rt.points.map(p => ({ lat: p.lat, lng: p.lng }))
        }));
    }



    applyState(state) {

        if (!state || !state.routes) return;

        this.routes.forEach(rt => {
            if (rt.poly) rt.poly.setMap(null);
            rt.stops.forEach(s => s.map = null);
        });

        this.routes = [];

        state.routes.forEach(rt => {

            const newRoute = {
                id: rt.id,
                color: rt.color,
                weight: rt.weight,
                opacity: rt.opacity,
                distance: rt.distance,
                duration: rt.duration,
                overview: rt.overview,
                points: rt.points.map(p => new google.maps.LatLng(p.lat, p.lng)),
                poly: null,
                stops: []
            };

            this.routes.push(newRoute);

            newRoute.points.forEach((pt, i) => {
                const stop = this.createStopMarker(pt, this.routes.length - 1, i);
                newRoute.stops.push(stop);
            });

            this.renderRoute(this.routes.length - 1);
        });
    }
}

const ROUTES = new RouteManager();





/* ============================================================
   StateManager — إدارة حفظ وتحميل الحالة
============================================================ */
class StateManager {

    constructor() {

        this.map = null;
        this.shareMode = false;
        this.persistTimer = null;

        bus.on("map:ready", map => {
            this.map = map;
            this.shareMode = MAP.shareMode;

            const st = this.readShare();
            if (st) bus.emit("state:load", st);

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
            locations: LOCATIONS.exportState()
        };
    }



    writeShare(st) {

        try {
            const json = JSON.stringify(st);
            const encoded = Utils.b64uEncode(json);
            const base = location.origin + location.pathname;
            history.replaceState(null, "", base + "?x=" + encoded);
        } catch (e) {
            console.error("writeShare error", e);
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
}

const STATE = new StateManager();





/* ============================================================
   ShareManager — مشاركة الرابط عبر is.gd
============================================================ */
class ShareManager {

    constructor() {

        this.btn = document.getElementById("btn-share");

        if (this.btn) {
            this.btn.addEventListener("click", () => this.generateShareLink());
        }
    }



    async generateShareLink() {

        bus.emit("persist");
        await new Promise(r => setTimeout(r, 120));

        const longUrl = location.href;

        const label = this.btn.querySelector(".label");
        const original = label ? label.textContent : null;

        this.btn.disabled = true;
        if (label) label.textContent = "جاري النسخ…";

        try {

            const api = "https://is.gd/create.php?format=json&url=" +
                         encodeURIComponent(longUrl);

            const res = await fetch(api);
            const data = await res.json();

            const finalUrl = data.shorturl || longUrl;

            await navigator.clipboard.writeText(finalUrl);

            bus.emit("toast", "✓ تم نسخ الرابط المختصر");
        }

        catch (err) {
            console.error(err);
            await navigator.clipboard.writeText(longUrl);
            bus.emit("toast", "تم النسخ (الرابط طويل)");
        }

        finally {
            this.btn.disabled = false;
            if (label) label.textContent = original || "مشاركة";
        }
    }
}

const SHARE = new ShareManager();





/* ============================================================
   UIManager — إدارة الأزرار والواجهة والتوست
============================================================ */
class UIManager {

    constructor() {

        this.logo = "/img/logo.png";

        this.btnRoadmap    = document.getElementById("btn-roadmap");
        this.btnSatellite  = document.getElementById("btn-satellite");
        this.btnTraffic    = document.getElementById("btn-traffic");
        this.btnAdd        = document.getElementById("btn-add");
        this.btnRoute      = document.getElementById("btn-route");
        this.btnRouteClear = document.getElementById("btn-route-clear");
        this.btnEdit       = document.getElementById("btn-edit");

        this.modeBadge     = document.getElementById("mode-badge");

        this.toastElement = document.getElementById("toast");
        this.toastTimer = null;

        bus.on("map:ready", () => this.initializeUI());
        bus.on("toast", msg => this.showToast(msg));
    }



    initializeUI() {

        if (MAP.shareMode) this.applyShareMode();

        if (this.btnRoadmap) {
            this.btnRoadmap.addEventListener("click", () => {
                MAP.setRoadmap();
                this.btnRoadmap.setAttribute("aria-pressed", "true");
                this.btnSatellite.setAttribute("aria-pressed", "false");
                this.showToast("تم التبديل إلى خريطة الطرق");
            });
        }

        if (this.btnSatellite) {
            this.btnSatellite.addEventListener("click", () => {
                MAP.setSatellite();
                this.btnRoadmap.setAttribute("aria-pressed", "false");
                this.btnSatellite.setAttribute("aria-pressed", "true");
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

        if (this.btnEdit && !MAP.shareMode) {
            this.btnEdit.addEventListener("click", () => {

                MAP.editMode = !MAP.editMode;

                this.btnEdit.setAttribute("aria-pressed", MAP.editMode ? "true" : "false");
                this.updateModeBadge();

                if (!MAP.editMode) {
                    MAP.modeAdd = false;
                    MAP.modeRouteAdd = false;
                    if (this.btnAdd) this.btnAdd.setAttribute("aria-pressed","false");
                    if (this.btnRoute) this.btnRoute.setAttribute("aria-pressed","false");
                }
            });
        }

        if (this.btnAdd && !MAP.shareMode) {
            this.btnAdd.addEventListener("click", () => {

                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");

                MAP.modeAdd = !MAP.modeAdd;
                MAP.modeRouteAdd = false;

                this.btnAdd.setAttribute("aria-pressed", MAP.modeAdd ? "true" : "false");
                this.btnRoute.setAttribute("aria-pressed", "false");

                MAP.setCursor(MAP.modeAdd ? "crosshair" : "grab");

                if (MAP.modeAdd) this.showToast("اضغط على الخريطة لإضافة موقع");
            });
        }

        if (this.btnRoute && !MAP.shareMode) {
            this.btnRoute.addEventListener("click", () => {

                if (!MAP.editMode) return this.showToast("فعّل وضع التحرير");

                MAP.modeRouteAdd = !MAP.modeRouteAdd;
                MAP.modeAdd = false;

                this.btnAdd.setAttribute("aria-pressed", "false");
                this.btnRoute.setAttribute("aria-pressed",
                                           MAP.modeRouteAdd ? "true" : "false");

                MAP.setCursor(MAP.modeRouteAdd ? "cell" : "grab");

                if (MAP.modeRouteAdd) {
                    ROUTES.createNewRoute();
                    this.showToast("اضغط لإضافة نقاط المسار");
                }
            });
        }

        if (this.btnRouteClear && !MAP.shareMode) {
            this.btnRouteClear.addEventListener("click", () => {
                if (ROUTES.activeRouteIndex === -1)
                    return this.showToast("لا يوجد مسار لحذفه");

                if (!confirm("حذف المسار الحالي؟")) return;

                ROUTES.removeRoute(ROUTES.activeRouteIndex);
                this.showToast("تم حذف المسار");
            });
        }

        this.updateModeBadge();
    }



    applyShareMode() {

        if (this.btnAdd) this.btnAdd.style.display = "none";
        if (this.btnRoute) this.btnRoute.style.display = "none";
        if (this.btnRouteClear) this.btnRouteClear.style.display = "none";
        if (this.btnEdit) this.btnEdit.style.display = "none";

        this.updateModeBadge("view");
    }



    updateModeBadge(forceMode = null) {

        if (!this.modeBadge) return;

        const mode = forceMode || (MAP.editMode ? "edit" : "view");

        this.modeBadge.style.display = "block";
        this.modeBadge.textContent = (mode === "edit")
            ? "وضع التحرير"
            : "وضع العرض";

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
   BootLoader — التشغيل النهائي للنظام
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

        console.log("Diriyah Security Map — System Ready");

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
