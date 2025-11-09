/* =======================
   خريطة الأمن – main.js  (c4 delta sharing, mobile-safe)
   ======================= */

/* ---------- Helpers ---------- */
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }
function qs(){ return new URLSearchParams(location.search); }
const DEF_STYLE = { radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 };

/* ---------- Base64URL (للصيغة c2 القديمة) ---------- */
function b64e(s){ return btoa(unescape(encodeURIComponent(s))); }
function b64d(s){ return decodeURIComponent(escape(atob(s))); }
function toUrl(b){ return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromUrl(u){ let b=u.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4)b+='='; return b; }

/* ---------- LZ-String (URI-safe بدون +) ---------- */
const LZ = (function(){
  function o(r){return String.fromCharCode(r);}
  const keyURI = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const baseReverseDic = {};
  function getBaseValue(alphabet, character){
    if(!baseReverseDic[alphabet]){ baseReverseDic[alphabet]={}; for(let i=0;i<alphabet.length;i++) baseReverseDic[alphabet][alphabet.charAt(i)] = i; }
    return baseReverseDic[alphabet][character];
  }
  function compressToEncodedURIComponent(input){
    if(input==null) return "";
    return _compress(input, 6, a => keyURI.charAt(a));
  }
  function _compress(uncompressed, bitsPerChar, getCharFromInt){
    if(uncompressed==null) return "";
    let i, value,
      dict={}, dictCreate={}, c="", wc="", w="", enlargeIn=2,
      dictSize=3, numBits=2, out=[], outVal=0, outPos=0;
    for(i=0;i<uncompressed.length;i++){
      c = uncompressed.charAt(i);
      if(!Object.prototype.hasOwnProperty.call(dict,c)){ dict[c]=dictSize++; dictCreate[c]=true; }
      wc = w + c;
      if(Object.prototype.hasOwnProperty.call(dict,wc)){ w = wc; }
      else{
        if(Object.prototype.hasOwnProperty.call(dictCreate,w)){
          if(w.charCodeAt(0)<256){
            for(i=0;i<numBits;i++){ outVal=(outVal<<1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; }
            value=w.charCodeAt(0);
            for(i=0;i<8;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
          }else{
            value=1;
            for(i=0;i<numBits;i++){ outVal=(outVal<<1)|value; if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value=0; }
            value=w.charCodeAt(0);
            for(i=0;i<16;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
          }
          enlargeIn--; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
          delete dictCreate[w];
        }else{
          value=dict[w];
          for(i=0;i<numBits;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
        }
        enlargeIn--; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
        dict[wc]=dictSize++; w=String(c);
      }
    }
    if(w!==""){
      if(Object.prototype.hasOwnProperty.call(dictCreate,w)){
        if(w.charCodeAt(0)<256){
          for(i=0;i<numBits;i++){ outVal=(outVal<<1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; }
          value=w.charCodeAt(0);
          for(i=0;i<8;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
        }else{
          value=1;
          for(i=0;i<numBits;i++){ outVal=(outVal<<1)|value; if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value=0; }
          value=w.charCodeAt(0);
          for(i=0;i<16;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
        }
        enlargeIn--; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
        delete dictCreate[w];
      }else{
        value=dict[w];
        for(i=0;i<numBits;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
      }
      enlargeIn--; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
    }
    value=2;
    for(i=0;i<numBits;i++){ outVal=(outVal<<1)|(value&1); if(outPos==bitsPerChar-1){ outPos=0; out.push(getCharFromInt(outVal)); outVal=0; } else outPos++; value>>=1; }
    while(true){ outVal=(outVal<<1); if(outPos==bitsPerChar-1){ out.push(getCharFromInt(outVal)); break; } else outPos++; }
    return encodeURIComponent(out.join('')); // بدون + نهائيًا
  }
  function decompressFromEncodedURIComponent(input){
    if(input==null) return "";
    input = decodeURIComponent(input); // بدون استبدالات
    if(input=="") return null;
    return _decompress(input.length, 32, i => input.charCodeAt(i));
  }
  function _decompress(length, resetValue, getNextValue){
    const dictionary=[], result=[], data={val:getNextValue(0), position:resetValue, index:1};
    let enlargeIn=4, dictSize=4, numBits=3, entry="", w, c, bits, resb, maxpower, power;
    for(let i=0;i<3;i++) dictionary[i]=i;
    function readBits(n){
      bits=0; maxpower=Math.pow(2,n); power=1;
      while(power!=maxpower){
        resb = data.val & data.position;
        data.position >>= 1;
        if(data.position==0){ data.position=resetValue; data.val = getNextValue(data.index++); }
        bits |= (resb>0 ? 1:0) * power; power <<= 1;
      }
      return bits;
    }
    let next = readBits(2);
    switch(next){ case 0: c=String.fromCharCode(readBits(8)); break; case 1: c=String.fromCharCode(readBits(16)); break; case 2: return ""; }
    dictionary[3]=w=c; result.push(c);
    while(true){
      if(data.index>length) return "";
      const cc=readBits(numBits); let code=cc;
      if(code===0){ c=String.fromCharCode(readBits(8)); dictionary[dictSize++]=c; code=dictSize-1; enlargeIn--; }
      else if(code===1){ c=String.fromCharCode(readBits(16)); dictionary[dictSize++]=c; code=dictSize-1; enlargeIn--; }
      else if(code===2){ return result.join(''); }
      if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
      if(dictionary[code]) entry=dictionary[code];
      else if(code===dictSize) entry=w + w.charAt(0);
      else return null;
      result.push(entry); dictionary[dictSize++]=w + entry.charAt(0); enlargeIn--;
      w=entry; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
    }
  }
  return { cURI: compressToEncodedURIComponent, dURI: decompressFromEncodedURIComponent };
})();

/* ---------- المواقع الافتراضية (ثابتة الترتيب) ---------- */
const DEFAULT_SITES = [
  ['بوابة سمحان',24.742132284177778,46.569503913805825,'بوابة'],
  ['منطقة سمحان',24.74091335108621,46.571891407130025,'منطقة'],
  ['دوار البجيري',24.737521801476476,46.57406918772067,'دوار'],
  ['إشارة البجيري',24.73766260194535,46.575429040147306,'إشارة'],
  ['طريق الملك فيصل',24.736133848943062,46.57696607050239,'طريق'],
  ['نقطة فرز الشلهوب',24.73523670533632,46.57785639752234,'نقطة فرز'],
  ['المسار الرياضي المديد',24.735301077804944,46.58178092599035,'مسار رياضي'],
  ['ميدان الملك سلمان',24.73611373368281,46.58407097038162,'ميدان'],
  ['دوار الضوء الخافت',24.739718342668006,46.58352614787052,'دوار'],
  ['المسار الرياضي طريق الملك خالد الفرعي',24.740797019998627,46.5866145907347,'مسار رياضي'],
  ['دوار البلدية',24.739266101368777,46.58172727078356,'دوار'],
  ['مدخل ساحة البلدية الفرعي',24.738638518378387,46.579858026042785,'مدخل'],
  ['مدخل مواقف البجيري (كار بارك)',24.73826438056506,46.57789576275729,'مدخل'],
  ['مواقف الامن',24.73808736962705,46.57771858346317,'مواقف'],
  ['دوار الروقية',24.741985907266145,46.56269186990043,'دوار'],
  ['بيت مبارك',24.732609768937607,46.57827089439368,'موقع'],
  ['دوار وادي صفار',24.72491458984474,46.57345489743978,'دوار'],
  ['دوار راس النعامة',24.710329841152387,46.572921959358204,'دوار'],
  ['مزرعة الحبيب',24.709445443672344,46.593971867951346,'مزرعة']
];

/* مصفوفة كائنات من الافتراضيات */
function defaultState(){
  return {
    traffic:false,
    sites: DEFAULT_SITES.map(([name,lat,lng,type]) => ({
      id:'s-'+Math.random().toString(36).slice(2,8),
      name,type,lat,lng,recipients:[], style:{...DEF_STYLE}
    }))
  };
}

/* ---------- مشاركة c2 (قديمة) ---------- */
const nToB36 = n => Math.round(n).toString(36);
const b36ToN = s => parseInt(s,36);
function packSiteC2(s){
  const latE5=Math.round(s.lat*1e5), lngE5=Math.round(s.lng*1e5);
  const st=s.style||DEF_STYLE;
  const def = st.radius===DEF_STYLE.radius &&
              (st.fill||'').toLowerCase()===(DEF_STYLE.fill).toLowerCase() &&
              Math.abs((+st.fillOpacity)-(DEF_STYLE.fillOpacity))<1e-9 &&
              (st.stroke||'').toLowerCase()===(DEF_STYLE.stroke).toLowerCase() &&
              (st.strokeWeight||2)===(DEF_STYLE.strokeWeight);
  return [ s.name, s.type||'', nToB36(latE5), nToB36(lngE5),
           def?0:[st.radius||15,(st.fill||DEF_STYLE.fill).replace('#','').toLowerCase(),
           +(+st.fillOpacity).toFixed(2),(st.stroke||DEF_STYLE.stroke).replace('#','').toLowerCase(),st.strokeWeight||2],
           (s.recipients&&s.recipients.length)?s.recipients.join('|'):'' ];
}
function unpackSiteC2(a){
  const [name,type,latB,lngB,styleOr0,recStr=''] = a;
  const lat=b36ToN(latB)/1e5, lng=b36ToN(lngB)/1e5;
  let style={...DEF_STYLE};
  if(styleOr0 && styleOr0!==0){
    const [r,fillHex,fop,strokeHex,sw]=styleOr0;
    style={radius:r??15, fill:'#'+(fillHex||'60a5fa'), fillOpacity:fop??0.16, stroke:'#'+(strokeHex||'60a5fa'), strokeWeight:sw??2};
  }
  return { id:'s-'+Math.random().toString(36).slice(2,8), name,type,lat,lng,recipients:recStr?recStr.split('|'):[], style };
}
function encC2(state){ return toUrl(b64e(JSON.stringify({v:'c2', t:state.traffic?1:0, s:state.sites.map(packSiteC2)}))); }
function decC2(s){ try{ const o=JSON.parse(b64d(fromUrl(s))); if(o&&o.v==='c2'&&Array.isArray(o.s)) return {traffic:!!o.t, sites:o.s.map(unpackSiteC2)};}catch{} return null; }

/* ---------- مشاركة c3 (قديمة مضغوطة) ---------- */
function encC3(state){
  const c2json = JSON.stringify({v:'c2', t: state.traffic?1:0, s: state.sites.map(packSiteC2)});
  return 'c3.'+ LZ.cURI(c2json);
}
function decC3(x){
  try{ const raw=x.startsWith('c3.')?x.slice(3):x; const json=LZ.dURI(raw); const o=JSON.parse(json);
       if(o&&o.v==='c2'&&Array.isArray(o.s)) return {traffic:!!o.t, sites:o.s.map(unpackSiteC2)}; }catch{} return null;
}

/* ---------- مشاركة c4 (جديدة قصيرة جدًا بالـ Delta) ----------
   الشكل: {v:'c4', t:0/1, d:[ [i, r?, f?, p?, s?, w? , rec? ], ... ] }
   i = index للموقع الافتراضي (0..DEFAULT_SITES.length-1)
   r=radius (إن تغيّر عن 15)  f=fill hex بدون #  p=fillOpacity  s=stroke hex بدون #  w=strokeWeight
   rec = أسماء المستلمين مفصولة بـ "|"  (يُهمل إن لم توجد أسماء)
--------------------------------------------------------------- */
function toHexNoHash(c){ c=(c||'').toLowerCase(); return c.startsWith('#')?c.slice(1):c; }
function fromHexNoHash(h){ return '#'+(h||'60a5fa'); }

function buildIndexByNameLatLng(){
  const map = new Map();
  DEFAULT_SITES.forEach(([name,lat,lng], idx)=>{
    map.set(`${name}|${lat.toFixed(6)}|${lng.toFixed(6)}`, idx);
  });
  return map;
}
const DEF_INDEX = buildIndexByNameLatLng();

function encC4(state){
  const d = [];
  state.sites.forEach(s=>{
    // نحاول مطابقة الموقع الافتراضي بالاسم + الإحداثي
    const key = `${s.name}|${s.lat.toFixed(6)}|${s.lng.toFixed(6)}`;
    if(!DEF_INDEX.has(key)){
      // موقع غير موجود ضمن الافتراضي: نرسله كـ "إضافة" قصيرة: i = -1, ثم الإحداثيات والاسم (محدود)
      d.push([-1, +s.lat.toFixed(5), +s.lng.toFixed(5), s.name, s.type || '', s.recipients && s.recipients.length ? s.recipients.join('|') : '' ,
              s.style.radius!==DEF_STYLE.radius ? s.style.radius : undefined,
              s.style.fill!==DEF_STYLE.fill ? toHexNoHash(s.style.fill) : undefined,
              s.style.fillOpacity!==DEF_STYLE.fillOpacity ? +(s.style.fillOpacity).toFixed(2) : undefined,
              s.style.stroke!==DEF_STYLE.stroke ? toHexNoHash(s.style.stroke) : undefined,
              s.style.strokeWeight!==DEF_STYLE.strokeWeight ? s.style.strokeWeight : undefined
      ]);
      return;
    }
    const i = DEF_INDEX.get(key);
    const row = [i];

    // غيّرات النمط
    const st = s.style || DEF_STYLE;
    if(st.radius!==DEF_STYLE.radius) row[1]=st.radius;
    if((st.fill||'').toLowerCase()!==(DEF_STYLE.fill).toLowerCase()) row[2]=toHexNoHash(st.fill);
    if(+st.fillOpacity!==DEF_STYLE.fillOpacity) row[3]=+(st.fillOpacity).toFixed(2);
    if((st.stroke||'').toLowerCase()!==(DEF_STYLE.stroke).toLowerCase()) row[4]=toHexNoHash(st.stroke);
    if((st.strokeWeight||2)!==DEF_STYLE.strokeWeight) row[5]=st.strokeWeight;

    // مستلمين
    if(s.recipients && s.recipients.length) row[6]=s.recipients.join('|');

    d.push(row);
  });
  const payload = { v:'c4', t: state.traffic?1:0, d };
  return 'c4.' + LZ.cURI(JSON.stringify(payload));
}

function decC4(x){
  try{
    const raw = x.startsWith('c4.') ? x.slice(3) : x;
    const o = JSON.parse(LZ.dURI(raw));
    if(!(o && o.v==='c4' && Array.isArray(o.d))) return null;

    // ابدأ من الافتراضي
    const base = defaultState();
    const byIdx = base.sites;

    // طبّق الفروقات
    o.d.forEach(row=>{
      const i = row[0];
      if(i===-1){
        // إدخال يدوي خارج الافتراضي
        const lat=row[1], lng=row[2], name=row[3]||'موقع', type=row[4]||'نقطة';
        const rec = row[5]? String(row[5]).split('|').filter(Boolean):[];
        const r = row[6] ?? DEF_STYLE.radius;
        const f = row[7] ? fromHexNoHash(row[7]) : DEF_STYLE.fill;
        const p = row[8] ?? DEF_STYLE.fillOpacity;
        const s = row[9] ? fromHexNoHash(row[9]) : DEF_STYLE.stroke;
        const w = row[10] ?? DEF_STYLE.strokeWeight;
        byIdx.push({ id:'s-'+Math.random().toString(36).slice(2,8), name, type, lat, lng, recipients:rec,
                     style:{ radius:r, fill:f, fillOpacity:p, stroke:s, strokeWeight:w }});
        return;
      }
      if(i<0 || i>=byIdx.length) return;
      const site = byIdx[i];
      // نمط
      const r = row[1], f=row[2], p=row[3], s=row[4], w=row[5];
      if(r!==undefined) site.style.radius = r;
      if(f!==undefined) site.style.fill = fromHexNoHash(f);
      if(p!==undefined) site.style.fillOpacity = p;
      if(s!==undefined) site.style.stroke = fromHexNoHash(s);
      if(w!==undefined) site.style.strokeWeight = w;
      // مستلمين
      const rec=row[6];
      if(rec!==undefined) site.recipients = String(rec).split('|').filter(Boolean);
    });

    return { traffic: !!o.t, sites: byIdx };
  }catch{ return null; }
}

/* ---------- التخزين ---------- */
const LS_KEY='security:state.v3';
const loadLocal=()=>{ try{const s=localStorage.getItem(LS_KEY);return s?JSON.parse(s):null;}catch{return null;} };
const saveLocal=s=>{ try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch{} };

/* =====================  التطبيق  ===================== */
window.initMap = function () {
  const sp = qs();
  const isShare = (sp.get('view')||'').toLowerCase()==='share' || !!sp.get('x') || !!sp.get('s');
  if (isShare){ document.body.classList.add('share'); document.getElementById('panel')?.remove(); document.getElementById('editor')?.remove(); document.getElementById('edit-actions')?.remove(); }

  let state = defaultState();
  if (isShare){
    if (sp.get('x')) state = decC4(sp.get('x')) || decC3(sp.get('x')) || state; // x يدعم c4 ثم c3
    else if (sp.get('s')) state = decC3(sp.get('s')) || decC2(sp.get('s')) || state; // s قديم: c3 ثم c2
  } else {
    state = loadLocal() || state;
  }

  // الخريطة
  const map = new google.maps.Map(document.getElementById('map'), {
    center:{lat:24.7418,lng:46.5758}, zoom:14, mapTypeId:'roadmap',
    gestureHandling:'greedy', disableDefaultUI:false, mapTypeControl:true, zoomControl:true,
    streetViewControl:false, fullscreenControl:true
  });

  // حركة المرور
  const trafficLayer = new google.maps.TrafficLayer();
  let trafficOn = !!state.traffic;
  const trafficBtn = document.getElementById('traffic-toggle');
  function setTraffic(on){ trafficOn=!!on; trafficBtn?.setAttribute('aria-pressed', on?'true':'false'); trafficLayer.setMap(on?map:null); }
  setTraffic(trafficOn);
  trafficBtn?.addEventListener('click',()=>setTraffic(!trafficOn));

  // كرت
  const card=document.getElementById('info-card');
  const nameEl=document.getElementById('site-name');
  const typeEl=document.getElementById('site-type');
  const coordEl=document.getElementById('site-coord');
  const radiusEl=document.getElementById('site-radius');
  const recEl=document.getElementById('site-recipients');
  const editActions=document.getElementById('edit-actions');
  card.querySelector('.close').addEventListener('click',()=>{ pinnedId=null; closeCard(); });

  const markers=[], circles=[], byId=Object.create(null);
  let selectedId=null, pinnedId=null, hoverId=null;

  function renderRecipients(a){return (a&&a.length)?a.join('، '):'—';}
  function openCard(s){
    selectedId=s.id;
    nameEl.textContent=s.name||'—';
    typeEl.textContent=s.type||'—';
    coordEl.textContent=`${toFixed6(s.lat)}, ${toFixed6(s.lng)}`;
    radiusEl.textContent=`${s.style.radius} م`;
    recEl.textContent=renderRecipients(s.recipients);
    if(!isShare) editActions.classList.remove('hidden'); else editActions?.classList.add('hidden');
    card.classList.remove('hidden');
    if(!isShare){
      document.getElementById('ed-radius').value=s.style.radius;
      document.getElementById('ed-fill').value=s.style.fill;
      document.getElementById('ed-fillop').value=s.style.fillOpacity;
      document.getElementById('ed-stroke').value=s.style.stroke;
      document.getElementById('ed-stroke-w').value=s.style.strokeWeight;
    }
  }
  function closeCard(){ card.classList.add('hidden'); selectedId=null; hoverId=null; }

  const normHex = c => {c=(c||'#60a5fa').toLowerCase(); return c.startsWith('#')?c:('#'+c);};
  function snapshotFromMap(){
    const ed=document.getElementById('editor');
    if(ed && !ed.classList.contains('hidden') && typeof selectedId==='string'){
      const s=byId[selectedId];
      if(s){ s.recipients=(document.getElementById('editor-input').value||'').split('\n').map(x=>x.trim()).filter(Boolean); }
    }
    const sites = circles.map(c=>{
      const id=c.__id, s=byId[id]||{}, ctr=c.getCenter();
      return { id, name:s.name||'', type:s.type||'',
        lat:+ctr.lat(), lng:+ctr.lng(),
        recipients:Array.isArray(s.recipients)?s.recipients.slice():[],
        style:{ radius:+c.getRadius(), fill:normHex(c.get('fillColor')), fillOpacity:+c.get('fillOpacity'),
                stroke:normHex(c.get('strokeColor')), strokeWeight:+(c.get('strokeWeight')||2) } };
    });
    return { traffic:trafficOn, sites };
  }

  function syncFeature(s){
    const m=markers.find(x=>x.__id===s.id), c=circles.find(x=>x.__id===s.id);
    if(!m||!c) return;
    const pos={lat:s.lat,lng:s.lng};
    m.setPosition(pos); c.setCenter(pos);
    c.setOptions({ radius:s.style.radius, fillColor:s.style.fill, fillOpacity:s.style.fillOpacity,
                   strokeColor:s.style.stroke, strokeWeight:s.style.strokeWeight });
    if(selectedId===s.id){
      coordEl.textContent=`${toFixed6(s.lat)}, ${toFixed6(s.lng)}`;
      radiusEl.textContent=`${s.style.radius} م`;
      recEl.textContent=renderRecipients(s.recipients);
    }
    if(!isShare) saveLocal(snapshotFromMap());
  }

  function createFeature(s){
    byId[s.id]=s;
    const pos={lat:s.lat,lng:s.lng};
    const marker=new google.maps.Marker({
      position:pos,map,title:s.name,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#e11d48',fillOpacity:1,strokeColor:'#fff',strokeWeight:2},
      draggable:!isShare,zIndex:2
    });
    marker.__id=s.id; markers.push(marker);

    const circle=new google.maps.Circle({
      map,center:pos,radius:s.style.radius,
      strokeColor:s.style.stroke,strokeOpacity:0.95,strokeWeight:s.style.strokeWeight,
      fillColor:s.style.fill,fillOpacity:s.style.fillOpacity,
      clickable:true,cursor:'pointer',zIndex:1
    });
    circle.__id=s.id; circles.push(circle);

    const flash=()=>{circle.setOptions({strokeOpacity:1,fillOpacity:Math.min(s.style.fillOpacity+0.06,1)});
                     setTimeout(()=>circle.setOptions({strokeOpacity:0.95,fillOpacity:s.style.fillOpacity}),240);};
    const pinOpen=()=>{pinnedId=s.id; openCard(s); map.panTo(pos); flash();};
    marker.addListener('click',pinOpen);
    circle.addListener('click',pinOpen);
    circle.addListener('mouseover',()=>{ if(pinnedId) return; hoverId=s.id; openCard(s); flash(); });
    circle.addListener('mouseout', ()=>{ if(pinnedId) return; if(hoverId===s.id) closeCard(); });

    marker.addListener('dragend',e=>{ if(isShare) return; s.lat=e.latLng.lat(); s.lng=e.latLng.lng(); syncFeature(s); });
  }

  const bounds=new google.maps.LatLngBounds();
  state.sites.forEach(s=>{ createFeature(s); bounds.extend({lat:s.lat,lng:s.lng}); });
  if(isShare && !bounds.isEmpty()) map.fitBounds(bounds,60);

  // أدوات التحرير – الوضع العادي فقط
  if(!isShare){
    const toggleMarkers=document.getElementById('toggle-markers');
    const toggleCircles=document.getElementById('toggle-circles');
    const baseMapSel=document.getElementById('basemap');
    const shareBtn=document.getElementById('share-btn');
    const toastEl=document.getElementById('toast');
    const previewBox=document.getElementById('share-preview');
    const shareInput=document.getElementById('share-url');
    const openBtn=document.getElementById('open-url');

    const edRadius=document.getElementById('ed-radius');
    const edFill=document.getElementById('ed-fill');
    const edFillOp=document.getElementById('ed-fillop');
    const edStroke=document.getElementById('ed-stroke');
    const edStrokeW=document.getElementById('ed-stroke-w');
    const btnAdd=document.getElementById('btn-add');
    const btnDel=document.getElementById('btn-del');

    baseMapSel.value = map.getMapTypeId();
    toggleMarkers.addEventListener('change',()=>{ const on=toggleMarkers.checked; markers.forEach(m=>m.setMap(on?map:null)); });
    toggleCircles.addEventListener('change',()=>{ const on=toggleCircles.checked; circles.forEach(c=>c.setMap(on?map:null)); });
    baseMapSel.addEventListener('change',()=>map.setMapTypeId(baseMapSel.value));

    const withSel=fn=>{ if(!selectedId) return; const s=byId[selectedId]; fn(s); syncFeature(s); };
    edRadius.addEventListener('input', ()=>withSel(s=>s.style.radius=edRadius.valueAsNumber||parseInt(edRadius.value,10)));
    edFill  .addEventListener('input', ()=>withSel(s=>s.style.fill=(edFill.value||'#60a5fa').toLowerCase()));
    edFillOp.addEventListener('input', ()=>withSel(s=>s.style.fillOpacity=(edFillOp.valueAsNumber ?? parseFloat(edFillOp.value))));
    edStroke.addEventListener('input', ()=>withSel(s=>s.style.stroke=(edStroke.value||'#60a5fa').toLowerCase()));
    edStrokeW.addEventListener('input',()=>withSel(s=>s.style.strokeWeight=edStrokeW.valueAsNumber||parseInt(edStrokeW.value,10)));

    btnAdd.addEventListener('click',()=>{
      const c=map.getCenter();
      const s={id:'s-'+Math.random().toString(36).slice(2,8),name:'موقع جديد',type:'نقطة',lat:c.lat(),lng:c.lng(),recipients:[],style:{...DEF_STYLE}};
      state.sites.push(s); createFeature(s); bounds.extend({lat:s.lat,lng:s.lng});
      pinnedId=s.id; openCard(s); saveLocal(snapshotFromMap());
    });
    btnDel.addEventListener('click',()=>{
      if(!selectedId) return;
      const i=state.sites.findIndex(x=>x.id===selectedId);
      if(i>=0){
        const mi=markers.findIndex(m=>m.__id===selectedId);
        const ci=circles.findIndex(c=>c.__id===selectedId);
        if(mi>=0){ markers[mi].setMap(null); markers.splice(mi,1); }
        if(ci>=0){ circles[ci].setMap(null); circles.splice(ci,1); }
        delete byId[selectedId]; state.sites.splice(i,1);
        pinnedId=null; closeCard(); saveLocal(snapshotFromMap());
      }
    });

    // مشاركة قصيرة c4 + منع الكاش
    async function doShare(){
      const snap = snapshotFromMap();
      const x = encC4(snap); // قصير جدًا
      const url = `${location.origin}${location.pathname}?view=share&x=${x}&t=${Date.now()}`;
      previewBox?.classList.remove('hidden');
      if(shareInput) shareInput.value=url;

      let copied=false; try{ await navigator.clipboard.writeText(url); copied=true; }catch{}
      if(!copied && shareInput){ shareInput.focus(); shareInput.select(); }
      if(toastEl){ toastEl.textContent = "تم النسخ ✅ (افتح من المتصفح)"; toastEl.classList.remove('hidden'); setTimeout(()=>toastEl.classList.add('hidden'),2000); }
    }
    shareBtn.addEventListener('click', doShare);
    openBtn?.addEventListener('click',()=>{ if(shareInput?.value) window.open(shareInput.value,'_blank'); });
  }

  map.addListener('click',()=>{ pinnedId=null; closeCard(); });
  console.log(isShare ? 'Share View (locked / c4-ready)' : 'Editor View');
};
