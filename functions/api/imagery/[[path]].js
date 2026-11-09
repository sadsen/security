export async function onRequestGet({request, env, params}) {
 const origin = new URL(request.url).origin;
 const ref = request.headers.get('referer') || '';
 if (!ref.startsWith(origin+'/')) return new Response(null,{status:403});
 const parts = String(params.path || '').split('/');
 if (parts.length !== 3 || parts.some(x=> !/^\d+$/.test(x))) return new Response(null,{status:400});
 const [z,y,x]=parts.map(Number);
 if(z>22 || y>=2**z || x>=2**z) return new Response(null,{status:400});
 if(!env.ARCGIS_API_KEY) return new Response(null,{status:503});
 const target=`https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${encodeURIComponent(env.ARCGIS_API_KEY)}`;
 try {
  const r=await fetch(target, {headers:{Referer:origin+'/'}, cf:{cacheTtl:3600,cacheEverything:true}});
  if(!r.ok || !(r.headers.get('content-type')||'').startsWith('image/')) return new Response(null,{status:502});
  return new Response(r.body,{headers:{'Content-Type':r.headers.get('content-type'), 'Cache-Control':'public, max-age=3600'}});
 } catch(e){return new Response(null,{status:502});}
}
