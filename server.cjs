require('dotenv').config();
const express = require('express');
const zlib = require('zlib');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '15mb' }));

// --- በሁለቱ ነጠላ ጥቅሶች ('') መሃል ቶከንህን እና አይዲህን አስገባ ---
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8979276991:AAHL62vzkTZqtJmGXUWNhSLhy5icXx6dSSE";
const ADMIN_ID = process.env.ADMIN_CHAT_ID || "5242780887";

// የድሮ የቴሌግራም ግንኙነትን (Webhook) በራሱ የሚያጸዳ ኮድ
if (TG_TOKEN) {
  fetch(`https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook?drop_pending_updates=true`)
    .then(() => console.log('Telegram cleaned and ready!'))
    .catch(() => {});
}

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

async function callAI(contents, customSystem) {
  const models = Array.from(new Set([GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'].filter(Boolean)));
  let last;
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_KEY}`;
    for (let i = 0; i < 2; i++) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: customSystem || (SYSTEM + (global.LIVE_UPDATES ? "\n\n[ወቅታዊና አዲስ መመሪያ ከሱቁ ባለቤት - ይህንን ቅድሚያ ሰጥተህ ተግብር]:\n" + global.LIVE_UPDATES : "")) }] },
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
        if (e.status === 429 || e.status === 503) await sleep(1000 * (i + 1));
        else break;
      }
    }
  }
  throw last;
}


// --- የተሻሻለው የቴሌግራም AI Agent (Direct Live Website Bridge) ---
const EXTRA_FILE = 'extra_rules.txt';
if (fs.existsSync(EXTRA_FILE) && fs.readFileSync(EXTRA_FILE, 'utf8').includes('Hey friend')) {
  fs.unlinkSync(EXTRA_FILE);
}
global.LIVE_UPDATES = fs.existsSync(EXTRA_FILE) ? fs.readFileSync(EXTRA_FILE, 'utf8') : '';
let tgOffset = 0;
let isPolling = false;
const processedIds = new Set();
let adminChatHistory = [];

async function sendToAdmin(text) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_ID, text: String(text).slice(0, 4000) })
  }).catch(e => console.error('Send error:', e.message));
}

function getRecentWebChats() {
  try {
    if (!fs.existsSync('chats.jsonl')) return 'እስካሁን የተመዘገበ የደንበኛ ውይይት የለም።';
    const lines = fs.readFileSync('chats.jsonl', 'utf8').trim().split('\n').filter(Boolean).slice(-5);
    return lines.map((l, i) => {
      const c = JSON.parse(l);
      return `${i + 1}. ደንበኛ: "${c.q}" -> መልስ: "${String(c.a).slice(0, 120)}..."`;
    }).join('\n') || 'እስካሁን የተመዘገበ የደንበኛ ውይይት የለም።';
  } catch (e) {
    return 'የውይይት መዝገብ ማንበብ አልተቻለም።';
  }
}

async function initTelegramBridge() {
  if (!TG_TOKEN || !ADMIN_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook?drop_pending_updates=false`);
    await sendToAdmin('🟢 የSEYA DESIGN ዌብሳይት እና ቴሌግራም ቦት አሁን በቀጥታ (Live) ተገናኝተዋል!\n\nማንኛውንም ጥያቄ ልትጠይቀኝ ወይም ወደ ዌብሳይቱ አዲስ መረጃ እንዳስገባ ልታዘኝ ትችላለህ።');
  } catch (e) {}
  pollTelegramLive();
}

