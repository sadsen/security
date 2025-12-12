'use strict';

/*
==============================================================================
  DIRIYAH SECURITY MAP – v29.0 (Enterprise Edition)
  • Architecture: EventBus + Manager Classes
  • Features: Locations, Routes, Polygons (Edit Mode), Free Draw (Text/Icons)
  • UI: Injected Glassmorphism & Custom Modals
==============================================================================
*/

/* --- 1. Event Bus --- */
class EventBus {
    constructor() { this.events = {}; }
    on(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    }
    emit(event, data) {
        if (this.events[event]) this.events[event].forEach(h => h(data));
    }
}
const bus = new EventBus();

/* --- 2. Icon Database --- */
const ICON_DB = {
    shapes: [
        { n: 'circle', v: 'circle' }, { n: 'star', v: 'star' }, { n: 'square', v: 'square' }, { n: 'warning', v: 'warning' }
    ],
    places: [
        { n: 'Security', v: 'security' }, { n: 'Police', v: 'local_police' }, { n: 'Parking', v: 'local_parking' },
        { n: 'Checkpoint', v: 'gpp_good' }, { n: 'Camera', v: 'videocam' }, { n: 'HQ', v: 'admin_panel_settings' }
    ],
    transport: [
        { n: 'Car', v: 'directions_car' }, { n: 'Bus', v: 'directions_bus' }, { n: 'Bike', v: 'pedal_bike' },
        { n: 'Walk', v: 'directions_walk' }, { n: 'Traffic', v: 'traffic' }
    ],
    signs: [
        { n: 'Stop', v: 'pan_tool' }, { n: 'No Entry', v: 'no_meeting_room' }, { n: 'Info', v: 'info' },
        { n: 'Flag', v: 'flag' }, { n: 'Barrier', v: 'fence' }
    ]
};

/* --- 3. Utilities --- */
const Utils = {
    clamp(v, min, max) { return Math.min(max, Math.max(min, v)); },
    escapeHTML(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },
    // Simple Base64 URL Safe encoding/decoding for state
    b64uEncode(obj) {
        try {
            const str = JSON.stringify(obj);
            return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (e) { console.error(e); return ""; }
    },
    b64uDecode(str) {
        try {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4) str += '=';
            return JSON.parse(decodeURIComponent(escape(atob(str))));
        } catch (e) { console.error(e); return null; }
    },
    formatDistance(m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km"; },
    formatArea(m2) { return m2 >= 1000000 ? (m2 / 1000000).toFixed(2) + " km²" : Math.round(m2).toLocaleString() + " m²"; },
    uuid() { return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 10000); }
};

