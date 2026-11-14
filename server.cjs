require('dotenv').config();
const express = require('express');
const zlib = require('zlib');
const app = express();
app.use(express.json({ limit: '50kb' }));
const e = process.env;
const OWNER = e.OWNER_NAME || '';
const NAME = e.AGENT_NAME || (OWNER ? OWNER + ' ረዳት' : 'የኔ ረዳት');
const fs = require('fs');
let F = {};
try { F = require('dotenv').parse(fs.readFileSync('.env')); } catch (x) {}
let RULES = F.IMPORTANT_RULES || '';
try { RULES += '\n' + fs.readFileSync('.env', 'utf8').split('\n').filter(l => /^\s*\d+\.\s/.test(l)).join('\n'); } catch (x) {}
RULES = RULES.trim();
const ABOUT = [
  e.ABOUT_OWNER,
  e.BUSINESS_TYPE && 'Business type: ' + e.BUSINESS_TYPE,
  e.SERVICES && 'Services: ' + e.SERVICES,
  e.LOCATION && 'Location: ' + e.LOCATION,
  e.PHONE_NUMBER && 'Phone: ' + e.PHONE_NUMBER,
  e.TIKTOK && 'TikTok: ' + e.TIKTOK,
  e.EMAIL && 'Email: ' + e.EMAIL,
  F.AGENT_ROLE && 'Your role: ' + F.AGENT_ROLE,
  F.LANGUAGE && 'Language to use (set by the owner, follow it): ' + F.LANGUAGE,
  F.PERSONALITY && 'Personality (set by the owner, follow it): ' + F.PERSONALITY,
  F.BRAND_SLOGAN && 'Brand slogan: ' + F.BRAND_SLOGAN,
  F.CUSTOMER_GOAL && 'Goal with customers: ' + F.CUSTOMER_GOAL,
  RULES && 'Important rules from the owner (always follow):\n' + RULES
].filter(Boolean).join('\n');
const TAGLINE = process.env.AGENT_TAGLINE || 'ለጨዋታም ለስራም ዝግጁ';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY በ.env ውስጥ የለም!'); process.exit(1); }
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 30;
const SYSTEM = [
  'You are "' + NAME + '", a personal AI assistant' + (OWNER ? ' that represents ' + OWNER + '.' : '.'),
  'Default language: Amharic (Ge\'ez script). If the user writes in another language, reply in that language. If the user writes Amharic in Latin letters, reply in Amharic script.',
  'Personality: warm, quick-witted and playful, like a smart funny friend, not a corporate bot. A little light humor is welcome. Use an emoji now and then, not in every message.',
  'LENGTH RULE: match the energy and size of the message. Greetings and small talk get 1 or 2 short lines, maybe a light joke or a fun question back to keep the chat going. Quick questions get short answers. Only real tasks (plans, writing, analysis, comparisons) get a longer structured answer. Never turn a greeting into a plan or a lecture.',
  'Be genuinely useful: when asked to do something, just do it. Ask at most one short clarifying question, and only if it is really needed.',
  'Formatting: plain text. You may use **bold** for key words. No markdown headers (#), no horizontal rules, no tables. Simple numbered lines like "1." are fine for steps.',
  'Never claim to be human. Do not invent facts about ' + (OWNER || 'the owner') + '; if you do not know something, say so briefly.',
  ABOUT ? 'Background about ' + (OWNER || 'the owner') + ' and what you can help with:\n' + ABOUT : '',
  ABOUT ? 'Customers may chat with you. For services, address and contact details use only the facts above. If something is not given (for example a price), say you do not know and suggest calling or messaging the business. Never invent prices. If a customer shows real interest (price, order, appointment), politely invite them once to share their name and phone number so the business can contact them; never pressure them.' : ''
].filter(Boolean).join('\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function callGemini(contents) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(20000), signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(d.error?.message || 'Gemini ' + r.status);
        err.status = r.status;
        throw err;
      }
      const text = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (!text) throw new Error('empty reply');
      return text;
    } catch (e) {
      last = e;
      console.error('try ' + (i + 1) + ': ' + e.message);
      if (e.status && ![500, 503].includes(e.status)) break;
      await sleep(1200 * (i + 1));
    }
  }
  throw last;
}
const callAI = callGemini;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 600000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE_LIMIT;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (!v.some(t => now - t < 600000)) hits.delete(k);
}, 600000).unref();
const tidy = t => t.replace(/([^\n።!?:፡])[ \t]*\n+[ \t]*(\*\*[^*\n]+\*\*)[ \t]*\n+[ \t]*/g, '$1 $2 ');
const PHONE = /(?:\+?251|0)[\s-]?[79](?:[\s-]?\d){8}/;
let ADMIN = process.env.ADMIN_KEY || '';
if (!ADMIN) {
  try { ADMIN = fs.readFileSync('admin_key.txt', 'utf8').trim(); }
  catch (x) { ADMIN = require('crypto').randomBytes(8).toString('hex'); fs.writeFileSync('admin_key.txt', ADMIN); }
}
app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN) return res.status(403).send('ተከልክሏል');
  let rows = [];
  try { rows = fs.readFileSync('chats.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (x) {}
  const by = new Map();
  rows.forEach(r => { if (!by.has(r.v)) by.set(r.v, []); by.get(r.v).push(r); });
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const list = [...by.entries()].map(([v, a]) => ({
    v, a, last: a[a.length - 1].t,
    phones: [...new Set(a.map(r => (String(r.q).match(PHONE) || [])[0]).filter(Boolean))]
  })).sort((x, y) => y.last - x.last);
  const card = c => '<div class="c' + (c.phones.length ? ' lead' : '') + '"><b>' + (c.phones.length ? '📞 ' + esc(c.phones.join(', ')) + ' · ' : '') + 'ደንበኛ ' + esc(c.v.slice(-4)) + '</b><small>' + new Date(c.last).toLocaleString('en-GB') + ' · ' + c.a.length + ' መልዕክት</small>' + c.a.map(r => '<p><i>' + esc(r.q) + '</i><br>' + esc(r.a) + '</p>').join('') + '</div>';
  const leads = list.filter(c => c.phones.length);
  const rest = list.filter(c => !c.phones.length);
  res.send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ደንበኞች</title><style>body{font:16px sans-serif;margin:12px;background:#111;color:#eee}.c{border:1px solid #333;border-radius:10px;padding:10px;margin:10px 0}.lead{border-color:#4ade80}small{color:#999;display:block}p{margin:8px 0}i{color:#a5b4fc}</style><h1>ደንበኞች</h1><h2>📞 ስልክ የሰጡ (' + leads.length + ')</h2>' + leads.map(card).join('') + '<h2>ሌሎች (' + rest.length + ')</h2>' + rest.map(card).join(''));
});
app.get('/api/info', (req, res) => res.json({ name: NAME, tagline: TAGLINE }));
app.post('/api/chat', async (req, res) => {
  try {
    const ip = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    if (limited(ip)) return res.status(429).json({ error: 'ብዙ ጥያቄዎች ተልከዋል። ትንሽ ቆይተው ይሞክሩ።' });
    const q = String(req.body.prompt || '').trim().slice(0, 2000);
    if (!q) return res.status(400).json({ error: 'መልዕክት ባዶ ነው።' });
    const hist = Array.isArray(req.body.history) ? req.body.history.slice(-12) : [];
    const contents = hist
      .filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      .map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, 2000) }] }));
    contents.push({ role: 'user', parts: [{ text: q }] });
    const reply = tidy(await callAI(contents));
    fs.appendFile('chats.jsonl', JSON.stringify({ t: Date.now(), v: String(req.body.vid || ip).slice(0, 40), q, a: reply }) + '\n', () => {});
    res.json({ reply });
  } catch (e) {
    console.error(e.message);
    const busy = e.status === 429 || e.status === 503;
    res.status(500).json({ error: busy ? 'አገልግሎቱ ለጊዜው ተጨናንቋል። ትንሽ ቆይተው ይሞክሩ።' : 'ለጊዜው አልተሳካም። እንደገና ይሞክሩ።' });
  }
});
app.get('/manifest.json', (req, res) => res.json({
  name: NAME,
  short_name: NAME.slice(0, 12),
  start_url: '/',
  display: 'standalone',
  background_color: '#0f1320',
  theme_color: '#4f46d8',
  lang: 'am',
  icons: [
    { src: '/icon/192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/icon/512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}));
app.get('/sw.js', (req, res) => {
  res.type('application/javascript').send('self.addEventListener("fetch", function () {});');
});
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const icons = new Map();
function makeIcon(size) {
  if (icons.has(size)) return icons.get(size);
  const bg = [79, 70, 216], fg = [255, 255, 255];
  const row = size * 3 + 1;
  const raw = Buffer.alloc(row * size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / size;
      const col = (d < 0.09 || (d > 0.19 && d < 0.30)) ? fg : bg;
      const o = y * row + 1 + x * 3;
      raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
  icons.set(size, png);
  return png;
}
app.get('/icon/:size.png', (req, res) => {
  const size = req.params.size === '512' ? 512 : 192;
  res.type('image/png').send(makeIcon(size));
});
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('http://localhost:' + PORT + ' | ' + NAME + ' | Gemini ' + GEMINI_MODEL);
});
