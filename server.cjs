require('dotenv').config();
const express = require('express');
const zlib = require('zlib');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '50kb' }));

const e = process.env;
const OWNER = e.OWNER_NAME || 'SEYA DESIGN';
const NAME = e.AGENT_NAME || 'የSEYA DESIGN ረዳት';
const TAGLINE = e.AGENT_TAGLINE || 'WEAR CONFIDENCE ✨ | ዘመናዊ የሴቶች ፋሽን ዲዛይንና ስፌት';

// ቀድሞ ይሰራልህ የነበረው የራስህ ኦሪጅናል አሰራር (ከ .env የሚያነበው)
const GEMINI_KEY = e.GEMINI_API_KEY;
const GEMINI_MODEL = e.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const TG_TOKEN = e.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = e.ADMIN_CHAT_ID;

const RULES = e.IMPORTANT_RULES || '1. ሁልጊዜ ደንበኞችን በአክብሮት መመለስ።\n2. የማይታወቅ ዋጋ በግምት አለመናገር።';

const ABOUT = [
  e.ABOUT_OWNER, 'Business type: ' + e.BUSINESS_TYPE, 'Services: ' + e.SERVICES, 'Location: ' + e.LOCATION, 'Phone: ' + e.PHONE_NUMBER, 'TikTok: ' + e.TIKTOK, 'Email: ' + e.EMAIL, 'Your role: ' + e.AGENT_ROLE, 'Language to use: ' + e.LANGUAGE, 'Personality: ' + e.PERSONALITY, 'Brand slogan: ' + e.BRAND_SLOGAN, 'Important rules:\n' + RULES
].filter(Boolean).join('\n');

const SYSTEM = `You are "${NAME}", assistant for "${OWNER}".\nDefault language: Amharic.\n${ABOUT}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callAI(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'Error');
      return d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'ይቅርታ፣ አሁን አልተረዳሁም።';
    } catch (err) {
      if (i === 2) throw err;
      await sleep(1500);
    }
  }
}

app.get('/api/info', (req, res) => res.json({ name: NAME, tagline: TAGLINE }));

app.post('/api/chat', async (req, res) => {
  try {
    const q = String(req.body.prompt || '').trim().slice(0, 2000);
    if (!q) return res.status(400).json({ error: 'ባዶ ነው።' });
    const contents = (req.body.history || []).slice(-12).map(h => ({ role: h.role, parts: [{ text: h.text }] }));
    contents.push({ role: 'user', parts: [{ text: q }] });
    
    const reply = await callAI(contents);
    
    if (TG_TOKEN && ADMIN_ID) {
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_ID, text: `🔔 <b>አዲስ ጥያቄ (SEYA DESIGN)</b>\n❓ <b>ደንበኛ:</b> ${q}\n🤖 <b>መልስ:</b> ${reply.slice(0, 800)}`, parse_mode: 'HTML' })
      }).catch(()=>{});
    }
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: 'ለጊዜው አልተሳካም። እንደገና ይሞክሩ።' });
  }
});

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); }
const icons = new Map();
function makeIcon(size) { if (icons.has(size)) return icons.get(size); const bg = [79, 70, 216], fg = [255, 255, 255]; const row = size * 3 + 1; const raw = Buffer.alloc(row * size); const c = size / 2; for (let y = 0; y < size; y++) { for (let x = 0; x < size; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / size; const col = (d < 0.09 || (d > 0.19 && d < 0.30)) ? fg : bg; const o = y * row + 1 + x * 3; raw[o] = col[0]; raw[o + 1] = col[1]; raw[o + 2] = col[2]; } } const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; const png = Buffer.concat([ Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)) ]); icons.set(size, png); return png; }
app.get('/icon/:size.png', (req, res) => res.type('image/png').send(makeIcon(req.params.size === '512' ? 512 : 192)));
app.get('/manifest.json', (req, res) => res.json({ name: NAME, short_name: 'SEYA DESIGN', start_url: '/', display: 'standalone', background_color: '#0f1320', theme_color: '#4f46d8', icons: [ { src: '/icon/192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon/512.png', sizes: '512x512', type: 'image/png' } ] }));
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('http://localhost:' + PORT + ' | ' + NAME + ' | Gemini ' + GEMINI_MODEL));
