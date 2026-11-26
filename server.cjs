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
  await restoreGalleryFromTelegram();
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
            fs.writeFileSync(GALLERY_FILE, JSON.stringify(gallery.slice(0, 500), null, 2));
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
            backupGalleryToTelegram(g);
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



async function backupGalleryToTelegram(galleryArr) {
  if (!TG_TOKEN || !ADMIN_ID) return;
  try {
    const compact = galleryArr.map(g => ({
      i: g.id,
      c: g.category,
      t: g.title,
      d: g.desc,
      f: g.image && g.image.startsWith('/api/tg-img/') ? g.image.replace('/api/tg-img/', '') : ''
    })).filter(x => x.f);
    const payload = '#SEYA_GALLERY_DB\n' + JSON.stringify(compact);
    if (payload.length > 4000) return;
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_ID, text: payload, disable_notification: true })
    });
    const d = await r.json();
    if (d.ok && d.result?.message_id) {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_ID, message_id: d.result.message_id, disable_notification: true })
      });
    }
  } catch (e) {}
}

async function restoreGalleryFromTelegram() {
  if (!TG_TOKEN || !ADMIN_ID) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/getChat?chat_id=${ADMIN_ID}`);
    const d = await r.json();
    const pinned = d.result?.pinned_message?.text || '';
    if (pinned.startsWith('#SEYA_GALLERY_DB\n')) {
      const compact = JSON.parse(pinned.replace('#SEYA_GALLERY_DB\n', ''));
      if (Array.isArray(compact) && compact.length > 0) {
        const current = JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
        const hasRealPhotos = current.some(x => x.image && x.image.startsWith('/api/tg-img/'));
        if (!hasRealPhotos) {
          const restored = compact.map(x => ({
            id: x.i,
            category: x.c,
            title: x.t,
            desc: x.d,
            emoji: '✨',
            image: '/api/tg-img/' + x.f
          }));
          fs.writeFileSync(GALLERY_FILE, JSON.stringify(restored, null, 2));
        }
      }
    }
  } catch (e) {}
}

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





function saveUsmiHub(d) {
  fs.writeFileSync(USMI_HUB_FILE, JSON.stringify(d, null, 2));
}




const USMI_HUB_FILE = 'usmi_hub.json';
function loadUsmiHub() {
  try {
    if (fs.existsSync(USMI_HUB_FILE)) {
      return JSON.parse(fs.readFileSync(USMI_HUB_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    schoolName: 'USMI FASHION SCHOOL',
    founder: 'Designer Usmi',
    experience: 'በፋሽን ዘርፍ 6 ዓመት ገደማ',
    tagline: 'DESIGN · CREATE · STITCH · INSPIRE',
    address: 'ጅማ መርካቶ፣ መቱማ ህንፃ',
    phone: '+251901611067',
    telegram: '@Usmifashion1',
    telegramUrl: 'https://t.me/Usmifashion1',
    instagram: '@usmi_fashion_school',
    instagramUrl: 'https://www.instagram.com/usmi_fashion_school/',
    tiktok1: '@usmi_fashion_school',
    tiktok1Url: 'https://www.tiktok.com/@usmi_fashion_school',
    tiktok2: '@usmi.design.new.fashoin',
    tiktok2Url: 'https://www.tiktok.com/@usmi.design.new.fashoin',
    about: 'በተግባር የተደገፈ ስልጠና | የቀን፣ የማታ እና የቅዳሜና እሁድ ፕሮግራሞች አሉን!',
    courses: [
      'የልብስ ቆረጣ እና ዘመናዊ ስፌት (Pattern Making & Garment Construction)',
      'የሴቶች እና የወንዶች ፋሽን ዲዛይን (Modern Fashion Design & Styling)',
      'የባህላዊ፣ የድግስ፣ የአባያ እና የሺፎን አልባሳት ስራ',
      'የልኬት አወሳሰድ፣ የጨርቅ ምርጫ እና የአጨራረስ (Finishing) ጥበብ',
      'በተግባር የተደገፈ የስራ ዝግጅት እና የቢዝነስ አጀማመር መመሪያ'
    ],
    extraLinks: []
  };
}




app.get('/u/usmi-hub', (req, res) => {
  res.redirect(302, '/u/usmi');
});






app.post('/api/usmi-chat', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const body = req.body || {};
    const q = String(body.prompt || '').trim().slice(0, 1500);
    const hasHistory = Boolean(body.hasHistory);

    if (!q) {
      return res.json({
        reply: hasHistory
          ? 'ጥያቄዎን ይቀጥሉ፤ በምን ልረዳዎት እችላለሁ? 😊'
          : 'ሰላም! 😊 ስለ Usmi Fashion School የፈለጉትን አጭር ጥያቄ ይጠይቁኝ።'
      });
    }

    const h = (typeof loadUsmiHub === 'function') ? loadUsmiHub() : {};
    const founder = h.founder || 'Designer Usmi';
    const experience = h.experience || 'በፋሽን ዘርፍ 6 ዓመት ገደማ';
    const tagline = h.tagline || 'DESIGN · CREATE · STITCH · INSPIRE';
    const address = 'ጅማ መርካቶ፣ መቱማ ህንፃ፣ 4ኛ ፎቅ';
    const phone = h.phone || '+251901611067';
    const telegram = h.telegram || '@Usmifashion1';
    const instagram = h.instagram || '@usmi_fashion_school';
    const tiktok1 = h.tiktok1 || '@usmi_fashion_school';
    const tiktok2 = h.tiktok2 || '@usmi.design.new.fashoin';

    const bgKnowledge = [
      'ስም: Usmi Fashion School',
      'መፈክር: ' + tagline,
      'መስራች እና ልምድ: ' + founder + ' (' + experience + ')',
      'አድራሻ: ' + address,
      'ስልክ: ' + phone + ' | Telegram: ' + telegram + ' | Instagram: ' + instagram + ' | TikTok: ' + tiktok1 + ', ' + tiktok2,
      'መደበኛ የክፍያ መጠኖች (Clear): የ1 ወር 14,000 ብር | የ2 ወር 12,000 ብር | የ3 ወር 18,000 ብር | የ6 ወር 30,000 ብር',
      'ተጨማሪ አገልግሎት እና ስልጠና: ለአንድ ወር ሲሆን ሳምንቱን ሙሉ ከሚሰጠው ትምህርት በተጨማሪ ቅዳሜና እሁድ (ዊኬንድ) ስልጠና ይሰጣል፤ ተማሪዎችን ለመምረጥም ያግዛል',
      'ተጨማሪ ጥቅሞችና ድጋፍ: ተማሪዎች ሲመጡ ልብስ ማሰራትን ጨምሮ የሐሳብ ድጋፍ እና ምክሮች (tips) ይሰጣሉ',
      'የፓኬጅ አማራጮች: የ6 ወር (20ኛ ፓኬጅ)፣ የ3 ወር (16ኛ ፓኬጅ)፣ የ2 ወር (12ኛ ፓኬጅ) እና የ1 ወር (9ኛ ፓኬጅ) አሉ፤ መርጠው መማር ለሚፈልጉ በልዩ ሁኔታ ትምህርት ይሰጣል'
    ].join('\n');

    const sysPrompt = `አንተ የ Usmi Fashion School (${tagline}) ወዳጃዊ፣ ግልጽ እና እንደ ሰው ልጅ አጠር አጠር እያልክ የምታወራ AI አማካሪ ነህ።
ከዚህ በታች ያለውን የጀርባ ዳታ መሰረት አድርገህ የተጠየቀውን ጥያቄ ብቻ በንጹህ እና በተስተካከለ አጻጻፍ መልስ ስጥ።

ጥብቅ ህጎች፦
1) የትምህርት ቤቱን ስም ሁልጊዜ በትክክል "Usmi Fashion School" ብቻ ብለህ ጻፍ።
2) ሰላምታን (ለምሳሌ "ሰላም" ወይም "Akkam") በመጀመሪያ መልእክት ብቻ ወይም አዲስ ንግግር ሲጀመር ብቻ ስጥ። በቀጣይ ንግግሮች (hasHistory=${hasHistory}) በፍጹም እንደገና ሰላምታ አትድገም፤ በቀጥታ ወደ መልሱ ግባ።
3) በአፋን ኦሮሞ (Afaan Oromo) ስትመልስ ፍጹም ንጹህ፣ ትክክለኛ እና ተፈጥሯዊ የሰው አፋን ኦሮሞ ተጠቀም — የተዘበራረቁ ቃላት ወይም የማይገባ ድግግሞሽ በፍጹም አታምጣ። በአማርኛ ሲጠየቅ በንጹህ አማርኛ መልስ።
4) ጽሑፍን እንደ ተዘበራረቀ ወይም የተደረደረ ዝርዝር ሳይሆን፣ ልክ እንደ ሰው ልጅ አጠር አጠር እያደረግክ እና የተጠየቀውን ነጥብ ብቻ መርጠህ መልስ። ለተማሪው የተሻለውን ፓኬጅ ወይም ስልጠና እንዲመርጥ በቀላሉ ምከር።
5) ደስ የሚሉ ኢሞጂዎችን (ለምሳሌ 😊፣ ✨፣ ✂️) በልክ (1 ወይም 2 ብቻ) ተጠቀም።

