require('dotenv').config();
const express = require('express');
const zlib = require('zlib');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '50kb' }));

// --- በሁለቱ ነጠላ ጥቅሶች ('') መሃል ቶከንህን እና አይዲህን አስገባ ---
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_CHAT_ID || process.env.OWNER_CHAT_ID;

// Telegram webhook cleanup disabled; preserve pending updates.

const e = process.env;
const OWNER = e.OWNER_NAME || 'SEYA DESIGN';
const NAME = e.AGENT_NAME || 'የSEYA DESIGN ረዳት';
const TAGLINE = e.AGENT_TAGLINE || 'WEAR CONFIDENCE ✨ | ዘመናዊ የሴቶች ፋሽን ዲዛይንና ስፌት';

const ABOUT_OWNER = e.ABOUT_OWNER || 'SEYA DESIGN በጅማ መርካቶ የሚገኝ የሴቶች ፋሽን ዲዛይንና ስፌት ቤት ነው። በዘመናዊ ዲዛይን፣ ጥራት ያለው ስፌትና ፍጹም የሰውነት ልክ ላይ ያተኩራል።';
const BUSINESS_TYPE = e.BUSINESS_TYPE || 'የሴቶች ፋሽን ዲዛይንና ስፌት';
const SERVICES = e.SERVICES || 'የሴቶች ቀሚስ ዲዛይን፣ የተለያዩ የፋሽን ልብሶች ስፌት፣ Custom Made፣ የደንበኛ ፍላጎት መሰረት ዲዛይንና ስፌት።';
const LOCATION = e.LOCATION || 'ኢትዮጵያ፣ ኦሮሚያ፣ ጅማ ከተማ፣ መርካቶ፣ Nib Bank አጠገብ፣ የሱቅ ቁጥር 35';
const PHONE_NUMBER = e.PHONE_NUMBER || '0948964203';
const TIKTOK = e.TIKTOK || '@seyadesign.et';
const EMAIL = e.EMAIL || 'Seyadesign99@gmail.com';
const AGENT_ROLE = e.AGENT_ROLE || 'የSEYA DESIGN ደንበኞችን በትህትናና በሙያዊነት መቀበል፣ ስለ አገልግሎቶች፣ ዋጋዎች፣ የስራ ሰዓትና የሱቅ አድራሻ መረጃ መስጠት።';
const LANGUAGE = e.LANGUAGE || 'በዋናነት በአማርኛ መመለስ። ደንበኛው እንግሊዝኛ ከተጠቀመ በእንግሊዝኛ መመለስ።';
const PERSONALITY = e.PERSONALITY || 'ተግባቢ፣ ትሁት፣ ፈጣን፣ ትዕግስተኛና ፕሮፌሽናል።';
const BRAND_SLOGAN = e.BRAND_SLOGAN || 'WEAR CONFIDENCE ✨';

const DEFAULT_RULES = `1. ሁልጊዜ ደንበኞችን በአክብሮት መመለስ።
2. የማይታወቅ ዋጋ ወይም የስራ ሰዓት በግምት አለመናገር።
3. ዋጋው እንደ ዲዛይኑ፣ ጨርቁና የስፌት ውስብስብነት እንደሚለያይ ማስረዳት።
4. የደንበኛውን ፍላጎት ማዳመጥና አስፈላጊ ጥያቄዎችን ብቻ መጠየቅ።
5. ትዕዛዝ ወይም ክፍያ ተፈጽሟል ብሎ ያልተረጋገጠ መረጃ አለመናገር።
6. ከባድ ጥያቄ ከሆነ ደንበኛውን ከሱቁ ባለቤት (ስልክ 0948964203) ጋር ማገናኘት።
7. የሌላ ሱቅ መረጃ አለመስጠት።`;

const RULES = e.IMPORTANT_RULES || DEFAULT_RULES;

const ABOUT = [
  ABOUT_OWNER,
  'Business type: ' + BUSINESS_TYPE,
  'Services: ' + SERVICES,
  'Location: ' + LOCATION,
  'Phone: ' + PHONE_NUMBER,
  'TikTok: ' + TIKTOK,
  'Email: ' + EMAIL,
  'Your role: ' + AGENT_ROLE,
  'Language to use: ' + LANGUAGE,
  'Personality: ' + PERSONALITY,
  'Brand slogan: ' + BRAND_SLOGAN,
  'Important rules from the owner (always follow):\n' + RULES
].filter(Boolean).join('\n');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || 30;

const SYSTEM = [
  'You are "' + NAME + '", the official AI assistant representing "' + OWNER + '".',
  'Default language: Amharic (Ge\'ez script). If the user writes in another language, reply in that language.',
  'Personality: ' + PERSONALITY,
  'LENGTH RULE: match the energy and size of the message. Keep answers clear, helpful, and concise.',
  'Formatting: plain text. You may use **bold** for key words.',
  'Never claim to be human. Do not invent facts or prices about ' + OWNER + '.',
  'Background about ' + OWNER + ' and what you must know:\n' + ABOUT,
  'Customers may chat with you. For services, address and contact info, always use the details provided above.'
].filter(Boolean).join('\n\n');

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (arr.length >= RATE_LIMIT) return true;
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

function tidy(txt) {
  return String(txt || '').trim();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callAI(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: SYSTEM + (
                fs.existsSync('knowledge.json')
                  ? '\\n\\nAPPROVED OWNER KNOWLEDGE (follow these facts):\\n' +
                    JSON.parse(fs.readFileSync('knowledge.json', 'utf8'))
                      .map(item => '- ' + item.rule).join('\\n')
                  : ''
              )
            }]
          },
          contents
        })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err = new Error(d.error?.message || 'Gemini ' + r.status);
        err.status = r.status;
        throw err;
      }
      return d.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'ይቅርታ፣ ምላሽ ማግኘት አልተቻለም።';
    } catch (e) {
      last = e;
      if (e.status === 429 || e.status === 503) await sleep(1500 * (i + 1));
      else break;
    }
  }
  throw last;
}





