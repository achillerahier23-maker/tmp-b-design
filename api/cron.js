// api/cron.js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const today = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    // ETAPE 1 : recherche web en texte libre
    const searchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [{
          role: 'user',
          content: `Aujourd'hui le ${today}. Cherche sur internet les 10 projets de design graphique, branding et identite visuelle les plus recents et interessants publies ces derniers jours sur ces sites : underconsideration.com/brandnew, itsnicethat.com, eyemagazine.com, designobserver.com, fontsinuse.com, dezeen.com, slanted.de, etapes.com, mindsparklemag.com.

Pour chaque projet trouve, donne-moi en texte libre :
- Le titre du projet
- Le studio ou designer
- Le client ou la marque
- Le site source et l'URL de l'article
- Une URL d'image directe si disponible
- Une analyse critique en francais de 2-3 paragraphes

Reponds en texte libre, pas de JSON.`
        }],
        max_tokens: 3000
      })
    });

    if (!searchResponse.ok) {
      const err = await searchResponse.json();
      throw new Error('Etape 1 failed: ' + (err.error?.message || searchResponse.status));
    }

    const searchData = await searchResponse.json();
    const rawText = searchData.choices[0]?.message?.content || '';

    if (!rawText || rawText.length < 100) {
      throw new Error('Etape 1 returned empty content');
    }

    // ETAPE 2 : convertir le texte en JSON propre
    const jsonResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `Voici une description de 10 projets de design graphique :

${rawText}

Convertis ces informations en un tableau JSON valide de 10 objets. Chaque objet doit avoir exactement ces champs :
- "title": string
- "studio": string  
- "client": string (vide si non mentionne)
- "source": string (nom du site, ex: "Brand New")
- "sourceUrl": string (URL de l'article)
- "imageUrl": string (URL image, ou "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=85" si pas d'image)
- "analysis": string (analyse en francais, utilise uniquement des apostrophes simples a l'interieur, jamais de guillemets doubles)
- "tags": array de 2-3 strings

Reponds UNIQUEMENT avec le tableau JSON. Aucun texte avant ou apres. Aucun backtick. Aucun markdown.`
          }
        ],
        max_tokens: 3000,
        temperature: 0.2
      })
    });

    if (!jsonResponse.ok) {
      const err = await jsonResponse.json();
      throw new Error('Etape 2 failed: ' + (err.error?.message || jsonResponse.status));
    }

    const jsonData = await jsonResponse.json();
    let jsonContent = jsonData.choices[0]?.message?.content || '';

    // Nettoyage defensif
    jsonContent = jsonContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();

    const jsonMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Pas de JSON valide trouve dans etape 2');

    const projects = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(projects) || projects.length === 0) {
      throw new Error('JSON parse OK mais tableau vide');
    }

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