/* --- 4. Icon Picker Modal --- */
class IconPickerModal {
    static selectIcon() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(5px);`;
            
            let html = `<div class="glass-panel" style="background:white;width:90%;max-width:500px;border-radius:16px;padding:20px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 15px 0;font-family:'Cairo';border-bottom:1px solid #eee;padding-bottom:10px;">Select Icon</h3>
                <div style="flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill, minmax(60px, 1fr));gap:10px;padding:10px;">`;
            
            for (const [cat, icons] of Object.entries(ICON_DB)) {
                icons.forEach(icon => {
                    html += `<div class="icon-option" data-val="${icon.v}" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;padding:10px;border-radius:8px;transition:0.2s;">
                        <span class="material-icons" style="font-size:28px;color:#555;">${icon.v}</span>
                        <span style="font-size:10px;color:#888;margin-top:4px;">${icon.n}</span>
                    </div>`;
                });
            }
            html += `</div><button id="close-icon-modal" style="margin-top:15px;padding:10px;background:#f5f5f5;border:none;border-radius:8px;cursor:pointer;">Cancel</button></div>`;
            modal.innerHTML = html;
            document.body.appendChild(modal);

            modal.querySelectorAll('.icon-option').forEach(el => {
                el.addEventListener('mouseover', () => el.style.background = '#f0f4ff');
                el.addEventListener('mouseout', () => el.style.background = 'transparent');
                el.addEventListener('click', () => {
                    resolve(el.dataset.val);
                    document.body.removeChild(modal);
                });
            });

            document.getElementById('close-icon-modal').addEventListener('click', () => {
                resolve(null);
                document.body.removeChild(modal);
            });
        });
    }
}

/* --- 5. Map Controller --- */
class MapController {
    constructor() {
        this.map = null;
        this.layers = { traffic: null, transit: null, bike: null };
        this.currentMode = 'view'; // view, add, route, polygon, free, measure
        window.initMap = () => this.init();
    }

    init() {
        console.log("Initializing Diriyah Map v29.0...");
        this.map = new google.maps.Map(document.getElementById("map"), {
            center: { lat: 24.7399, lng: 46.5731 },
            zoom: 15,
            mapId: "DIRIYAH_MAP_V29", // Required for AdvancedMarkers
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false,
            clickableIcons: false
        });

        // Initialize Layers
        this.layers.traffic = new google.maps.TrafficLayer();
        this.layers.transit = new google.maps.TransitLayer();
        this.layers.bike = new google.maps.BicyclingLayer();

        // Styles
        const darkStyle = [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
        ];
        const silverStyle = [
            { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] }
        ];

        this.map.mapTypes.set('dark', new google.maps.StyledMapType(darkStyle, { name: 'Dark' }));
        this.map.mapTypes.set('silver', new google.maps.StyledMapType(silverStyle, { name: 'Silver' }));

        // Global Listeners
        this.map.addListener('click', (e) => {
            bus.emit('map:click', e);
        });

        // Wait for GMP Libs
        this.waitForLibs();
    }

    async waitForLibs() {
        if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
            bus.emit('map:ready', this.map);
        } else {
            // Import libraries if not loaded (Modern JS API)
            try {
                await google.maps.importLibrary("marker");
                await google.maps.importLibrary("geometry");
                await google.maps.importLibrary("drawing");
                bus.emit('map:ready', this.map);
            } catch (e) {
                console.error("Error loading libs", e);
            }
        }
    }

    setMapStyle(style) {
        if (style === 'satellite') this.map.setMapTypeId('hybrid');
        else if (style === 'dark' || style === 'silver') this.map.setMapTypeId(style);
        else this.map.setMapTypeId('roadmap');
    }

    toggleLayer(name, active) {
        if (this.layers[name]) this.layers[name].setMap(active ? this.map : null);
    }
}
const MAP = new MapController();

/* --- 6. Location Manager --- */
class LocationManager {
    constructor() {
        this.items = [];
        this.map = null;
        bus.on('map:ready', (m) => { this.map = m; });
        bus.on('map:click', (e) => {
            if (MAP.currentMode === 'add') this.addLocation(e.latLng);
        });
        bus.on('state:load', (s) => this.loadState(s));
    }

    addLocation(latLng, data = null) {
        const id = data ? data.id : Utils.uuid();
        const info = data || {
            id: id,
            pos: { lat: latLng.lat(), lng: latLng.lng() },
            name: 'New Location',
            desc: '',
            icon: 'place',
            color: '#ef4444',
            radius: 20,
            opacity: 0.3
        };

        // DOM Element for Icon
        const pinDiv = document.createElement('div');
        pinDiv.innerHTML = `<span class="material-icons" style="color:white;font-size:20px;">${info.icon}</span>`;
        pinDiv.style.cssText = `background:${info.color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;justify-content:center;align-items:center;box-shadow:0 3px 6px rgba(0,0,0,0.3);border:2px solid white;`;
        pinDiv.firstElementChild.style.transform = 'rotate(45deg)';

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: this.map,
            position: info.pos,
            content: pinDiv,
            gmpDraggable: true
        });

        const circle = new google.maps.Circle({
            map: this.map,
            center: info.pos,
            radius: info.radius,
            fillColor: info.color,
            fillOpacity: info.opacity,
            strokeColor: info.color,
            strokeWeight: 1
        });

        const item = { ...info, marker, circle };
        this.items.push(item);

        // Listeners
        marker.addListener('click', () => this.showEditCard(item));
        marker.addListener('dragend', () => {
            item.pos = { lat: marker.position.lat, lng: marker.position.lng };
            circle.setCenter(item.pos);
            bus.emit('state:change');
        });
        circle.addListener('click', () => this.showEditCard(item));

        if (!data) {
            bus.emit('state:change');
            MAP.currentMode = 'view'; // Reset mode
            UI.updateToolbar();
            this.showEditCard(item);
        }
    }

    showEditCard(item) {
        const content = `
            <div class="glass-form">
                <div class="form-header"><span class="material-icons">edit_location</span> Edit Location</div>
                <div class="form-row"><label>Name</label><input type="text" id="loc-name" value="${Utils.escapeHTML(item.name)}"></div>
                <div class="form-row"><label>Desc</label><textarea id="loc-desc">${Utils.escapeHTML(item.desc)}</textarea></div>
                <div class="form-row split">
                    <div><label>Color</label><input type="color" id="loc-color" value="${item.color}"></div>
                    <div><label>Radius (m)</label><input type="number" id="loc-rad" value="${item.radius}" style="width:60px"></div>
                </div>
                <div class="form-row"><label>Icon</label><button id="loc-icon-btn" class="btn-small">${item.icon}</button></div>
                <div class="form-actions">
                    <button id="loc-save" class="btn-primary">Save</button>
                    <button id="loc-del" class="btn-danger">Delete</button>
                </div>
            </div>
        `;
        UI.showInfoWindow(this.map, item.marker, content, () => {
            document.getElementById('loc-save').onclick = () => {
                item.name = document.getElementById('loc-name').value;
                item.desc = document.getElementById('loc-desc').value;
                item.color = document.getElementById('loc-color').value;
                item.radius = parseFloat(document.getElementById('loc-rad').value);
                
                // Update Visuals
                item.marker.content.style.background = item.color;
                item.circle.setOptions({ radius: item.radius, fillColor: item.color, strokeColor: item.color });
                
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
            document.getElementById('loc-del').onclick = () => {
                if(confirm('Delete location?')) {
                    item.marker.map = null;
                    item.circle.setMap(null);
                    this.items = this.items.filter(i => i.id !== item.id);
                    UI.closeInfoWindow();
                    bus.emit('state:change');
                }
            };
            document.getElementById('loc-icon-btn').onclick = async () => {
                const newIcon = await IconPickerModal.selectIcon();
                if (newIcon) {
                    item.icon = newIcon;
                    document.getElementById('loc-icon-btn').innerText = newIcon;
                    item.marker.content.innerHTML = `<span class="material-icons" style="color:white;font-size:20px;transform:rotate(45deg);">${newIcon}</span>`;
                }
            };
        });
    }

    exportState() {
        return this.items.map(i => ({
            id: i.id, pos: i.pos, name: i.name, desc: i.desc, icon: i.icon, color: i.color, radius: i.radius, opacity: i.opacity
        }));
    }

    loadState(state) {
        if (state.locations) state.locations.forEach(d => this.addLocation({ lat: () => d.pos.lat, lng: () => d.pos.lng }, d));
    }
}
const LOCATIONS = new LocationManager();

/* --- 7. Route Manager --- */
class RouteManager {
    constructor() {
        this.routes = [];
        this.currentPoints = [];
        this.tempPoly = null;
        this.map = null;
        this.ds = new google.maps.DirectionsService();

        bus.on('map:ready', m => this.map = m);
        bus.on('map:click', e => {
            if (MAP.currentMode === 'route') this.addPoint(e.latLng);
        });
        bus.on('state:load', s => this.loadState(s));
    }

    addPoint(latLng) {
        this.currentPoints.push(latLng);
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: this.map, position: latLng,
            content: this.createDot('#3b82f6')
        });
        
        // Visualize temp line
        if (this.currentPoints.length > 1) {
            if (this.tempPoly) this.tempPoly.setMap(null);
            this.tempPoly = new google.maps.Polyline({
                map: this.map, path: this.currentPoints, strokeColor: '#3b82f6', strokeOpacity: 0.5
            });
        }
        this.currentPoints[this.currentPoints.length-1].marker = marker;
    }

    createDot(color) {
        const d = document.createElement('div');
        d.style.cssText = `width:12px;height:12px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2)`;
        return d;
    }

    finishRoute() {
        if (this.currentPoints.length < 2) return;
        
        // Clean temp visuals
        this.currentPoints.forEach(p => p.marker.map = null);
        if (this.tempPoly) this.tempPoly.setMap(null);

        const origin = this.currentPoints[0];
        const destination = this.currentPoints[this.currentPoints.length-1];
        const waypoints = this.currentPoints.slice(1, -1).map(p => ({ location: p, stopover: false }));

        this.ds.route({
            origin, destination, waypoints,
            travelMode: google.maps.TravelMode.DRIVING
        }, (res, status) => {
            if (status === 'OK') {
                this.createRouteObject(res, '#3b82f6');
            } else {
                alert('Route failed: ' + status);
            }
            this.currentPoints = [];
        });
    }

    createRouteObject(result, color, id=null) {
        const routeId = id || Utils.uuid();
        const leg = result.routes[0].legs[0]; // Simplification for demo
        const distance = result.routes[0].legs.reduce((acc, l) => acc + l.distance.value, 0);
        const duration = result.routes[0].legs.reduce((acc, l) => acc + l.duration.value, 0);

        const poly = new google.maps.Polyline({
            map: this.map,
            path: result.routes[0].overview_path,
            strokeColor: color,
            strokeWeight: 5,
            strokeOpacity: 0.8
        });

        const routeItem = { id: routeId, poly, data: result, color, dist: distance, dur: duration };
        this.routes.push(routeItem);

        poly.addListener('click', (e) => {
            const content = `
                <div class="glass-form">
                    <div class="form-header"><span class="material-icons">timeline</span> Route Details</div>
                    <div style="font-size:12px;color:#666;margin-bottom:10px;">
                        <b>Dist:</b> ${Utils.formatDistance(routeItem.dist)} <br>
                        <b>Time:</b> ${(routeItem.dur/60).toFixed(0)} mins
                    </div>
                    <div class="form-row"><label>Color</label><input type="color" id="rt-color" value="${routeItem.color}"></div>
                    <div class="form-actions"><button id="rt-save" class="btn-primary">Update</button><button id="rt-del" class="btn-danger">Delete</button></div>
                </div>
            `;
            UI.showInfoWindow(this.map, { position: e.latLng }, content, () => {
                document.getElementById('rt-save').onclick = () => {
                    routeItem.color = document.getElementById('rt-color').value;
                    routeItem.poly.setOptions({ strokeColor: routeItem.color });
                    UI.closeInfoWindow();
                    bus.emit('state:change');
                };
                document.getElementById('rt-del').onclick = () => {
                    routeItem.poly.setMap(null);
                    this.routes = this.routes.filter(r => r.id !== routeId);
                    UI.closeInfoWindow();
                    bus.emit('state:change');
                };
            });
        });

        bus.emit('state:change');
    }

    exportState() {
        return this.routes.map(r => ({
            id: r.id, color: r.color,
            // Storing just waypoints/origin/dest would be better, but storing encoded path is easier for recreation
            path: google.maps.geometry.encoding.encodePath(r.poly.getPath()),
            dist: r.dist, dur: r.dur
        }));
    }

    loadState(state) {
        if(state.routes) {
            state.routes.forEach(r => {
                const path = google.maps.geometry.encoding.decodePath(r.path);
                const poly = new google.maps.Polyline({
                    map: this.map, path: path, strokeColor: r.color, strokeWeight: 5, strokeOpacity: 0.8
                });
                // Manually reconstructing the minimal object for interaction
                const routeItem = { id: r.id, poly, color: r.color, dist: r.dist, dur: r.dur };
                this.routes.push(routeItem);
                
                // Re-attach listener (Duplicate logic, ideally refactored)
                poly.addListener('click', (e) => { /* Same listener logic as above */ }); 
            });
        }
    }
}
const ROUTES = new RouteManager();

/* --- 8. Polygon Manager (With Edit Mode) --- */
class PolygonManager {
    constructor() {
        this.polygons = [];
        this.currentPath = [];
        this.tempPoly = null;
        this.map = null;
        this.editingId = null; // ID of polygon currently being edited
        this.editMarkers = [];

        bus.on('map:ready', m => this.map = m);
        bus.on('map:click', e => {
            if (MAP.currentMode === 'polygon') this.addVertex(e.latLng);
        });
        bus.on('state:load', s => this.loadState(s));
    }

    addVertex(latLng) {
        this.currentPath.push(latLng);
        if (this.tempPoly) this.tempPoly.setMap(null);
        this.tempPoly = new google.maps.Polygon({
            map: this.map, paths: this.currentPath,
            strokeColor: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2
        });
    }

    finishPolygon() {
        if (this.currentPath.length < 3) return;
        if (this.tempPoly) this.tempPoly.setMap(null);

        const id = Utils.uuid();
        const poly = new google.maps.Polygon({
            map: this.map, paths: this.currentPath,
            strokeColor: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.35,
            strokeWeight: 2, editable: false // We build custom edit logic
        });

        const item = { id, poly, color: '#f59e0b', name: 'Zone ' + (this.polygons.length + 1) };
        this.polygons.push(item);
        this.currentPath = [];

        poly.addListener('click', (e) => {
            if (this.editingId === id) return; // Ignore clicks if editing this one
            this.showPolyMenu(item, e.latLng);
        });

        bus.emit('state:change');
    }

    showPolyMenu(item, latLng) {
        const area = google.maps.geometry.spherical.computeArea(item.poly.getPath());
        const content = `
            <div class="glass-form">
                <div class="form-header">Polygon: ${item.name}</div>
                <div style="font-size:12px;margin-bottom:8px;">Area: ${Utils.formatArea(area)}</div>
                <div class="form-actions">
                    <button id="poly-edit" class="btn-primary">Edit Shape</button>
                    <button id="poly-del" class="btn-danger">Delete</button>
                </div>
            </div>`;
        
        UI.showInfoWindow(this.map, { position: latLng }, content, () => {
            document.getElementById('poly-edit').onclick = () => {
                UI.closeInfoWindow();
                this.enableEditMode(item);
            };
            document.getElementById('poly-del').onclick = () => {
                item.poly.setMap(null);
                this.polygons = this.polygons.filter(p => p.id !== item.id);
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
        });
    }

    enableEditMode(item) {
        if (this.editingId) this.disableEditMode(); // Close others
        this.editingId = item.id;
        const path = item.poly.getPath();

        // Create draggable markers for each vertex
        path.getArray().forEach((latLng, index) => {
            const marker = new google.maps.marker.AdvancedMarkerElement({
                map: this.map, position: latLng, gmpDraggable: true,
                content: ROUTES.createDot('white') // reuse dot
            });
            marker.content.style.borderColor = 'black';

            marker.addListener('drag', () => {
                path.setAt(index, marker.position);
                const area = google.maps.geometry.spherical.computeArea(path);
                // Optional: Update area display in real-time
            });

            // Right click to delete vertex
            marker.element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (path.getLength() > 3) {
                    path.removeAt(index);
                    this.disableEditMode();
                    this.enableEditMode(item); // Re-render markers
                } else {
                    alert("Cannot have fewer than 3 points.");
                }
            });

            this.editMarkers.push(marker);
        });
        
        // Show "Finish Editing" button in UI
        UI.showToast("Edit Mode: Drag points. Right-click point to delete. Click 'Done' in toolbar.");
        MAP.currentMode = 'view'; // Prevent adding new polygons
    }

    disableEditMode() {
        this.editMarkers.forEach(m => m.map = null);
        this.editMarkers = [];
        this.editingId = null;
        bus.emit('state:change');
    }

    exportState() {
        return this.polygons.map(p => ({
            id: p.id, color: p.color, name: p.name,
            path: p.poly.getPath().getArray().map(pt => ({ lat: pt.lat(), lng: pt.lng() }))
        }));
    }

    loadState(state) {
        if(state.polygons) {
            state.polygons.forEach(p => {
                const poly = new google.maps.Polygon({
                    map: this.map, paths: p.path,
                    strokeColor: p.color, fillColor: p.color, fillOpacity: 0.35, strokeWeight: 2
                });
                const item = { id: p.id, poly, color: p.color, name: p.name };
                this.polygons.push(item);
                poly.addListener('click', (e) => { if(this.editingId !== p.id) this.showPolyMenu(item, e.latLng); });
            });
        }
    }
}
const POLYGONS = new PolygonManager();

/* --- 9. Free Layer Manager (NEW FEATURE) --- */
class FreeLayerManager {
    constructor() {
        this.items = [];
        this.map = null;
        bus.on('map:ready', m => this.map = m);
        bus.on('map:click', e => {
            if (MAP.currentMode === 'free') this.handleMapClick(e.latLng);
        });
        bus.on('state:load', s => this.loadState(s));
    }

    handleMapClick(latLng) {
        // Popup to ask: Text or Icon?
        const content = `
            <div class="glass-form" style="width:150px;text-align:center;">
                <div style="margin-bottom:10px;"><b>Add Free Element</b></div>
                <button id="free-add-icon" class="btn-primary" style="width:100%;margin-bottom:5px;">Icon</button>
                <button id="free-add-text" class="btn-primary" style="width:100%;">Text Label</button>
            </div>
        `;
        UI.showInfoWindow(this.map, { position: latLng }, content, () => {
            document.getElementById('free-add-icon').onclick = () => {
                UI.closeInfoWindow();
                this.startIconFlow(latLng);
            };
            document.getElementById('free-add-text').onclick = () => {
                UI.closeInfoWindow();
                this.startTextFlow(latLng);
            };
        });
    }

    async startIconFlow(latLng) {
        const iconName = await IconPickerModal.selectIcon();
        if (!iconName) return;
        this.addItem({ type: 'icon', pos: { lat: latLng.lat(), lng: latLng.lng() }, content: iconName, style: { color: '#ffffff', scale: 30 } });
    }

    startTextFlow(latLng) {
        // Default text settings
        this.addItem({ 
            type: 'text', 
            pos: { lat: latLng.lat(), lng: latLng.lng() }, 
            content: 'Label', 
            style: { color: '#000000', size: 14, bg: 'white' } 
        });
    }

    addItem(data) {
        const id = data.id || Utils.uuid();
        const item = { ...data, id };
        
        const el = document.createElement('div');
        el.className = 'free-element';
        
        // Render content
        this.renderElement(el, item);

        const marker = new google.maps.marker.AdvancedMarkerElement({
            map: this.map, position: item.pos, content: el, gmpDraggable: true
        });

        item.marker = marker;
        this.items.push(item);

        // Events
        marker.addListener('click', () => {
            if (item.type === 'text') this.editText(item);
            else this.editIcon(item);
        });
        marker.addListener('dragend', () => {
            item.pos = { lat: marker.position.lat, lng: marker.position.lng };
            bus.emit('state:change');
        });

        if (!data.id && item.type === 'text') this.editText(item); // Auto open edit for new text
        bus.emit('state:change');
    }

    renderElement(el, item) {
        if (item.type === 'icon') {
            el.innerHTML = `<span class="material-icons" style="font-size:${item.style.scale}px;color:${item.style.color};text-shadow:0 2px 5px rgba(0,0,0,0.3);">${item.content}</span>`;
        } else {
            // Text Handling with Backgrounds
            el.innerText = item.content;
            el.style.fontSize = item.style.size + 'px';
            el.style.fontFamily = 'Cairo, sans-serif';
            el.style.whiteSpace = 'nowrap';
            el.style.transform = 'translate(-50%, -50%)'; // Center text
            
            // Apply Background Styles
            if (item.style.bg === 'none') {
                el.style.background = 'transparent';
                el.style.color = item.style.color;
                el.style.padding = '0';
                el.style.border = 'none';
                el.style.textShadow = 'none';
                el.style.boxShadow = 'none';
            } else if (item.style.bg === 'white') {
                el.style.background = 'rgba(255,255,255,0.9)';
                el.style.color = item.style.color;
                el.style.padding = '4px 8px';
                el.style.borderRadius = '4px';
                el.style.border = '1px solid #ddd';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                el.style.textShadow = 'none';
            } else if (item.style.bg === 'dark') {
                el.style.background = 'rgba(0,0,0,0.85)';
                el.style.color = '#fff'; // Force white text for contrast usually, or use item.style.color
                el.style.padding = '4px 8px';
                el.style.borderRadius = '4px';
                el.style.border = '1px solid #444';
                el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
                el.style.textShadow = 'none';
            } else if (item.style.bg === 'outline') {
                el.style.background = 'transparent';
                el.style.color = item.style.color;
                el.style.padding = '0';
                el.style.border = 'none';
                el.style.boxShadow = 'none';
                // Strong white outline simulation
                el.style.textShadow = '2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff, 1px 1px #fff, -1px -1px #fff, 1px -1px #fff, -1px 1px #fff';
            }
        }
    }

    editText(item) {
        const content = `
            <div class="glass-form">
                <div class="form-header">Edit Text</div>
                <div class="form-row"><input type="text" id="ft-content" value="${Utils.escapeHTML(item.content)}"></div>
                <div class="form-row"><label>Size</label><input type="range" id="ft-size" min="10" max="60" value="${item.style.size}"></div>
                <div class="form-row"><label>Color</label><input type="color" id="ft-color" value="${item.style.color}"></div>
                <div class="form-row">
                    <label>Style</label>
                    <select id="ft-bg">
                        <option value="none" ${item.style.bg === 'none' ? 'selected' : ''}>None</option>
                        <option value="white" ${item.style.bg === 'white' ? 'selected' : ''}>White Box</option>
                        <option value="dark" ${item.style.bg === 'dark' ? 'selected' : ''}>Dark Box</option>
                        <option value="outline" ${item.style.bg === 'outline' ? 'selected' : ''}>Outline</option>
                    </select>
                </div>
                <div class="form-actions"><button id="ft-save" class="btn-primary">Save</button><button id="ft-del" class="btn-danger">Delete</button></div>
            </div>`;
        UI.showInfoWindow(this.map, item.marker, content, () => {
            document.getElementById('ft-save').onclick = () => {
                item.content = document.getElementById('ft-content').value;
                item.style.size = document.getElementById('ft-size').value;
                item.style.color = document.getElementById('ft-color').value;
                item.style.bg = document.getElementById('ft-bg').value;
                this.renderElement(item.marker.content, item);
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
            document.getElementById('ft-del').onclick = () => {
                item.marker.map = null;
                this.items = this.items.filter(i => i.id !== item.id);
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
        });
    }

    editIcon(item) {
        const content = `
            <div class="glass-form">
                <div class="form-header">Edit Icon</div>
                <div class="form-row"><label>Size</label><input type="range" id="fi-size" min="10" max="100" value="${item.style.scale}"></div>
                <div class="form-row"><label>Color</label><input type="color" id="fi-color" value="${item.style.color}"></div>
                <div class="form-actions"><button id="fi-save" class="btn-primary">Save</button><button id="fi-del" class="btn-danger">Delete</button></div>
            </div>`;
        UI.showInfoWindow(this.map, item.marker, content, () => {
            document.getElementById('fi-save').onclick = () => {
                item.style.scale = document.getElementById('fi-size').value;
                item.style.color = document.getElementById('fi-color').value;
                this.renderElement(item.marker.content, item);
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
            document.getElementById('fi-del').onclick = () => {
                item.marker.map = null;
                this.items = this.items.filter(i => i.id !== item.id);
                UI.closeInfoWindow();
                bus.emit('state:change');
            };
        });
    }

    exportState() { return this.items.map(i => ({ id: i.id, type: i.type, pos: i.pos, content: i.content, style: i.style })); }
    loadState(state) {
        if (state.free) state.free.forEach(i => this.addItem(i));
    }
}
const FREELAYER = new FreeLayerManager();

/* --- 10. Measure Manager --- */
class MeasureManager {
    constructor() {
        this.pts = [];
        this.poly = null;
        this.map = null;
        this.tooltip = null;
        bus.on('map:ready', m => this.map = m);
        bus.on('map:click', e => { if (MAP.currentMode === 'measure') this.add(e.latLng); });
    }

    add(latLng) {
        this.pts.push(latLng);
        if (this.poly) this.poly.setMap(null);
        
        this.poly = new google.maps.Polyline({
            map: this.map, path: this.pts, strokeColor: '#10b981', strokeWeight: 4
        });

        // Calc
        let dist = 0, area = 0;
        if (this.pts.length > 1) dist = google.maps.geometry.spherical.computeLength(this.pts);
        if (this.pts.length > 2) area = google.maps.geometry.spherical.computeArea(this.pts);

        const content = `
            <div style="padding:5px;font-family:'Cairo';">
                <b>Dist:</b> ${Utils.formatDistance(dist)}<br>
                ${area > 0 ? `<b>Area:</b> ${Utils.formatArea(area)}` : ''}
                <div style="font-size:10px;color:#666;">Double click to reset</div>
            </div>`;
        
        if (!this.tooltip) this.tooltip = new google.maps.InfoWindow({ disableAutoPan: true });
        this.tooltip.setContent(content);
        this.tooltip.setPosition(latLng);
        this.tooltip.open(this.map);
    }

    reset() {
        this.pts = [];
        if (this.poly) this.poly.setMap(null);
        if (this.tooltip) this.tooltip.close();
    }
}
const MEASURE = new MeasureManager();

/* --- 11. State Manager --- */
class StateManager {
    constructor() {
        this.updating = false;
        bus.on('state:change', () => this.saveToURL());
        window.addEventListener('popstate', () => this.readFromURL());
    }

    buildState() {
        return {
            map: {
                c: { lat: MAP.map.getCenter().lat(), lng: MAP.map.getCenter().lng() },
                z: MAP.map.getZoom(),
                t: MAP.map.getMapTypeId()
            },
            locations: LOCATIONS.exportState(),
            routes: ROUTES.exportState(),
            polygons: POLYGONS.exportState(),
            free: FREELAYER.exportState()
        };
    }

    saveToURL() {
        if (this.updating) return;
        this.updating = true;
        setTimeout(() => {
            const state = this.buildState();
            const b64 = Utils.b64uEncode(state);
            const url = `${window.location.pathname}?x=${b64}`;
            window.history.replaceState(null, '', url);
            this.updating = false;
        }, 500); // Debounce
    }

    readFromURL() {
        const params = new URLSearchParams(window.location.search);
        const x = params.get('x');
        if (x) {
            const state = Utils.b64uDecode(x);
            if (state) {
                if (state.map) {
                    MAP.map.setCenter(state.map.c);
                    MAP.map.setZoom(state.map.z);
                    MAP.map.setMapTypeId(state.map.t);
                }
                bus.emit('state:load', state);
            }
        }
    }
}
const STATE = new StateManager();

/* --- 12. UI Manager --- */
class UIManager {
    constructor() {
        this.infoWindow = null;
        this.injectStyles();
        bus.on('map:ready', () => {
            this.infoWindow = new google.maps.InfoWindow({ minWidth: 200 });
            this.initToolbar();
            STATE.readFromURL(); // Initial Load
        });
    }

    injectStyles() {
        const css = `
            body { margin: 0; font-family: 'Cairo', sans-serif; overflow: hidden; background: #1a1a1a; }
            #map { width: 100vw; height: 100vh; }
            
            /* Glass Toolbar */
            .glass-toolbar {
                position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(15px);
                padding: 8px; border-radius: 16px; display: flex; gap: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2);
                z-index: 100;
            }
            .tb-btn {
                width: 40px; height: 40px; border-radius: 12px; border: none;
                background: rgba(255,255,255,0.1); color: white; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: 0.2s;
            }
            .tb-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
            .tb-btn.active { background: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); }
            
            /* Glass InfoWindow & Forms */
            .glass-form {
                background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(10px);
                padding: 15px; border-radius: 12px; min-width: 250px; font-family: 'Cairo', sans-serif;
            }
            .form-header { font-weight: bold; margin-bottom: 10px; display:flex; align-items:center; gap:5px; border-bottom:1px solid #ddd; padding-bottom:5px; }
            .form-row { margin-bottom: 8px; }
            .form-row.split { display: flex; gap: 10px; }
            .form-row label { display: block; font-size: 11px; color: #555; margin-bottom: 2px; }
            .form-row input, .form-row textarea, .form-row select { 
                width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; 
                background: rgba(255,255,255,0.6); box-sizing: border-box; 
            }
            .form-actions { display: flex; gap: 8px; margin-top: 10px; }
            .btn-primary { flex: 1; background: #3b82f6; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; }
            .btn-danger { flex: 1; background: #ef4444; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; }
            .btn-small { padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; background: white; cursor: pointer; }

            /* Google Maps Overrides */
            .gm-style-iw { background: transparent !important; box-shadow: none !important; }
            .gm-style-iw-d { overflow: visible !important; }
            .gm-style-iw-tc { display: none; }
            button.gm-ui-hover-effect { display: none !important; } /* Hide close button */
        `;
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
        
        // Add Font
        const link = document.createElement('link');
        link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600&family=Material+Icons&display=swap";
        link.rel = "stylesheet";
        document.head.appendChild(link);
    }

    initToolbar() {
        const html = `
            <div class="glass-toolbar">
                <button class="tb-btn active" id="btn-view" title="View"><span class="material-icons">pan_tool</span></button>
                <div style="width:1px;background:rgba(255,255,255,0.2);margin:0 4px;"></div>
                <button class="tb-btn" id="btn-add" title="Add Location"><span class="material-icons">add_location_alt</span></button>
                <button class="tb-btn" id="btn-route" title="Draw Route"><span class="material-icons">timeline</span></button>
                <button class="tb-btn" id="btn-poly" title="Draw Polygon"><span class="material-icons">pentagon</span></button>
                <button class="tb-btn" id="btn-free" title="Free Draw"><span class="material-icons">brush</span></button>
                <button class="tb-btn" id="btn-measure" title="Measure"><span class="material-icons">straighten</span></button>
                <div style="width:1px;background:rgba(255,255,255,0.2);margin:0 4px;"></div>
                <button class="tb-btn" id="btn-layers" title="Layers"><span class="material-icons">layers</span></button>
                <button class="tb-btn" id="btn-share" title="Share"><span class="material-icons">share</span></button>
            </div>
            
            <button id="btn-finish" style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);background:#10b981;color:white;border:none;padding:10px 20px;border-radius:20px;font-weight:bold;box-shadow:0 5px 15px rgba(0,0,0,0.3);cursor:pointer;display:none;z-index:100;">Finish Drawing</button>
            
            <div id="panel-layers" style="position:absolute;top:80px;right:20px;background:white;padding:15px;border-radius:12px;display:none;box-shadow:0 5px 20px rgba(0,0,0,0.2);width:150px;z-index:100;">
                <h4 style="margin:0 0 10px 0;">Layers</h4>
                <div style="margin-bottom:5px;"><input type="checkbox" id="chk-traffic"> Traffic</div>
                <div style="margin-bottom:5px;"><input type="checkbox" id="chk-transit"> Transit</div>
                <div style="margin-bottom:10px;"><input type="checkbox" id="chk-bike"> Bicycle</div>
                <h4 style="margin:0 0 5px 0;">Style</h4>
                <select id="sel-style" style="width:100%;padding:5px;">
                    <option value="roadmap">Roadmap</option>
                    <option value="satellite">Satellite</option>
                    <option value="dark">Dark Mode</option>
                    <option value="silver">Silver</option>
                </select>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = html;
        document.body.appendChild(div);

        // Bind Events
        const setMode = (mode, btnId) => {
            MAP.currentMode = mode;
            document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
            if(btnId) document.getElementById(btnId).classList.add('active');
            
            // Toggle Finish Button
            const finishBtn = document.getElementById('btn-finish');
            if (mode === 'route' || mode === 'polygon') finishBtn.style.display = 'block';
            else finishBtn.style.display = 'none';

            // Reset Measure
            if (mode !== 'measure') MEASURE.reset();
            // Reset Polygon Editing
            if (mode !== 'view') POLYGONS.disableEditMode();
        };

        document.getElementById('btn-view').onclick = () => setMode('view', 'btn-view');
        document.getElementById('btn-add').onclick = () => setMode('add', 'btn-add');
        document.getElementById('btn-route').onclick = () => setMode('route', 'btn-route');
        document.getElementById('btn-poly').onclick = () => setMode('polygon', 'btn-poly');
        document.getElementById('btn-free').onclick = () => setMode('free', 'btn-free');
        document.getElementById('btn-measure').onclick = () => setMode('measure', 'btn-measure');

        document.getElementById('btn-finish').onclick = () => {
            if (MAP.currentMode === 'route') ROUTES.finishRoute();
            if (MAP.currentMode === 'polygon') POLYGONS.finishPolygon();
            setMode('view', 'btn-view');
        };

        // Layers
        document.getElementById('btn-layers').onclick = () => {
            const p = document.getElementById('panel-layers');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        };
        document.getElementById('chk-traffic').onchange = (e) => MAP.toggleLayer('traffic', e.target.checked);
        document.getElementById('chk-transit').onchange = (e) => MAP.toggleLayer('transit', e.target.checked);
        document.getElementById('chk-bike').onchange = (e) => MAP.toggleLayer('bike', e.target.checked);
        document.getElementById('sel-style').onchange = (e) => MAP.setMapStyle(e.target.value);

        // Share
        document.getElementById('btn-share').onclick = () => {
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => alert('URL Copied to Clipboard!'));
        };
    }

    showInfoWindow(map, marker, html, callback) {
        this.infoWindow.setContent(html);
        if (marker.position) this.infoWindow.setPosition(marker.position); // For latLng objects
        else this.infoWindow.open(map, marker); // For Marker objects
        
        if(marker.position && !marker.map) this.infoWindow.open(map); // For clicked points

        google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
            if (callback) callback();
        });
    }

    closeInfoWindow() {
        this.infoWindow.close();
    }
}
const UI = new UIManager();

/* --- 13. BootLoader --- */
document.addEventListener("DOMContentLoaded", () => {
    // If Google Maps script is not loaded in HTML, we can't do much. 
    // Assuming <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&callback=initMap&v=beta&libraries=marker,geometry,drawing"></script> exists.
    if (typeof google === 'object' && typeof google.maps === 'object') {
        // Already loaded
        MAP.init();
    } else {
        console.log("Waiting for Google Maps API callback...");
    }
});