የጀርባ ዳታ፦
${bgKnowledge}`;

    const userParts = [{ text: q }];
    let rawReply = '';

    if (typeof callAI === 'function') {
      try {
        rawReply = await callAI([{ role: 'user', parts: userParts }], sysPrompt);
      } catch (e1) {
        rawReply = '';
      }
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!rawReply && apiKey) {
      for (const m of ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const gr = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: sysPrompt }] },
              contents: [{ role: 'user', parts: userParts }]
            })
          });
          if (gr.ok) {
            const gj = await gr.json();
            const outText = gj?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (outText.trim()) {
              rawReply = outText.trim();
              break;
            }
          }
        } catch (e2) {}
      }
    }

    let reply = (typeof tidy === 'function') ? tidy(rawReply) : String(rawReply || '').trim();
    reply = reply.replace(/Usmi Fashion Schools*ፋሽንs*ትምህርትs*ቤት|Usmi Fashion Schools*ፋሽን|Usmi Fashion School|Usmi Fashion Schools*ፋሽን|Usmi Fashion School/g, 'Usmi Fashion School');

    if (hasHistory) {
      reply = reply.replace(/^(ሰላም!?s*(😊|✨|✂️)?s*|akkams*(jirta|jirtuu)?[!.]?s*)/i, '').trim();
    }

    if (!reply) {
      return res.json({
        reply: hasHistory
          ? 'ለተጨማሪ መረጃ ወይም ለምዝገባ በ ' + telegram + ' ወይም በ ' + phone + ' ማግኘት ይችላሉ። ✨'
          : 'ሰላም! 😊 Usmi Fashion School በ ' + address + ' ይገኛል። ለመረጃ በ ' + telegram + ' ወይም በ ' + phone + ' ያናግሩን! ✨'
      });
    }

    if (typeof TG_TOKEN !== 'undefined' && typeof ADMIN_ID !== 'undefined' && TG_TOKEN && ADMIN_ID) {
      fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: ADMIN_ID, text: `🎓 USMI AI ጥያቄ: ${q}\n\n🤖 ምላሽ: ${reply.slice(0, 600)}` })
      }).catch(() => {});
    }

    return res.json({ reply });
  } catch (err) {
    return res.json({
      reply: 'Usmi Fashion School በጅማ መርካቶ፣ መቱማ ህንፃ 4ኛ ፎቅ ይገኛል። ለመረጃ በ @Usmifashion1 ወይም በ +251901611067 ያናግሩን! ✨'
    });
  }
});

app.get('/u/usmi', (req, res) => {
  const h = (typeof loadUsmiHub === 'function') ? loadUsmiHub() : {};
  const schoolName = h.schoolName || 'USMI FASHION SCHOOL';
  const tagline = h.tagline || 'DESIGN • CREATE • STITCH • INSPIRE';
  const tiktok1 = h.tiktok1 || '@usmi_fashion_school';
  const tiktok1Url = h.tiktok1Url || 'https://www.tiktok.com/@usmi_fashion_school';
  const tiktok2 = h.tiktok2 || '@usmi.design.new.fashoin';
  const tiktok2Url = h.tiktok2Url || 'https://www.tiktok.com/@usmi.design.new.fashoin';
  const telegram = h.telegram || '@Usmifashion1';
  const telegramUrl = h.telegramUrl || 'https://t.me/Usmifashion1';
  const phone = h.phone || '+251901611067';
  const extraHtml = (h.extraLinks || []).map(x =>
    `<a class="link-btn" href="${x.url}" target="_blank" rel="noopener"><div>🔗 ${x.label}</div><span class="sub">ክፈት →</span></a>`
  ).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="am">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${schoolName} | Official Digital Hub</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body {
      background: #090c14;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 20px 14px 50px;
    }
    .wrap { width: 100%; max-width: 500px; display: flex; flex-direction: column; gap: 16px; }
    .card {
      background: #121726;
      border: 1px solid #2b3554;
      border-radius: 22px;
      padding: 22px 18px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
    }
    .hero-top { text-align: center; }
    .logo-badge {
      width: 76px;
      height: 76px;
      margin: 0 auto 12px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #b45309);
      color: #090c14;
      font-weight: 900;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #fde68a;
    }
    h1 { font-size: 1.38rem; color: #fbbf24; letter-spacing: 0.5px; }
    .tagline { font-size: 0.74rem; color: #94a3b8; letter-spacing: 1.2px; margin: 5px 0 14px; }

    .promo-box {
      background: #0d1220;
      border: 1px solid #242e4a;
      border-radius: 16px;
      padding: 15px;
      font-size: 0.9rem;
      line-height: 1.65;
      color: #e2e8f0;
      margin-bottom: 16px;
    }
    .promo-highlight {
      color: #fbbf24;
      font-weight: 700;
      display: block;
      margin-bottom: 6px;
    }

    .links { display: flex; flex-direction: column; gap: 10px; }
    .link-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1a2238;
      border: 1px solid #2e3b5e;
      color: #f8fafc;
      padding: 13px 15px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .link-btn:hover { border-color: #f59e0b; background: #222c47; }
    .link-btn span.sub { font-size: 0.78rem; color: #fbbf24; font-weight: 500; }

    .ai-title { font-size: 1.05rem; font-weight: 700; color: #fbbf24; margin-bottom: 4px; }
    .ai-sub { font-size: 0.78rem; color: #94a3b8; margin-bottom: 12px; }
    .chat-log {
      max-height: 240px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
      padding-right: 4px;
    }
    .bubble {
      padding: 10px 13px;
      border-radius: 13px;
      font-size: 0.88rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .bubble.ai { background: #1a2238; border: 1px solid #2e3b5e; align-self: flex-start; max-width: 88%; }
    .bubble.me { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; align-self: flex-end; max-width: 85%; }
    .chat-form { display: flex; gap: 8px; }
    .chat-form input {
      flex: 1;
      background: #0b0f1a;
      border: 1px solid #2b3554;
      color: #fff;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 0.9rem;
      outline: none;
    }
    .chat-form button {
      background: #f59e0b;
      color: #090c14;
      border: none;
      padding: 0 16px;
      border-radius: 12px;
      font-weight: 800;
      cursor: pointer;
    }

    .qr-mini { text-align: center; }
    .qr-mini img {
      width: 124px;
      height: 124px;
      background: #fff;
      padding: 6px;
      border-radius: 12px;
      margin-bottom: 8px;
    }
    .qr-mini p { font-size: 0.76rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="hero-top">
        <div class="logo-badge">USMI</div>
        <h1>${schoolName}</h1>
        <div class="tagline">${tagline}</div>
      </div>

      <div class="promo-box">
        <span class="promo-highlight">✨ የፈጠራና የፋሽን ስልጠና ማዕከል!</span>
        📍 <b>በተግባር የተደገፈ ስልጠና</b> | የቀን፣ የማታ እና የቅዳሜና እሁድ ፕሮግራሞች አሉን!<br/>
        በዘመናዊ የፋሽን ዲዛይን፣ በልብስ ቆረጣና ስፌት፣ እንዲሁም በተግባር ስራ ላይ ያተኮረ ጥራት ያለው ስልጠና እንሰጣለን። ለጀማሪዎችም ሆነ ክህሎታቸውን ማሳደግ ለሚፈልጉ ምቹ መርሃ ግብሮች አሉን።
      </div>

      <div class="links">
        <a class="link-btn" href="${tiktok1Url}" target="_blank" rel="noopener">
          <div>🎓 የትምህርት ቤታችን ቲክቶክ</div>
          <span class="sub">${tiktok1}</span>
        </a>
        <a class="link-btn" href="${tiktok2Url}" target="_blank" rel="noopener">
          <div>👗 አዳዲስ ዲዛይኖቻችን በቲክቶክ</div>
          <span class="sub">${tiktok2}</span>
        </a>
        <a class="link-btn" href="${telegramUrl}" target="_blank" rel="noopener">
          <div>💬 በቴሌግራም ያናግሩን / ይመዝገቡ</div>
          <span class="sub">${telegram}</span>
        </a>
        <a class="link-btn" href="tel:${phone}">
          <div>📞 በቀጥታ ስልክ ይደውሉ</div>
          <span class="sub">${phone}</span>
        </a>
        ${extraHtml}
      </div>
    </div>

    <div class="card">
      <div class="ai-title">🤖 USMI AI መረጃ እና ጥያቄ መልስ</div>
      <div class="ai-sub">ስለ ስልጠና ፕሮግራሞች፣ የጊዜ ሰሌዳ ወይም ምዝገባ በቀጥታ ይጠይቁ</div>
      <div class="chat-log" id="usmiChatLog">
        <div class="bubble ai">ሰላም! ወደ <b>${schoolName}</b> እንኳን በደህና መጡ። ስለ ስልጠናዎቻችን፣ ስለ ቀን/ማታ/ቅዳሜና እሁድ ፕሮግራሞች ወይም ስለ ምዝገባ ማንኛውንም ጥያቄ መጠየቅ ይችላሉ!</div>
      </div>
      <form class="chat-form" onsubmit="askUsmiAi(event)">
        <input type="text" id="usmiInput" placeholder="ጥያቄዎን እዚህ ይጻፉ..." required />
        <button type="submit" id="usmiSend">ጠይቅ</button>
      </form>
    </div>

    <div class="card qr-mini">
      <img src="/api/qr.png?url=https%3A%2F%2Fseya-design-mmgv.onrender.com%2Fu%2Fusmi" alt="USMI QR" />
      <p>ይህንን QR ስካን በማድረግ <b>/u/usmi</b> ገጽን በቀላሉ ያጋሩ ወይም ይክፈቱ</p>
    </div>
  </div>

  <script>
    async function askUsmiAi(e) {
      e.preventDefault();
      const inp = document.getElementById('usmiInput');
      const btn = document.getElementById('usmiSend');
      const log = document.getElementById('usmiChatLog');
      const q = inp.value.trim();
      if (!q) return;

      const me = document.createElement('div');
      me.className = 'bubble me';
      me.textContent = q;
      log.appendChild(me);
      inp.value = '';
      btn.disabled = true;

      const wait = document.createElement('div');
      wait.className = 'bubble ai';
      wait.textContent = '⏳ ምላሽ በማዘጋጀት ላይ...';
      log.appendChild(wait);
      log.scrollTop = log.scrollHeight;

      try {
        const r = await fetch('/api/usmi-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: q, hasHistory: log.children.length > 1 })
        });
        const d = await r.json();
        wait.textContent = d.reply || d.error || 'ምላሽ ማግኘት አልተቻለም።';
      } catch (err) {
        wait.textContent = 'የኢንተርኔት ግንኙነት ችግር አጋጥሟል።';
      } finally {
        btn.disabled = false;
        log.scrollTop = log.scrollHeight;
      }
    }
  </script>
</body>
</html>`);
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



