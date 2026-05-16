// api/feed.js
// Retourne les projets d'un jour donné (ou du jour courant par défaut)

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  try {
    const raw = await kvGet(`feed:${date}`);
    if (!raw) {
      return new Response(JSON.stringify({ projects: [], date, empty: true }), {
        status: 200,
        headers: corsHeaders()
      });
    }

    const projects = JSON.parse(raw);
    return new Response(JSON.stringify({ projects, date }), {
      status: 200,
      headers: corsHeaders()
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders()
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

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
}
