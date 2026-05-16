// api/cron.js
// Ce fichier est appelé automatiquement chaque nuit à minuit par Vercel
// Il fetch les 10 projets du jour et les stocke dans la KV store

export const config = { runtime: 'edge' };

const SOURCES = [
  'Brand New (underconsideration.com)',
  'It\'s Nice That (itsnicethat.com)',
  'Eye Magazine (eyemagazine.com)',
  'Design Observer (designobserver.com)',
  'Fonts In Use (fontsinuse.com)',
  'Dezeen (dezeen.com)',
  'Slanted (slanted.de)',
  'Étapes (etapes.com)',
  'Mindsparkle Mag (mindsparklemag.com)'
];

export default async function handler(req) {
  // Sécurité : seul Vercel peut appeler ce endpoint (via le header secret)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const prompt = `Tu es un expert en design graphique et identité visuelle. Aujourd'hui le ${today}, génère une sélection de 10 projets de design graphique, branding et identité visuelle récents et remarquables publiés sur ces sources : ${SOURCES.join(', ')}.

Pour chaque projet retourne un objet JSON avec exactement ces champs :
- title: nom du projet ou de l'identité
- studio: studio ou designer responsable  
- client: le client ou la marque
- source: le site de publication (ex: "Brand New")
- sourceUrl: l'URL directe de l'article ou du projet
- imageUrl: une URL d'image accessible et directe représentant le projet (jpg/png/webp)
- analysis: analyse critique en français de 3-4 paragraphes — ce qui est intéressant, pourquoi c'est bien conçu, les choix typographiques, chromatiques, les intentions du studio
- tags: tableau de 2-3 mots-clés (ex: ["branding", "typographie", "packaging"])

Réponds UNIQUEMENT avec un tableau JSON valide de 10 objets. Pas de texte avant, pas de texte après, pas de backticks.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erreur OpenAI');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Format JSON invalide dans la réponse');

    const projects = JSON.parse(jsonMatch[0]);
    const dateKey = new Date().toISOString().split('T')[0]; // ex: 2024-05-16

    // Stocker dans Vercel KV
    await kvSet(`feed:${dateKey}`, JSON.stringify(projects));

    // Garder un index des dates disponibles
    const indexRaw = await kvGet('feed:index');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    if (!index.includes(dateKey)) {
      index.unshift(dateKey);
      // Garder max 90 jours
      if (index.length > 90) index.pop();
      await kvSet('feed:index', JSON.stringify(index));
    }

    return new Response(JSON.stringify({ success: true, date: dateKey, count: projects.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Cron error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ---- KV helpers (Vercel KV via REST API) ----
async function kvSet(key, value) {
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error(`KV set failed: ${await res.text()}`);
  return res.json();
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
