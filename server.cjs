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
          systemInstruction: { parts: [{ text: SYSTEM + (global.LIVE_UPDATES ? "\n\n[ወቅታዊና አዲስ መመሪያ ከሱቁ ባለቤት - ይህንን ቅድሚያ ሰጥተህ ተግብር]:\n" + global.LIVE_UPDATES : "") }] },
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







// --- SMART TELEGRAM ADMIN AGENT ---
const EXTRA_FILE = 'extra_rules.txt';
let tgOffset = 0;
let tgBusy = false;

if (TG_TOKEN && ADMIN_ID && GEMINI_KEY) {
  console.log('Telegram Admin Agent enabled');

  setInterval(async () => {
    if (tgBusy) return;
    tgBusy = true;

    try {
      const response = await fetch(
        'https://api.telegram.org/bot' + TG_TOKEN +
        '/getUpdates?offset=' + tgOffset + '&timeout=10'
      );

      const data = await response.json();
      if (!data.ok || !Array.isArray(data.result)) return;

      for (const update of data.result) {
        tgOffset = update.update_id + 1;

        const msg = update.message;
        if (!msg || !msg.text) continue;
        if (String(msg.chat.id) !== String(ADMIN_ID)) continue;

        const txt = msg.text.trim();
        let reply = '';

        if (txt === '/start' || txt === '/help') {
          reply =
            '👋 ሰላም! SEYA DESIGN Admin AI ዝግጁ ነው።\n\n' +
            'አዲስ መረጃ በቀጥታ ላክ።\n\n' +
            '/list - የተጨመሩ መመሪያዎች\n' +
            '/clear - የተጨመሩ መመሪያዎችን ማጥፋት';

        } else if (txt === '/list') {
          reply = fs.existsSync(EXTRA_FILE)
            ? '📋 የተጨመሩ መረጃዎች፦\n\n' +
              fs.readFileSync(EXTRA_FILE, 'utf8')
            : 'ℹ️ እስካሁን አዲስ መረጃ አልተጨመረም።';

        } else if (txt === '/clear') {
          if (fs.existsSync(EXTRA_FILE)) fs.unlinkSync(EXTRA_FILE);
          reply = '🗑️ የተጨመሩ መመሪያዎች ተሰርዘዋል።';

        } else {
          const prompt =
            'አንተ የSEYA DESIGN የባለቤቱ መረጃ አደራጅ ነህ።\n' +
            'ባለቤቱ የላከውን መረጃ በአማርኛ ግልጽና አጭር የደንበኛ መመሪያ አድርግ።\n' +
            'የተሰጠውን እውነታ አትቀይር። አዲስ ዋጋ ወይም መረጃ አትፍጠር።\n\n' +
            'የባለቤቱ መልዕክት:\n' + txt;

          const aiResponse = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/' +
            GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [{ text: prompt }]
                }]
              })
            }
          );

          const aiData = await aiResponse.json();

          if (!aiResponse.ok) {
            throw new Error(aiData.error?.message || 'Gemini request failed');
          }

          const formatted = aiData.candidates?.[0]?.content?.parts
            ?.map(p => p.text || '').join('').trim();

          const rule = formatted || txt;

          fs.appendFileSync(
            EXTRA_FILE,
            (fs.existsSync(EXTRA_FILE) ? '\n\n' : '') + '- ' + rule
          );

          reply =
            '✅ መረጃው ተመዝግቧል!\n\n' +
            '📌 የተዘጋጀው፦\n' + rule +
            '\n\nየWebsite AI በሚቀጥለው ጥያቄ ይህንን ይጠቀማል።';
        }

        await fetch(
          'https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: ADMIN_ID,
              text: reply.slice(0, 3900)
            })
          }
        );
      }
    } catch (error) {
      console.error('Telegram Agent:', error.message);
    } finally {
      tgBusy = false;
    }
  }, 12000);
}
// --- END SMART TELEGRAM ADMIN AGENT ---



// --- የተሻሻለው የቴሌግራም AI Agent (True Live Two-Way Control) ---
const EXTRA_FILE = 'extra_rules.txt';
// ቀድሞ በስህተት "Hey friend" የሚል ተመዝግቦ ከነበረ ማጽዳት
if (fs.existsSync(EXTRA_FILE) && fs.readFileSync(EXTRA_FILE, 'utf8').includes('Hey friend')) {
  fs.unlinkSync(EXTRA_FILE);
}
global.LIVE_UPDATES = fs.existsSync(EXTRA_FILE) ? fs.readFileSync(EXTRA_FILE, 'utf8') : '';
let tgOffset = 0;
let isPolling = false;
const processedIds = new Set();
let adminChatHistory = [];