async function pollTelegramLive() {
  if (isPolling || !TG_TOKEN || !ADMIN_ID) return;
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
        if (!msg || String(msg.chat.id) !== String(ADMIN_ID)) continue;

        // ሀ) ባለቤቱ ፎቶ ወደ ቴሌግራም ቦት ሲልክ -> ግልጽ ምድብ ውስጥ መስቀል!
        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
          try {
            const bestPhoto = msg.photo[msg.photo.length - 1];
            const rawCap = (msg.caption || '').trim();
            let cat = 'wedding';
            let catLabel = '👗 የሰርግ እና ድግስ (1)';
            let cleanCap = rawCap;

            if (/^2\b|አባያ|ሺፎን|abaya|chiffon/i.test(rawCap)) {
              cat = 'abaya';
              catLabel = '🧕 አባያ እና ሺፎን (2)';
              cleanCap = rawCap.replace(/^2[\s.:-]*/, '').trim();
            } else if (/^3\b|ሱፍ|ሱሪ|suit|trouser/i.test(rawCap)) {
              cat = 'suit';
              catLabel = '🧥 የሴቶች ሱፍ (3)';
              cleanCap = rawCap.replace(/^3[\s.:-]*/, '').trim();
            } else {
              cat = 'wedding';
              catLabel = '👗 የሰርግ እና ድግስ (1)';
              cleanCap = rawCap.replace(/^1[\s.:-]*/, '').trim();
            }
            if (!cleanCap) cleanCap = 'አዲስ የሰያ ዲዛይን ስራ';

            const gallery = JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
            gallery.unshift({
              id: 'g_' + Date.now(),
              category: cat,
              title: cleanCap.split('\n')[0].slice(0, 60),
              desc: cleanCap,
              emoji: '✨',
              image: '/api/tg-img/' + bestPhoto.file_id
            });
            fs.writeFileSync(GALLERY_FILE, JSON.stringify(gallery.slice(0, 30), null, 2));
            const posInCat = gallery.filter(i => i.category === cat).findIndex(i => i.image.includes(bestPhoto.file_id)) + 1;

            await sendToAdmin(`✅ <b>ፎቶው በትክክል ዌብሳይቱ ላይ ተለጥፏል!</b>\n\n📂 <b>የተቀመጠበት ቦታ:</b> ${catLabel} ጋለሪ ውስጥ (#${posInCat})\n🏷️ <b>ርዕስ:</b> ${cleanCap}\n\n💡 <i>ማሳሰቢያ፡ ሌላ ፎቶ ሲልኩ ከስሩ 1 (ለሰርግ)፣ 2 (ለአባያ) ወይም 3 (ለሱፍ) ብለው ቢጽፉ በቀጥታ እዛው ጋለሪ ውስጥ ያስቀምጠዋል።</i>\n📋 የተለጠፉ ፎቶዎችን ለማየት /photos ይላኩ።`);
          } catch (err) {
            await sendToAdmin('⚠️ ፎቶውን መስቀል አልተቻለም: ' + err.message);
          }
          continue;
        }

        // ለ) ባለቤቱ የደንበኛውን መልእክት Reply ሲያደርግ -> በቀጥታ (Live) ዌብሳይቱ ላይ ላለው ደንበኛ መላክ!
        if (msg.reply_to_message && msg.reply_to_message.text && msg.text) {
          const idMatch = msg.reply_to_message.text.match(/🆔 ID:\s*([a-zA-Z0-9_.-]+)/);
          if (idMatch && idMatch[1]) {
            const targetVid = idMatch[1];
            const allReplies = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8'));
            if (!allReplies[targetVid]) allReplies[targetVid] = [];
            allReplies[targetVid].push(msg.text.trim());
            fs.writeFileSync(REPLIES_FILE, JSON.stringify(allReplies));
            await sendToAdmin(`✅ መልስዎ በቀጥታ (Live) ዌብሳይቱ ላይ ላለው ደንበኛ ተልኳል!\n💬 "${msg.text.trim()}"`);
            continue;
          }
        }

        if (!msg.text) continue;
        const txt = msg.text.trim();

        fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: ADMIN_ID, action: 'typing' })
        }).catch(() => {});

        if (txt === '/start' || txt === '/help') {
          await sendToAdmin('👋 ሰላም ሰዒድ! ከዌብሳይቱ ጋር በቀጥታ (Live) ተገናኝቻለሁ።\n\n💬 ከእኔ ጋር በቀጥታ ማውራት፣ "ደንበኞች ዌብሳይቱ ላይ ምን ጠየቁ?" ብለህ መጠየቅ፣ ወይም ለዌብሳይቱ አዲስ መረጃ/ዋጋ እንድጨምር ማዘዝ ትችላለህ።\n\n📋 ትዕዛዞች፦\n/list - ዌብሳይቱ ላይ የተጨመሩ አዳዲስ መረጃዎችን ለማየት\n/chats - የመጨረሻዎቹን 5 የዌብሳይት ደንበኞች ጥያቄ ለማየት\n/clear - ተጨማሪ መረጃዎችን አጥፍቶ ወደ ኦሪጅናሉ ለመመለስ');
        } else if (txt === '/list') {
          await sendToAdmin(global.LIVE_UPDATES
            ? `📋 አሁን ዌብሳይቱ ላይ በቀጥታ እየሰሩ ያሉ አዳዲስ መረጃዎች፦\n\n${global.LIVE_UPDATES}`
            : 'ℹ️ አሁን ላይ ተጨማሪ አዲስ መረጃ የለም (ዌብሳይቱ በኦሪጅናል መረጃው እየሰራ ነው)።');
        } else if (txt === '/chats') {
          await sendToAdmin('📊 በዌብሳይቱ ላይ የተጠየቁ የመጨረሻዎቹ 5 ጥያቄዎች፦\n\n' + getRecentWebChats());
        } else if (txt === '/photos') {
          const g = JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
          if (!g.length) { await sendToAdmin('ℹ️ ጋለሪው ውስጥ የተለጠፈ ፎቶ የለም።'); continue; }
          const list = g.map((item, idx) => `${idx + 1}. [${item.category === 'wedding' ? '1-ሰርግ' : item.category === 'abaya' ? '2-አባያ' : '3-ሱፍ'}] ${item.title}`).join('\n');
          await sendToAdmin(`🖼️ <b>ዌብሳይቱ ላይ የተለጠፉ ፎቶዎች:</b>\n\n${list}\n\n🗑️ አንዱን ለማጥፋት /del 1 (ቁጥሩን) ይላኩ።`);
          continue;
        }
        if (/^\/del\s+(\d+)$/.test(txt)) {
          const idx = parseInt(txt.match(/^\/del\s+(\d+)$/)[1], 10) - 1;
          const g = JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
          if (g[idx]) {
            const removed = g.splice(idx, 1)[0];
            fs.writeFileSync(GALLERY_FILE, JSON.stringify(g, null, 2));
            await sendToAdmin(`🗑️ "${removed.title}" ከዌብሳይቱ ጋለሪ ተሰርዟል።`);
          } else {
            await sendToAdmin('⚠️ ትክክለኛ ቁጥር ያስገቡ (ለምሳሌ /del 1)');
          }
          continue;
        }
        if (txt === '/clear_photos') {
          fs.writeFileSync(GALLERY_FILE, '[]');
          await sendToAdmin('🗑️ ዌብሳይቱ ላይ የተሰቀሉት ፎቶዎች ተሰርዘዋል።');
          continue;
        }
        if (txt === '/clear') {
          global.LIVE_UPDATES = '';
          adminChatHistory = [];
          if (fs.existsSync(EXTRA_FILE)) fs.unlinkSync(EXTRA_FILE);
          await sendToAdmin('🗑️ በቴሌግራም የተጨመሩ መረጃዎች ተሰርዘዋል። ዌብሳይቱ ወደ መጀመሪያው ኦሪጅናል መረጃ ተመልሷል!');
        } else {
          const adminSystem = `አንተ የ "Seya Design" (ሰያ ዲዛይን) ዌብሳይት ዋና AI ነህ። አሁን በቴሌግራም በቀጥታ (Live) እያወራህ ያለኸው ከሱቁ ባለቤት ከሰዒድ (Said) ጋር ነው።

የዌብሳይቱ መሰረታዊ መረጃ፦
${ABOUT}

አሁን ዌብሳይቱ ላይ ተጨምረው በቀጥታ እየሰሩ ያሉ አዳዲስ መረጃዎች፦
${global.LIVE_UPDATES || '(ምንም ተጨማሪ አዲስ መረጃ የለም)'}

በዌብሳይቱ ላይ ደንበኞች በቅርቡ የጠየቋቸው ጥያቄዎች፦
${getRecentWebChats()}

የአንተ ሚና፦
1. ሰዒድ ለሚጠይቅህ ማንኛውም ጥያቄ ወይም ውይይት በቀጥታ በአማርኛ መልስ ስጠው።
2. ሰዒድ ለዌብሳይቱ ደንበኞች የሚሆን አዲስ መረጃ፣ ዋጋ፣ ቅናሽ፣ አዲስ ጨርቅ ወይም መመሪያ ወደ ዌብሳይቱ እንድታስገባ/እንድትቀይር ካዘዘህ ብቻ፣ ለእሱ ከምትሰጠው መልስ መጨረሻ ላይ አዲሱን መረጃ በዚህ ቅንፍ ውስጥ አስቀምጥ፦
[[UPDATE: እዚህ ጋር ለዌብሳይቱ ደንበኞች የሚሆነውን ግልጽ መረጃ ጻፍ]]
3. ሰዒድ ተራ ጥያቄ ወይም ውይይት እያደረገ ከሆነ ግን [[UPDATE: ...]] የሚለውን ቅንፍ አትጠቀም።`;

          adminChatHistory.push({ role: 'user', parts: [{ text: txt }] });
          if (adminChatHistory.length > 10) adminChatHistory = adminChatHistory.slice(-10);

          try {
            let aiReply = tidy(await callAI(adminChatHistory, adminSystem));
            adminChatHistory.push({ role: 'model', parts: [{ text: aiReply }] });

            const match = aiReply.match(/\[\[UPDATE:\s*([\s\S]*?)\]\]/);
            if (match && match[1]) {
              const newRule = match[1].trim();
              global.LIVE_UPDATES += (global.LIVE_UPDATES ? '\n- ' : '- ') + newRule;
              fs.writeFileSync(EXTRA_FILE, global.LIVE_UPDATES);
              aiReply = aiReply.replace(/\[\[UPDATE:[\s\S]*?\]\]/g, '').trim();
              await sendToAdmin(`${aiReply}\n\n🌐 [በቀጥታ ዌብሳይቱ ላይ ተመዝግቧል]:\n📌 "${newRule}"`);
            } else {
              await sendToAdmin(aiReply);
            }
          } catch (err) {
            await sendToAdmin('⚠️ የAI ግንኙነት ስህተት: ' + err.message);
          }
        }
      }
    }
  } catch (e) {
    console.error('TG Poll Error:', e.message);
  } finally {
    isPolling = false;
    setTimeout(pollTelegramLive, 1500);
  }
}
initTelegramBridge();
// ----------------------------------------------------