// --- የተሻሻለው የቴሌግራም AI Agent (Two-Way Smart Remote Control) ---
const EXTRA_FILE = 'extra_rules.txt';
global.LIVE_UPDATES = fs.existsSync(EXTRA_FILE) ? fs.readFileSync(EXTRA_FILE, 'utf8') : '';
let tgOffset = 0;

if (TG_TOKEN && ADMIN_ID && GEMINI_KEY) {
  setInterval(async () => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${tgOffset}&timeout=5`);
      const d = await r.json();
      if (d.ok && Array.isArray(d.result)) {
        for (const u of d.result) {
          tgOffset = Math.max(tgOffset, u.update_id + 1);
          const msg = u.message;
          if (!msg || !msg.text || String(msg.chat.id) !== String(ADMIN_ID)) continue;
          if (u.update_id < tgOffset) continue;
          if (u.update_id < tgOffset) continue;
          if (u.update_id < tgOffset) continue;
          const txt = msg.text.trim();
          let replyMsg = '';

          if (txt === '/start' || txt === '/help') {
            replyMsg = '👋 <b>ሰላም ሰዒድ! የSEYA DESIGN ስማርት AI ሪሞት ኮንትሮል ዝግጁ ነው።</b>\n\n🤖 ከእኔ ጋር እንደ ሰው ማውራት ትችላለህ! ማንኛውንም አዲስ መረጃ፣ የዋጋ ለውጥ ወይም ማስታወሻ በድምፅ ወይም በጽሑፍ አብራርተህ ላክልኝ፤ እኔ ራሴ አጣርቼ ዌብሳይቱ ላይ እመዘግበዋለሁ።\n\n📋 <b>ትዕዛዞች፦</b>\n/list - እስካሁን የተጨመሩትን ለማየት\n/clear - ሁሉንም አዳዲስ መረጃዎች ለማጥፋት (ወደ ኦሪጅናሉ ለመመለስ)';
          } else if (txt === '/list') {
            replyMsg = global.LIVE_UPDATES ? `📋 <b>አሁን ላይ በባለቤቱ የተጨመሩ መመሪያዎች፦</b>\n\n${global.LIVE_UPDATES}` : 'ℹ️ እስካሁን የተጨመረ አዲስ መመሪያ የለም።';
          } else if (txt === '/clear') {
            global.LIVE_UPDATES = '';
            if (fs.existsSync(EXTRA_FILE)) fs.unlinkSync(EXTRA_FILE);
            replyMsg = '🗑️ የተጨመሩ መረጃዎች ተሰርዘዋል! ዌብሳይቱ ወደ መጀመሪያው ኦሪጅናል መረጃ ተመልሷል።';
          } else {
            // Ask Gemini to format the user's instruction nicely for the web AI
            const aiPrompt = `አንተ የሰዒድ ፋሽን ዲዛይን (Seya Design) ረዳት ነህ። ባለቤቱ ሰዒድ ቴሌግራም ላይ ሆኖ የሚከተለውን መመሪያ ወይም መረጃ ሰጥቷል፦ "${txt}". 
እባክህ ይህንን መረጃ ለዌብሳይቱ ደንበኞች ማስተማሪያ የሚሆን ግልጽ እና አጭር ህግ ወይም መረጃ አድርገህ አዘጋጀው (በአማርኛ)። ከዚህ በፊት ከነበሩት ጋር የሚስማማ ይሁን።`;
            
            const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: aiPrompt }] }] })
            });
            const aiData = await aiRes.json();
            const formattedRule = aiData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || txt;

            global.LIVE_UPDATES += (global.LIVE_UPDATES ? '\n- ' : '- ') + formattedRule;
            fs.writeFileSync(EXTRA_FILE, global.LIVE_UPDATES);
            
            replyMsg = `✅ <b>ትዕዛዝህ ተረድቶ ዌብሳይቱ ላይ ተመዝግቧል!</b>\n\n📌 <b>የተስተካከለው መረጃ፦</b>\n"${formattedRule}"\n\nአሁን ደንበኞች ሲጠይቁ ይህንን አዲስ መረጃ አብሮ ይጠቀማል።`;
          }

          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: ADMIN_ID, text: replyMsg, parse_mode: 'HTML' })
          });
        }
      }
    } catch (e) {}
  }, 4000);
}
// ----------------------------------------------------

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

    if (TG_TOKEN && ADMIN_ID) {
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: `${/(?:\+?251|0)?[97]\d{8}/.test(q) ? "🚨 📞 <b>ደንበኛ ስልክ ቁጥር ልኳል!</b>\n" : "🔔 <b>አዲስ ጥያቄ (SEYA DESIGN)</b>\n"}\n❓ <b>ደንበኛ:</b> ${q}\n\n🤖 <b>መልስ:</b> ${reply.slice(0, 800)}`,
          parse_mode: 'HTML'
        })
      }).catch(err => console.error('Telegram error:', err.message));
    }

    res.json({ reply });
  } catch (e) {
    console.error(e.message);
    const busy = e.status === 429 || e.status === 503;
    res.status(500).json({ error: busy ? 'አገልግሎቱ ለጊዜው ተጨናንቋል። ትንሽ ቆይተው ይሞክሩ።' : 'ለጊዜው አልተሳካም። እንደገና ይሞክሩ።' });
  }
});

app.get('/manifest.json', (req, res) => res.json({
  name: NAME,
  short_name: 'SEYA DESIGN',
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