async function pollTelegramLive() {
  if (isPolling || !TG_TOKEN || !ADMIN_ID || !GEMINI_KEY) return;
  isPolling = true;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getUpdates?offset=${tgOffset}&timeout=10`);
    const d = await r.json();
    if (d.ok && Array.isArray(d.result)) {
      for (const u of d.result) {
        tgOffset = u.update_id + 1;
        if (processedIds.has(u.update_id)) continue;
        processedIds.add(u.update_id);
        if (processedIds.size > 500) processedIds.clear();

        const msg = u.message;
        if (!msg || !msg.text || String(msg.chat.id) !== String(ADMIN_ID)) continue;
        const txt = msg.text.trim();
        let replyMsg = '';

        if (txt === '/start' || txt === '/help') {
          replyMsg = '👋 <b>ሰላም ሰዒድ! አሁን በቀጥታ (Live) ተገናኝተናል።</b>\n\n💬 ከእኔ ጋር ማንኛውንም ነገር በቀጥታ ማውራት፣ መማከር ወይም መጠየቅ ትችላለህ።\n🌐 ለዌብሳይቱ ደንበኞች አዲስ መረጃ፣ ዋጋ ወይም ማስታወቂያ እንዲገባ ስትፈልግ ደግሞ በንግግርህ ውስጥ ንገረኝ፤ ወዲያውኑ ዌብሳይቱ ላይ በቀጥታ አስገባዋለሁ!\n\n📋 <b>ትዕዛዞች፦</b>\n/list - ዌብሳይቱ ላይ አሁን ያሉ ተጨማሪ መረጃዎችን ለማየት\n/clear - ተጨማሪ መረጃዎችን አጥፍቶ ወደ ኦሪጅናሉ ለመመለስ';
        } else if (txt === '/list') {
          replyMsg = global.LIVE_UPDATES
            ? `📋 <b>አሁን ዌብሳይቱ ላይ በቀጥታ እየሰሩ ያሉ አዳዲስ መረጃዎች፦</b>\n\n${global.LIVE_UPDATES}`
            : 'ℹ️ አሁን ላይ ተጨማሪ አዲስ መረጃ የለም (ዌብሳይቱ በኦሪጅናል ኮዱ እየሰራ ነው)።';
        } else if (txt === '/clear') {
          global.LIVE_UPDATES = '';
          adminChatHistory = [];
          if (fs.existsSync(EXTRA_FILE)) fs.unlinkSync(EXTRA_FILE);
          replyMsg = '🗑️ በቴሌግራም የተጨመሩ መረጃዎች ተሰርዘዋል። ዌብሳይቱ ወደ መጀመሪያው ኦሪጅናል መረጃ ተመልሷል!';
        } else {
          const adminSystem = `አንተ የ "Seya Design" (ሰያ ዲዛይን) ዋና የቴሌግራም AI ረዳት ነህ። አሁን በቀጥታ (Live) እያወራህ ያለኸው ከሱቁ ባለቤት ከሰዒድ (Said) ጋር ነው።
የዌብሳይቱ መሰረታዊ መረጃ፦
${ABOUT}

አሁን ዌብሳይቱ ላይ ተጨምረው በቀጥታ እየሰሩ ያሉ አዳዲስ መረጃዎች፦
${global.LIVE_UPDATES || '(ምንም ተጨማሪ አዲስ መረጃ የለም)'}

የአንተ ሚና፦
1. ሰዒድ ሰላምታ ካቀረበልህ፣ ጥያቄ ከጠየቀህ ወይም ሀሳብ ካዋየህ፣ እንደ ብልህ የቢዝነስ አጋሩ በቀጥታ (Live) በአማርኛ አነጋግረው። በጭራሽ ተመሳሳይ የሽምደዳ መልስ አትስጠው።
2. ሰዒድ ለዌብሳይቱ ደንበኞች የሚሆን አዲስ መረጃ፣ የዋጋ ለውጥ፣ ቅናሽ፣ አዲስ ጨርቅ ወይም ህግ እንድትጨምር/እንድታስተካክል ካዘዘህ ብቻ፣ ለእሱ ከምትሰጠው ተፈጥሯዊ መልስ መጨረሻ ላይ አዲሱን ህግ በዚህ ምልክት ውስጥ አስቀምጥ፦
<UPDATE_WEB>እዚህ ጋር ለዌብሳይቱ AI የሚሆነውን ግልጽ መመሪያ ጻፍ</UPDATE_WEB>
3. ሰዒድ ተራ ወሬ ወይም ጥያቄ እየጠየቀህ ከሆነ ግን <UPDATE_WEB> የሚለውን ምልክት በፍጹም አትጠቀም።`;

          adminChatHistory.push({ role: 'user', parts: [{ text: txt }] });
          if (adminChatHistory.length > 10) adminChatHistory = adminChatHistory.slice(-10);

          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: adminSystem }] },
              contents: adminChatHistory
            })
          });
          const aiData = await aiRes.json();
          let aiReply = aiData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || 'ይቅርታ ሰዒድ፣ ለጊዜው የኔትወርክ መጨናነቅ አጋጥሞኛል። እንደገና ጻፍልኝ።';

          adminChatHistory.push({ role: 'model', parts: [{ text: aiReply }] });

          const match = aiReply.match(/<UPDATE_WEB>([\s\S]*?)<\/UPDATE_WEB>/);
          if (match && match[1]) {
            const newRule = match[1].trim();
            global.LIVE_UPDATES += (global.LIVE_UPDATES ? '\n- ' : '- ') + newRule;
            fs.writeFileSync(EXTRA_FILE, global.LIVE_UPDATES);
            aiReply = aiReply.replace(/<UPDATE_WEB>[\s\S]*?<\/UPDATE_WEB>/, '').trim();
            replyMsg = `${aiReply}\n\n🌐 <b>[በቀጥታ ዌብሳይቱ ላይ ተመዝግቧል]:</b>\n📌 <i>"${newRule}"</i>`;
          } else {
            replyMsg = aiReply;
          }
        }

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_ID, text: replyMsg, parse_mode: 'HTML' })
        });
      }
    }
  } catch (e) {
    console.error('TG Poll Error:', e.message);
  } finally {
    isPolling = false;
    setTimeout(pollTelegramLive, 1500);
  }
}
pollTelegramLive();
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
