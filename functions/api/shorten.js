export async function onRequestPost({request}) {
 try {
  const {url} = await request.json();
  const target = new URL(url);
  if (!['https:', 'http:'].includes(target.protocol) || target.toString().length > 10000) return Response.json({error:'Invalid URL'}, {status:400});
  const r = await fetch('https://is.gd/create.php?format=simple&url='+encodeURIComponent(target.toString()));
  const txt = await r.text();
  if (!r.ok || txt.startsWith('Error')) throw new Error('Shortener error');
  return Response.json({shortUrl:txt.trim()});
 } catch(e) {return Response.json({error:'Shortening failed'}, {status:502});}
}
