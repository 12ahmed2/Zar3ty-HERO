/* ================= ADD TO TOP OF translate.js ================= */
const TRANSLATION_CACHE = new Map();
const TRANSLATE_TIMEOUT = 2000;

// Keep your original exports intact, but enhance them additively
export async function translateCached(text, src, dest) {
  if (!text || text.length < 2) return text;
  const key = `${src}_${dest}_${text.trim().toLowerCase()}`;
  if (TRANSLATION_CACHE.has(key)) return TRANSLATION_CACHE.get(key);
  
  // Use relative path in production, fallback to your local server in dev
  const baseUrl = window.TRANSLATION_ENDPOINT || '/api/translate';
  const url = `${baseUrl}?text=${encodeURIComponent(text)}&src=${src}&dest=${dest}`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal, method: 'GET' });
    clearTimeout(timeout);
    
    if (!res.ok) return text;
    const data = await res.json();
    const out = data.translated_text || text;
    TRANSLATION_CACHE.set(key, out);
    return out;
  } catch (e) {
    console.warn('Translation skipped/failed:', e.message);
    return text; // Fallback safely
  }
}

// Proxy for your existing imports to keep everything working
export const translateSafe = translateCached;

export function detectLanguage(text) {
  const arabic = /[\u0600-\u06FF]/;
  const english = /[A-Za-z]/;

  if (arabic.test(text)) {
    return "ar"; // Arabic
  } else if (english.test(text)) {
    return "en"; // English
  } else {
    return "unknown"; // لو مش عربي ولا إنجليزي
  }
}


export async function translate(text, src, dest) {
  const response = await fetch(
    `http://127.0.0.1:5000/translate?text=${encodeURIComponent(text)}&src=${src}&dest=${dest}`,
    { method: "GET" }
  );

  const data = await response.json();
  return data.translated_text;
}


