// api/archive.js
// Retourne la liste de toutes les dates disponibles dans l'archive

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const raw = await kvGet('feed:index');
    const index = raw ? JSON.parse(raw) : [];

    return new Response(JSON.stringify({ dates: index }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, dates: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function kvGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`KV get failed: ${await res.text()}`);
  const data = await res.json();
  return data.result;
}
