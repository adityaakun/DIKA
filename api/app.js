// Naelluxe API (Vercel serverless). Butuh env: ADMIN_PASSWORD + Upstash Redis (REST URL & token)
const E = process.env;
const pick = (re, not) => Object.keys(E).find(k => re.test(k) && E[k] && !(not && not.test(k)));
const uk = pick(/(REST_API_URL|REDIS_REST_URL)$/i);                       // KV_REST_API_URL / UPSTASH_REDIS_REST_URL / <PREFIX>_...
const tk = pick(/(REST_API_TOKEN|REDIS_REST_TOKEN)$/i, /READ_ONLY/i);
const U = uk && E[uk], T = tk && E[tk], HAS = !!(U && T);
const PASS = E.ADMIN_PASSWORD || '';
const noRedis = () => 'Redis belum terpasang. Variabel terdeteksi: ' + (Object.keys(E).filter(k => /redis|kv_|upstash|storage/i.test(k)).join(', ') || '(tidak ada)');
const KEY = 'naelluxe', auth = { Authorization: 'Bearer ' + T };

const J = async (u, o) => { const r = await fetch(u, o); if (!r.ok) throw Error(r.status); return r.json(); };
const rd = async () => { if (!HAS) return {}; const j = await J(`${U}/get/${KEY}`, { headers: auth }); return j.result ? JSON.parse(j.result) : {}; };
const wr = async b => { const r = await fetch(`${U}/set/${KEY}`, { method: 'POST', headers: auth, body: JSON.stringify(b) }); if (!r.ok) throw Error('Redis ' + r.status); };

const itunes = async q => {
  const i = (await J(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`)).results?.[0];
  return i && { title: i.trackName, artist: i.artistName, previewUrl: i.previewUrl, cover: i.artworkUrl100?.replace('100x100', '400x400') };
};

async function getSong(query) {
  const m = /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/i.exec(query);
  if (!m) return (await itunes(query)) || {};
  const html = await (await fetch(`https://open.spotify.com/embed/track/${m[1]}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const x = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
  const e = x && JSON.parse(x[1])?.props?.pageProps?.state?.data?.entity;
  const s = {
    title: e?.name, artist: e?.artists?.[0]?.name, previewUrl: e?.audioPreview?.url,
    cover: e?.coverArt?.sources?.slice(-1)[0]?.url || e?.visualIdentity?.image?.slice(-1)[0]?.url
  };
  if (s.title && !s.previewUrl) { // fallback iTunes kalau Spotify tidak memberi preview
    const t = await itunes(`${s.artist} ${s.title}`).catch(() => null);
    if (t) { s.previewUrl = t.previewUrl; s.cover = s.cover || t.cover; }
  }
  return s;
}

async function getLyrics(artist, title) {
  const t = title.replace(/\s*\(.*?\)\s*/g, '');
  let plain = '', synced = '';
  try {
    const r = await J(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(t)}`, { headers: { 'User-Agent': 'Naelluxe/1.0' } });
    const x = r.find(i => i.syncedLyrics) || r[0];
    synced = x?.syncedLyrics || ''; plain = x?.plainLyrics || '';
  } catch {}
  if (!plain && !synced) {
    try { plain = ((await J(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(t)}`)).lyrics || '').trim(); } catch {}
  }
  return { plain, synced };
}

module.exports = async (req, res) => {
  const q = req.query, a = q.a, ok = !!PASS && req.headers['x-admin'] === PASS;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (a === 'login') return res.json({ ok });
    if (a === 'get') return res.json({ ...await rd(), persist: HAS });
    if (a === 'lyrics') { res.setHeader('Cache-Control', 'public, s-maxage=86400'); return res.json(await getLyrics(q.artist || '', q.title || '')); }
    if (!ok) return res.status(401).json({ error: 'Password admin salah atau ADMIN_PASSWORD belum diatur' });
    if (a === 'song') return res.json((await getSong(String(q.q || ''))) || {});
    if (a === 'save' && req.method === 'POST') {
      if (!HAS) return res.status(500).json({ error: noRedis() });
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await wr({ profile: b.profile, songs: b.songs });
      return res.json({ ok: true });
    }
    res.status(404).json({ error: 'not found' });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