const GALLERY_FILE = 'gallery.json';
const REPLIES_FILE = 'live_replies.json';
if (!fs.existsSync(GALLERY_FILE)) {
  fs.writeFileSync(GALLERY_FILE, JSON.stringify([
    { id: 'g1', category: 'wedding', title: 'ልዩ የሰርግ እና የመልስ ቀሚስ', desc: 'በጥልፍ እና በዘመናዊ ዲዛይን ተውቦ በልኬት የሚሰራ', emoji: '👑', image: '' },
    { id: 'g2', category: 'abaya', title: 'የሺፎን እና የክሪፕ ዘመናዊ አባያ', desc: 'ምቹ፣ ቀላል እና ለማንኛውም አጋጣሚ የሚሆን ዲዛይን', emoji: '✨', image: '' },
    { id: 'g3', category: 'suit', title: 'ክላሲክ የሴቶች ሙሉ ሱፍ', desc: 'በጥንቃቄ የተቆረጠ እና ሰውነት ላይ ቁጭ የሚል ስፌት', emoji: '💼', image: '' }
  ], null, 2));
}
if (!fs.existsSync(REPLIES_FILE)) fs.writeFileSync(REPLIES_FILE, '{}');


app.get('/api/tg-img/:fileId', async (req, res) => {
  try {
    const fInfoRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getFile?file_id=${encodeURIComponent(req.params.fileId)}`);
    const fInfo = await fInfoRes.json();
    if (!fInfo.ok || !fInfo.result.file_path) return res.status(404).end();
    const imgRes = await fetch(`https://api.telegram.org/file/bot${TG_TOKEN}/${fInfo.result.file_path}`);
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.send(buf);
  } catch (e) { res.status(500).end(); }
});

