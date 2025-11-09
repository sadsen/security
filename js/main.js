/* =======================
   خريطة الأمن – main.js (stable)
   ======================= */

/* ---------- Helpers ---------- */
function toFixed6(x){ return Number(x).toFixed ? Number(x).toFixed(6) : x; }
function qs(){ return new URLSearchParams(location.search); }
function nz(v,d){ return (v===undefined || v===null)? d : v; }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
const DEF_STYLE = { radius:15, fill:'#60a5fa', fillOpacity:0.16, stroke:'#60a5fa', strokeWeight:2 };

/* ---------- Base64URL (للصيغة c2 القديمة) ---------- */
function b64e(s){ return btoa(unescape(encodeURIComponent(s))); }
function b64d(s){ return decodeURIComponent(escape(atob(s))); }
function toUrl(b){ return b.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function fromUrl(u){ var b=u.replace(/-/g,'+').replace(/_/g,'/'); while(b.length%4)b+='='; return b; }

/* ---------- LZ-String (URI-safe) ---------- */
var LZ=(function(){
  function o(r){return String.fromCharCode(r);}
  function compressToEncodedURIComponent(input){
    if(input==null) return "";
    return _compress(input,6,function(a){return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$".charAt(a);});
  }
  function _compress(uncompressed,bitsPerChar,getCharFromInt){
    if(uncompressed==null) return "";
    var i,value,dict={},dictCreate={},c="",wc="",w="",enlargeIn=2,dictSize=3,numBits=2,out=[],outVal=0,outPos=0;
    for(i=0;i<uncompressed.length;i++){
      c=uncompressed.charAt(i);
      if(!Object.prototype.hasOwnProperty.call(dict,c)){ dict[c]=dictSize++; dictCreate[c]=true; }
      wc=w+c;
      if(Object.prototype.hasOwnProperty.call(dict,wc)){ w=wc; }
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
    return encodeURIComponent(out.join(''));
  }
  function decompressFromEncodedURIComponent(input){
    if(input==null) return "";
    input=decodeURIComponent(input);
    if(input=="") return null;
    return _decompress(input.length,32,function(i){return input.charCodeAt(i);});
  }
  function _decompress(length,resetValue,getNextValue){
    var dictionary=[],result=[],data={val:getNextValue(0),position:resetValue,index:1};
    var enlargeIn=4,dictSize=4,numBits=3,entry="",w,c,bits,resb,maxpower,power;
    for(var i=0;i<3;i++) dictionary[i]=i;
    function readBits(n){
      bits=0; maxpower=Math.pow(2,n); power=1;
      while(power!=maxpower){
        resb=data.val & data.position; data.position>>=1;
        if(data.position==0){ data.position=resetValue; data.val=getNextValue(data.index++); }
        bits |= (resb>0?1:0)*power; power<<=1;
      }
      return bits;
    }
    var next=readBits(2);
    switch(next){ case 0: c=o(readBits(8)); break; case 1: c=o(readBits(16)); break; case 2: return ""; }
    dictionary[3]=w=c; result.push(c);
    while(true){
      if(data.index>length) return "";
      var cc=readBits(numBits); var code=cc;
      if(code===0){ c=o(readBits(8)); dictionary[dictSize++]=c; code=dictSize-1; enlargeIn--; }
      else if(code===1){ c=o(readBits(16)); dictionary[dictSize++]=c; code=dictSize-1; enlargeIn--; }
      else if(code===2){ return result.join(''); }
      if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
      if(dictionary[code]) entry=dictionary[code];
      else if(code===dictSize) entry=w + w.charAt(0);
      else return null;
      result.push(entry); dictionary[dictSize++]=w + entry.charAt(0); enlargeIn--;
      w=entry; if(enlargeIn==0){ enlargeIn=Math.pow(2,numBits); numBits++; }
    }
  }
  return { cURI:compressToEncodedURIComponent, dURI:decompressFromEncodedURIComponent };
})();

/* ---------- المواقع الافتراضية ---------- */
var DEFAULT_SITES = [
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

function defaultState(){
  var s = DEFAULT_SITES.map(function(x){
    return { id:'s-'+Math.random().toString(36).slice(2,8), name:x[0], lat:x[1], lng:x[2], type:x[3], recipients:[], style:clone(DEF_STYLE) };
  });
  return { traffic:false, sites:s };
}

/* ---------- ترميز المشاركة c2/c3/c4 ---------- */
var nToB36=function(n){ return Math.round(n).toString(36); };
var b36ToN=function(s){ return parseInt(s,36); };

function packSiteC2(s){
  var latE5=Math.round(s.lat*1e5), lngE5=Math.round(s.lng*1e5);
  var st=s.style||DEF_STYLE;
  var def = st.radius===DEF_STYLE.radius &&
            String(st.fill).toLowerCase()===String(DEF_STYLE.fill).toLowerCase() &&
            +st.fillOpacity===DEF_STYLE.fillOpacity &&
            String(st.stroke).toLowerCase()===String(DEF_STYLE.stroke).toLowerCase() &&
            (st.strokeWeight||2)===DEF_STYLE.strokeWeight;
  return [ s.name, s.type||'', nToB36(latE5), nToB36(lngE5),
           def?0:[st.radius||15,String(st.fill||DEF_STYLE.fill).replace('#','').toLowerCase(),
                  +( +st.fillOpacity ).toFixed(2), String(st.stroke||DEF_STYLE.stroke).replace('#','').toLowerCase(), st.strokeWeight||2],
           (s.recipients&&s.recipients.length)?s.recipients.join('|'):'' ];
}
function unpackSiteC2(a){
  var name=a[0],type=a[1],latB=a[2],lngB=a[3],styleOr0=a[4],recStr=a[5]||'';
  var lat=b36ToN(latB)/1e5, lng=b36ToN(lngB)/1e5;
  var style=clone(DEF_STYLE);
  if(styleOr0 && styleOr0!==0){
    var r=styleOr0[0], fillHex=styleOr0[1], fop=styleOr0[2], strokeHex=styleOr0[3], sw=styleOr0[4];
    style={radius:nz(r,15), fill:'#'+(fillHex||'60a5fa'), fillOpacity:nz(fop,0.16), stroke:'#'+(strokeHex||'60a5fa'), strokeWeight:nz(sw,2)};
  }
  return { id:'s-'+Math.random().toString(36).slice(2,8), name:name, type:type, lat:lat, lng:lng, recipients:recStr?recStr.split('|'):[], style:style };
}
function encC2(state){ return toUrl(b64e(JSON.stringify({v:'c2', t:state.traffic?1:0, s:state.sites.map(packSiteC2)}))); }
function decC2(s){ try{ var o=JSON.parse(b64d(fromUrl(s))); if(o&&o.v==='c2'&&Array.isArray(o.s)) return {traffic:!!o.t, sites:o.s.map(unpackSiteC2)}; }catch(e){} return null; }
function encC3(state){ var c2=JSON.stringify({v:'c2',t:state.traffic?1:0,s:state.sites.map(packSiteC2)}); return 'c3.'+LZ.cURI(c2); }
function decC3(x){ try{ var raw=x.indexOf('c3.')===0?x.slice(3):x; var o=JSON.parse(LZ.dURI(raw)); if(o&&o.v==='c2'&&Array.isArray(o.s)) return {traffic:!!o.t, sites:o.s.map(unpackSiteC2)}; }catch(e){} return null; }

/* c4: Delta قصيرة جدًا */
function toHexNoHash(c){ c=(c||'').toLowerCase(); return c.charAt(0)==='#'?c.slice(1):c; }
function fromHexNoHash(h){ return '#'+(h||'60a5fa'); }
function buildIndexByNameLatLng(){
  var map={}; for(var i=0;i<DEFAULT_SITES.length;i++){
    var it=DEFAULT_SITES[i]; map[it[0]+'|'+it[1].toFixed(6)+'|'+it[2].toFixed(6)]=i;
  } return map;
}
var DEF_INDEX=buildIndexByNameLatLng();
function encC4(state){
  var d=[];
  state.sites.forEach(function(s){
    var key=s.name+'|'+s.lat.toFixed(6)+'|'+s.lng.toFixed(6);
    if(DEF_INDEX[key]===undefined){
      d.push([-1, +s.lat.toFixed(5), +s.lng.toFixed(5), s.name, s.type||'',
              (s.recipients&&s.recipients.length)?s.recipients.join('|'):'',
              s.style.radius!==DEF_STYLE.radius?s.style.radius:undefined,
              s.style.fill!==DEF_STYLE.fill?toHexNoHash(s.style.fill):undefined,
              s.style.fillOpacity!==DEF_STYLE.fillOpacity?+Number(s.style.fillOpacity).toFixed(2):undefined,
              s.style.stroke!==DEF_STYLE.stroke?toHexNoHash(s.style.stroke):undefined,
              s.style.strokeWeight!==DEF_STYLE.strokeWeight?s.style.strokeWeight:undefined]);
      return;
    }
    var i=DEF_INDEX[key]; var row=[i], st=s.style||DEF_STYLE;
    if(st.radius!==DEF_STYLE.radius) row[1]=st.radius;
    if(String(st.fill).toLowerCase()!==String(DEF_STYLE.fill).toLowerCase()) row[2]=toHexNoHash(st.fill);
    if(+st.fillOpacity!==DEF_STYLE.fillOpacity) row[3]=+Number(st.fillOpacity).toFixed(2);
    if(String(st.stroke).toLowerCase()!==String(DEF_STYLE.stroke).toLowerCase()) row[4]=toHexNoHash(st.stroke);
    if((st.strokeWeight||2)!==DEF_STYLE.strokeWeight) row[5]=st.strokeWeight;
    if(s.recipients && s.recipients.length) row[6]=s.recipients.join('|');
    d.push(row);
  });
  return 'c4.'+LZ.cURI(JSON.stringify({v:'c4', t:state.traffic?1:0, d:d}));
}
function decC4(x){
  try{
    var raw=x.indexOf('c4.')===0?x.slice(3):x;
    var o=JSON.parse(LZ.dURI(raw)); if(!(o&&o.v==='c4'&&Array.isArray(o.d))) return null;
    var base=defaultState(); var arr=base.sites;
    o.d.forEach(function(row){
      var i=row[0];
      if(i===-1){
        var lat=row[1],lng=row[2],name=row[3]||'موقع',type=row[4]||'نقطة';
        var rec=row[5]?String(row[5]).split('|').filter(Boolean):[];
        var r=nz(row[6],DEF_STYLE.radius);
        var f=row[7]?fromHexNoHash(row[7]):DEF_STYLE.fill;
        var p=nz(row[8],DEF_STYLE.fillOpacity);
        var s=row[9]?fromHexNoHash(row[9]):DEF_STYLE.stroke;
        var w=nz(row[10],DEF_STYLE.strokeWeight);
        arr.push({ id:'s-'+Math.random().toString(36).slice(2,8), name:name, type:type, lat:lat, lng:lng, recipients:rec,
                   style:{radius:r,fill:f,fillOpacity:p,stroke:s,strokeWeight:w}});
        return;
      }
      if(i<0||i>=arr.length) return;
      var site=arr[i];
      var r2=row[1], f2=row[2], p2=row[3], s2=row[4], w2=row[5], rec2=row[6];
      if(r2!==undefined) site.style.radius=r2;
      if(f2!==undefined) site.style.fill=fromHexNoHash(f2);
      if(p2!==undefined) site.style.fillOpacity=p2;
      if(s2!==undefined) site.style.stroke=fromHexNoHash(s2);
      if(w2!==undefined) site.style.strokeWeight=w2;
      if(rec2!==undefined) site.recipients=String(rec2).split('|').filter(Boolean);
    });
    return { traffic: !!o.t, sites: arr };
  }catch(e){ return null; }
}

/* ---------- التخزين ---------- */
var LS_KEY='security:state.v3';
function loadLocal(){ try{var s=localStorage.getItem(LS_KEY); return s?JSON.parse(s):null;}catch(e){return null;} }
function saveLocal(v){ try{localStorage.setItem(LS_KEY,JSON.stringify(v));}catch(e){} }

/* =====================  التطبيق  ===================== */
window.initMap = function () {
  var sp = qs();
  var isShare = (String(sp.get('view')||'').toLowerCase()==='share') || !!sp.get('x') || !!sp.get('s');
  if (isShare){
    var p=document.getElementById('panel'); if(p) p.remove();
    var ed=document.getElementById('editor'); if(ed) ed.remove();
    var ea=document.getElementById('edit-actions'); if(ea) ea.remove();
    document.body.classList.add('share');
  }

  var state = defaultState();
  if (isShare){
    if (sp.get('x')) state = decC4(sp.get('x')) || decC3(sp.get('x')) || state;
    else if (sp.get('s')) state = decC3(sp.get('s')) || decC2(sp.get('s')) || state;
  } else {
    state = loadLocal() || state;
  }

  var map = new google.maps.Map(document.getElementById('map'), {
    center:{lat:24.7418,lng:46.5758}, zoom:14, mapTypeId:'roadmap',
    gestureHandling:'greedy', disableDefaultUI:false, mapTypeControl:true, zoomControl:true,
    streetViewControl:false, fullscreenControl:true
  });

  /* حركة المرور */
  var trafficLayer = new google.maps.TrafficLayer();
  var trafficBtn=document.getElementById('traffic-toggle');
  var trafficOn = !!state.traffic;
  function setTraffic(on){ trafficOn=!!on; if(trafficBtn) trafficBtn.setAttribute('aria-pressed', on?'true':'false'); trafficLayer.setMap(on?map:null); }
  setTraffic(trafficOn);
  if(trafficBtn) trafficBtn.addEventListener('click',function(){ setTraffic(!trafficOn); });

  /* كرت المعلومات */
  var card=document.getElementById('info-card');
  var nameEl=document.getElementById('site-name');
  var typeEl=document.getElementById('site-type');
  var coordEl=document.getElementById('site-coord');
  var radiusEl=document.getElementById('site-radius');
  var recEl=document.getElementById('site-recipients');
  var editActions=document.getElementById('edit-actions');
  var closeBtn = card ? card.querySelector('.close') : null;
  if(closeBtn) closeBtn.addEventListener('click',function(){ pinnedId=null; closeCard(); });

  // عناصر تحرير المستلمين
  var editBtn      = document.getElementById('edit-recipients'); // زر "تعديل المستلمين"
  var editorBox    = document.getElementById('editor');          // صندوق التحرير
  var editorInput  = document.getElementById('editor-input');    // textarea
  var editorClose  = document.getElementById('editor-close');    // زر إغلاق
  var editorSave   = document.getElementById('editor-save');     // زر حفظ
  var editorCancel = document.getElementById('editor-cancel');   // زر إلغاء
  var editorOriginal = [];                                       // لحفظ النسخة قبل التحرير

  var markers=[], circles=[], byId={};
  var selectedId=null, pinnedId=null, hoverId=null;

  function renderRecipients(a){ return (a&&a.length)?a.join('، '):'—'; }
  function openCard(s){
    selectedId=s.id;
    if(nameEl) nameEl.textContent=s.name||'—';
    if(typeEl) typeEl.textContent=s.type||'—';
    if(coordEl) coordEl.textContent=toFixed6(s.lat)+', '+toFixed6(s.lng);
    if(radiusEl) radiusEl.textContent=(s.style.radius)+' م';
    if(recEl) recEl.textContent=renderRecipients(s.recipients);
    if(editActions){ if(!isShare) editActions.classList.remove('hidden'); else editActions.classList.add('hidden'); }
    if(card) card.classList.remove('hidden');

    if(!isShare){
      var er=document.getElementById('ed-radius'); if(er) er.value=s.style.radius;
      var ef=document.getElementById('ed-fill'); if(ef) ef.value=s.style.fill;
      var epo=document.getElementById('ed-fillop'); if(epo) epo.value=s.style.fillOpacity;
      var es=document.getElementById('ed-stroke'); if(es) es.value=s.style.stroke;
      var esw=document.getElementById('ed-stroke-w'); if(esw) esw.value=s.style.strokeWeight;
      if(editorInput) editorInput.value=(s.recipients||[]).join('\n');
    }
  }
  function closeCard(){ if(card) card.classList.add('hidden'); selectedId=null; hoverId=null; }

  function openEditor(s){
    if(!editorBox) return;
    editorOriginal = (s.recipients || []).slice();           // حفظ النسخة الأصلية
    editorBox.classList.remove('hidden');
    if(editorInput){
      editorInput.value = editorOriginal.join('\n');
      setTimeout(function(){ try{editorInput.focus(); editorInput.selectionStart=editorInput.value.length; editorInput.selectionEnd=editorInput.value.length;}catch(e){} },0);
    }
  }
  function closeEditor(){ if(editorBox) editorBox.classList.add('hidden'); }

  if(editBtn){
    editBtn.addEventListener('click',function(){
      if(isShare) return;            // في وضع العرض لا تحرير
      if(!selectedId) return;
      var s=byId[selectedId]; if(s) openEditor(s);
    });
  }
  if(editorClose)  editorClose.addEventListener('click',function(){ closeEditor(); });
  if(editorCancel) editorCancel.addEventListener('click',function(){
    if(!selectedId) return;
    var s=byId[selectedId]; if(!s) return;
    s.recipients = editorOriginal.slice();                   // استرجاع الأصل
    if(editorInput) editorInput.value = editorOriginal.join('\n');
    if(recEl) recEl.textContent = renderRecipients(s.recipients);
    saveLocal(snapshotFromMap());
    closeEditor();
  });
  if(editorSave) editorSave.addEventListener('click',function(){
    if(!selectedId) return;
    var s=byId[selectedId]; if(!s) return;
    var txt = editorInput ? String(editorInput.value||'') : '';
    s.recipients = txt.split('\n').map(function(x){return x.trim();}).filter(Boolean);
    if(recEl) recEl.textContent = renderRecipients(s.recipients);
    saveLocal(snapshotFromMap());
    closeEditor();
  });

  // تحديث أثناء الكتابة (اختياري: يظل موجودًا)
  if(editorInput) editorInput.addEventListener('input',function(){
    if(!selectedId) return; var ss=byId[selectedId];
    ss.recipients=String(editorInput.value||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
    if(recEl) recEl.textContent=renderRecipients(ss.recipients);
    saveLocal(snapshotFromMap());
  });

  function getCircleById(id){ for(var i=0;i<circles.length;i++){ if(circles[i].__id===id) return circles[i]; } return null; }
  function normHex(c){ c=String(c||'#60a5fa').toLowerCase(); return c.charAt(0)==='#'?c:'#'+c; }

  function snapshotFromMap(){
    var sites = circles.map(function(c){
      var id=c.__id, s=byId[id]||{}, ctr=c.getCenter();
      return { id:id, name:s.name||'', type:s.type||'',
        lat:+ctr.lat(), lng:+ctr.lng(),
        recipients:Array.isArray(s.recipients)?s.recipients.slice():[],
        style:{ radius:+c.getRadius(), fill:normHex(c.get('fillColor')), fillOpacity:+c.get('fillOpacity'),
                stroke:normHex(c.get('strokeColor')), strokeWeight:+(c.get('strokeWeight')||2) } };
    });
    return { traffic:trafficOn, sites:sites };
  }

  function syncFeature(s){
    var m=null, c=null, i;
    for(i=0;i<markers.length;i++) if(markers[i].__id===s.id){ m=markers[i]; break; }
    for(i=0;i<circles.length;i++) if(circles[i].__id===s.id){ c=circles[i]; break; }
    if(!m||!c) return;
    var pos={lat:s.lat,lng:s.lng};
    m.setPosition(pos); c.setCenter(pos);
    c.setOptions({ radius:s.style.radius, fillColor:s.style.fill, fillOpacity:s.style.fillOpacity,
                   strokeColor:s.style.stroke, strokeWeight:s.style.strokeWeight });
    if(selectedId===s.id){
      if(coordEl) coordEl.textContent=toFixed6(s.lat)+', '+toFixed6(s.lng);
      if(radiusEl) radiusEl.textContent=(s.style.radius)+' م';
      if(recEl) recEl.textContent=renderRecipients(s.recipients);
    }
    if(!isShare) saveLocal(snapshotFromMap());
  }

  function createFeature(s){
    byId[s.id]=s;
    var pos={lat:s.lat,lng:s.lng};

    var marker=new google.maps.Marker({
      position:pos,map:map,title:s.name,
      icon:{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#e11d48',fillOpacity:1,strokeColor:'#fff',strokeWeight:2},
      draggable:!isShare,zIndex:2
    });
    marker.__id=s.id; markers.push(marker);

    var circle=new google.maps.Circle({
      map:map, center:pos, radius:s.style.radius,
      strokeColor:s.style.stroke, strokeOpacity:0.95, strokeWeight:s.style.strokeWeight,
      fillColor:s.style.fill,  fillOpacity:s.style.fillOpacity,
      clickable:true, cursor:'pointer', zIndex:1,
      editable:false                      // ⚠️ لا مقابض تكبير/تصغير – التغيير من الإعدادات فقط
    });
    circle.__id=s.id; circles.push(circle);

    function flash(){ circle.setOptions({strokeOpacity:1,fillOpacity:Math.min(s.style.fillOpacity+0.06,1)}); setTimeout(function(){ circle.setOptions({strokeOpacity:0.95,fillOpacity:s.style.fillOpacity}); },240); }
    function pinOpen(){ pinnedId=s.id; openCard(s); map.panTo(pos); flash(); }
    marker.addListener('click',pinOpen);
    circle.addListener('click',pinOpen);
    circle.addListener('mouseover',function(){ if(pinnedId) return; hoverId=s.id; openCard(s); flash(); });
    circle.addListener('mouseout', function(){ if(pinnedId) return; if(hoverId===s.id) closeCard(); });

    marker.addListener('dragend',function(e){ if(isShare) return; s.lat=e.latLng.lat(); s.lng=e.latLng.lng(); syncFeature(s); });
  }

  var bounds=new google.maps.LatLngBounds();
  for(var i=0;i<state.sites.length;i++){ var s=state.sites[i]; createFeature(s); bounds.extend({lat:s.lat,lng:s.lng}); }
  if(isShare && !bounds.isEmpty()) map.fitBounds(bounds,60);

  /* أدوات التحرير */
  if(!isShare){
    var toggleMarkers=document.getElementById('toggle-markers');
    var toggleCircles=document.getElementById('toggle-circles');
    var baseMapSel=document.getElementById('basemap');
    var shareBtn=document.getElementById('share-btn');
    var toastEl=document.getElementById('toast');
    var previewBox=document.getElementById('share-preview');
    var shareInput=document.getElementById('share-url');
    var openBtn=document.getElementById('open-url');

    var edRadius=document.getElementById('ed-radius');
    var edFill=document.getElementById('ed-fill');
    var edFillOp=document.getElementById('ed-fillop');
    var edStroke=document.getElementById('ed-stroke');
    var edStrokeW=document.getElementById('ed-stroke-w');
    var btnAdd=document.getElementById('btn-add');
    var btnDel=document.getElementById('btn-del');

    if(baseMapSel){ baseMapSel.value = map.getMapTypeId(); baseMapSel.addEventListener('change',function(){ map.setMapTypeId(baseMapSel.value); }); }
    if(toggleMarkers) toggleMarkers.addEventListener('change',function(){ var on=toggleMarkers.checked; markers.forEach(function(m){ m.setMap(on?map:null); }); });
    if(toggleCircles) toggleCircles.addEventListener('change',function(){ var on=toggleCircles.checked; circles.forEach(function(c){ c.setMap(on?map:null); }); });

    function applyLive(fn){
      if(!selectedId) return;
      var s=byId[selectedId], c=getCircleById(selectedId);
      if(!s||!c) return;
      fn(s,c); saveLocal(snapshotFromMap());
    }

    if(edRadius) edRadius.addEventListener('input',function(){
      applyLive(function(s,c){
        var r = edRadius.valueAsNumber || parseInt(edRadius.value,10) || 15;
        s.style.radius=r; c.setRadius(r);
        if(radiusEl) radiusEl.textContent=r+' م';
      });
    });
    if(edFill) edFill.addEventListener('input',function(){
      applyLive(function(s,c){ var v=(edFill.value||'#60a5fa').toLowerCase(); s.style.fill=v; c.setOptions({fillColor:v}); });
    });
    if(edFillOp) edFillOp.addEventListener('input',function(){
      applyLive(function(s,c){
        var vv = (edFillOp.valueAsNumber!=null ? edFillOp.valueAsNumber : parseFloat(edFillOp.value));
        if(isNaN(vv)) vv = 0.16;
        s.style.fillOpacity=vv; c.setOptions({fillOpacity:vv});
      });
    });
    if(edStroke) edStroke.addEventListener('input',function(){
      applyLive(function(s,c){ var v=(edStroke.value||'#60a5fa').toLowerCase(); s.style.stroke=v; c.setOptions({strokeColor:v}); });
    });
    if(edStrokeW) edStrokeW.addEventListener('input',function(){
      applyLive(function(s,c){
        var v=edStrokeW.valueAsNumber || parseInt(edStrokeW.value,10); if(!v) v=2;
        s.style.strokeWeight=v; c.setOptions({strokeWeight:v});
      });
    });

    // مشاركة قصيرة c4 + منع الكاش للجوال
    async function doShare(){
      if(selectedId && editorInput){
        var ss=byId[selectedId];
        ss.recipients=String(editorInput.value||'').split('\n').map(function(x){return x.trim();}).filter(Boolean);
      }
      var x = encC4(snapshotFromMap());
      var url = location.origin+location.pathname+'?view=share&x='+x+'&t='+(Date.now());
      if(previewBox) previewBox.classList.remove('hidden');
      if(shareInput) shareInput.value=url;
      var copied=false; try{ await navigator.clipboard.writeText(url); copied=true; }catch(e){}
      if(!copied && shareInput){ shareInput.focus(); shareInput.select(); }
      if(toastEl){ toastEl.textContent='تم النسخ ✅ (افتح من المتصفح)'; toastEl.classList.remove('hidden'); setTimeout(function(){ toastEl.classList.add('hidden'); },2000); }
    }
    if(shareBtn) shareBtn.addEventListener('click',doShare);
    if(openBtn) openBtn.addEventListener('click',function(){ if(shareInput&&shareInput.value) window.open(shareInput.value,'_blank'); });
  }

  map.addListener('click',function(){ pinnedId=null; closeCard(); });
  console.log(isShare ? 'Share View (locked / c4)' : 'Editor View');
};
