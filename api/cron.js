// api/cron.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const prompt = `Aujourd'hui le ${today}, cherche sur internet les projets de design graphique, branding et identite visuelle les plus recents et remarquables publies ces derniers jours sur ces sites : underconsideration.com/brandnew, itsnicethat.com, eyemagazine.com, designobserver.com, fontsinuse.com, dezeen.com, slanted.de, etapes.com, mindsparklemag.com.

Selectionne les 10 projets les plus interessants et retourne un tableau JSON avec exactement ces champs pour chacun :
- title: nom du projet
- studio: studio ou designer
- client: le client ou la marque
- source: nom du site (ex: "Brand New")
- sourceUrl: l'URL directe de l'article
- imageUrl: URL directe d'une image du projet (jpg/png/webp)
- analysis: analyse critique en francais de 3-4 paragraphes
- tags: tableau de 2-3 mots-cles

Reponds UNIQUEMENT avec un tableau JSON valide de 10 objets. Aucun texte avant, aucun texte apres, aucun backtick.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erreur OpenAI');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Format JSON invalide: ' + content.substring(0, 300));

    const projects = JSON.parse(jsonMatch[0]);
    const dateKey = new Date().toISOString().split('T')[0];

    await kvSet(`feed:${dateKey}`, JSON.stringify(projects));

    const indexRaw = await kvGet('feed:index');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    if (!index.includes(dateKey)) {
      index.unshift(dateKey);
      if (index.length > 90) index.pop();
      await kvSet('feed:index', JSON.stringify(index));
    }

    return new Response(JSON.stringify({ success: true, date: dateKey, count: projects.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function kvSet(key, value) {
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([value])
  });
  if (!res.ok) throw new Error(`KV set failed: ${await res.text()}`);
  return res.json();
}

async function kvGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result ?? null;
}
