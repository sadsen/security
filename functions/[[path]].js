export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.env.ASSETS.fetch(context.request);
  if (url.pathname !== '/' && url.pathname !== '/index.html' && response.status !== 404) return response;
  const index = await context.env.ASSETS.fetch(new URL('/index.html', url));
  if (!index.ok) return index;
  const key = context.env.GOOGLE_MAP_KEY || '';
  const html = (await index.text()).replaceAll('%GOOGLE_MAP_KEY%', encodeURIComponent(key));
  return new Response(html, { headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'} });
}