const QR_CONFIG_FILE = 'qr_config.json';
const QR_USERS_FILE = 'qr_users.json';

function getQrConfig() {
  try {
    if (fs.existsSync(QR_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(QR_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    title: 'SEYA DESIGN | ሰያ ዲዛይን',
    url: 'https://seya-design-mmgv.onrender.com',
    note: 'ጅማ መርካቶ፣ ቁጥር 35 • 0948964203'
  };
}

function saveQrConfig(cfg) {
  fs.writeFileSync(QR_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function loadQrUsers() {
  try {
    if (fs.existsSync(QR_USERS_FILE)) {
      return JSON.parse(fs.readFileSync(QR_USERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveQrUsers(data) {
  fs.writeFileSync(QR_USERS_FILE, JSON.stringify(data, null, 2));
}

function resolveQrTarget(req) {
  const id = String(req.query.id || '').trim().toLowerCase();
  if (id === 'usmi') {
    return {
      id: 'usmi',
      title: 'USMI FASHION SCHOOL',
      url: 'https://seya-design-mmgv.onrender.com/u/usmi',
      note: 'USMI Digital Hub'
    };
  }
  if (id) {
    const users = loadQrUsers();
    if (users[id]) {
      return {
        id,
        title: users[id].title || id,
        url: users[id].url,
        note: users[id].note || ''
      };
    }
  }
  const cfg = getQrConfig();
  return { id: 'default', title: cfg.title, url: cfg.url, note: cfg.note };
}

app.get('/api/qr-info', (req, res) => {
  const target = resolveQrTarget(req);
  const customUrl = String(req.query.url || '').trim();
  const activeUrl = customUrl || target.url;
  const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=340x340&margin=12&data=' + encodeURIComponent(activeUrl);
  res.json({ ...target, activeUrl, qrImageUrl });
});

app.get('/api/qr.png', async (req, res) => {
  try {
    const target = resolveQrTarget(req);
    const customUrl = String(req.query.url || '').trim();
    const activeUrl = customUrl || target.url;
    const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=14&data=' + encodeURIComponent(activeUrl);
    const r = await fetch(apiUrl);
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  } catch (e) {
    res.status(500).send('QR error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('http://localhost:' + PORT + ' | ' + NAME + ' | Gemini ' + GEMINI_MODEL);
});

// Keep Render Awake
setInterval(() => { fetch('https://seya-design-mmgv.onrender.com/api/info').catch(() => {}); }, 600000);