app.get('/api/gallery', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8')));
  } catch (e) { res.json([]); }
});

app.get('/api/live-replies', (req, res) => {
  const vid = String(req.query.vid || '');
  if (!vid) return res.json([]);
  try {
    const all = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8'));
    const msgs = all[vid] || [];
    if (msgs.length > 0) {
      all[vid] = [];
      fs.writeFileSync(REPLIES_FILE, JSON.stringify(all));
    }
    res.json(msgs);
  } catch (e) { res.json([]); }
});

app.get('/api/info', (req, res) => res.json({ name: NAME, tagline: TAGLINE }));

app.post('/api/chat', async (req, res) => {
  try {
    const ip = req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    if (limited(ip)) return res.status(429).json({ error: 'ብዙ ጥያቄዎች ተልከዋል። ትንሽ ቆይተው ይሞክሩ።' });

    const rawQ = String(req.body.prompt || '').trim().slice(0, 2000);
    const imgData = req.body.image && typeof req.body.image.data === 'string' ? req.body.image : null;
    const audData = req.body.audio && typeof req.body.audio.data === 'string' ? req.body.audio : null;

    if (!rawQ && !imgData && !audData) {
      return res.status(400).json({ error: 'እባክዎ መልዕክት ይጻፉ፣ ፎቶ ይምረጡ ወይም ድምጽ ይቅዱ።' });
    }

    const hist = Array.isArray(req.body.history) ? req.body.history.slice(-12) : [];
    const contents = hist
      .filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      .map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, 2000) }] }));

    const userParts = [];
    if (imgData) {
      userParts.push({ inlineData: { mimeType: imgData.mimeType || 'image/jpeg', data: imgData.data } });
    }
    if (audData) {
      userParts.push({ inlineData: { mimeType: audData.mimeType || 'audio/webm', data: audData.data } });
    }
    const textPrompt = rawQ || (imgData ? 'ደንበኛው ይህንን የዲዛይን/ልብስ ፎቶ ልኳል። ስለ ዲዛይኑ፣ ስለ ስፌቱ እና ስለ ዋጋ ግምቱ በሰያ ዲዛይን ስም አብራራለት።' : 'ደንበኛው የድምጽ መልእክት ልኳል። በጥሞና አዳምጠህ በአማርኛ ምላሽ ስጠው።');
    userParts.push({ text: textPrompt });

    contents.push({ role: 'user', parts: userParts });
    const reply = tidy(await callAI(contents));

    const logQ = (imgData ? '[📷 ፎቶ] ' : '') + (audData ? '[🎤 ድምጽ] ' : '') + (rawQ || '(ሚዲያ መልእክት)');
    fs.appendFile('chats.jsonl', JSON.stringify({ t: Date.now(), v: String(req.body.vid || ip).slice(0, 40), q: logQ, a: reply }) + '\n', () => {});

    if (TG_TOKEN && ADMIN_ID) {
      const hasPhone = /(?:\+?251|0)?[97]\d{8}/.test(rawQ);
      const header = hasPhone ? '🚨 📞 ደንበኛ ስልክ ቁጥር ልኳል! (SEYA DESIGN)' : '🔔 አዲስ የዌብሳይት ጥያቄ (SEYA DESIGN)';
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: `${header}\n🆔 ID: ${String(req.body.vid || ip).slice(0, 20)}\n\n❓ ደንበኛ: ${logQ}\n\n🤖 የዌብሳይቱ መልስ: ${reply.slice(0, 800)}\n\n💡 (ለዚህ ደንበኛ በቀጥታ ለመመለስ ይህንን መልእክት Reply አድርገው ይጻፉ)`
        })
      }).catch(err => console.error('Telegram error:', err.message));

      if (imgData) {
        try {
          const fd = new FormData();
          fd.append('chat_id', ADMIN_ID);
          fd.append('caption', '📷 ከዌብሳይት ደንበኛ የተላከ የዲዛይን ፎቶ' + (rawQ ? ': ' + rawQ : ''));
          fd.append('photo', new Blob([Buffer.from(imgData.data, 'base64')], { type: imgData.mimeType || 'image/jpeg' }), 'design.jpg');
          fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, { method: 'POST', body: fd }).catch(() => {});
        } catch (e) {}
      }
      if (audData) {
        try {
          const fd = new FormData();
          fd.append('chat_id', ADMIN_ID);
          fd.append('caption', '🎤 ከዌብሳይት ደንበኛ የተላከ የድምጽ መልእክት');
          fd.append('voice', new Blob([Buffer.from(audData.data, 'base64')], { type: audData.mimeType || 'audio/ogg' }), 'voice.ogg');
          fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendVoice`, { method: 'POST', body: fd }).catch(() => {});
        } catch (e) {}
      }
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

// Keep Render Awake
setInterval(() => { fetch('https://seya-design-mmgv.onrender.com/api/info').catch(() => {}); }, 600000);
