const { GoogleGenerativeAI } = require('@google/generative-ai');
const Groq = require('groq-sdk');

const geminiClient = process.env.GEMINI_API_KEY?.trim()
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim())
  : null;
const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ─── Codeforces cache (official API) ─────────────────────────────────────────
let cfCache = null;
let cfCacheTime = 0;

async function loadCFCache() {
  if (cfCache && Date.now() - cfCacheTime < CACHE_TTL) return cfCache;
  try {
    const res = await fetch('https://codeforces.com/api/problemset.problems');
    const data = await res.json();
    if (data.status !== 'OK') throw new Error('CF API error');
    cfCache = {};
    for (const p of data.result.problems) {
      cfCache[p.name.toLowerCase().trim()] = p;
    }
    cfCacheTime = Date.now();
    console.log(`[CF] Cached ${Object.keys(cfCache).length} problems`);
  } catch (err) {
    console.warn('[CF] Cache load failed:', err.message);
    cfCache = cfCache || {};
  }
  return cfCache;
}

async function cfLookup(title) {
  const map = await loadCFCache();
  const clean = title.replace(/^\d+[A-Z]\d*\.\s*/i, '').trim();
  const hit = map[clean.toLowerCase()] || map[title.toLowerCase().trim()];
  if (hit) {
    return {
      found: true,
      link: `https://codeforces.com/problemset/problem/${hit.contestId}/${hit.index}`,
      difficulty: hit.rating ? String(hit.rating) : '',
      cfTags: Array.isArray(hit.tags) ? hit.tags : [],
    };
  }
  return {
    found: false,
    link: `https://codeforces.com/problemset?search=${encodeURIComponent(clean || title)}`,
    difficulty: '',
    cfTags: [],
  };
}

// ─── CSES cache (scrape problem list page) ───────────────────────────────────
let csesCache = null;
let csesCacheTime = 0;
let csesLoadPromise = null;

async function loadCSESCache() {
  if (csesCache && Date.now() - csesCacheTime < CACHE_TTL) return csesCache;
  if (csesLoadPromise) return csesLoadPromise; // deduplicate concurrent calls
  csesLoadPromise = (async () => {
    try {
      const res = await fetch('https://cses.fi/problemset/');
      const html = await res.text();
      const regex = /href="\/problemset\/task\/(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/g;
      csesCache = {};
      let m;
      while ((m = regex.exec(html)) !== null) {
        csesCache[m[2].toLowerCase().trim()] = m[1];
      }
      csesCacheTime = Date.now();
      console.log(`[CSES] Cached ${Object.keys(csesCache).length} problems`);
    } catch (err) {
      console.warn('[CSES] Cache load failed:', err.message);
      csesCache = csesCache || {};
    }
    csesLoadPromise = null;
    return csesCache;
  })();
  return csesLoadPromise;
}

async function csesLookup(title) {
  const map = await loadCSESCache();
  const clean = title.replace(/^\d{4,}[.\s]+/, '').trim(); // strip "1633. " prefix
  const taskId = map[clean.toLowerCase()] || map[title.toLowerCase()];
  if (taskId) return `https://cses.fi/problemset/task/${taskId}`;
  // Do NOT fall back to trusting the AI's numeric prefix — it's often wrong
  // (e.g. AI gives "1660. Coin Change" but 1660 is Subarray Sum)
  return `https://cses.fi/problemset/`;
}

// ─── AtCoder cache (AtCoder Problems public API) ──────────────────────────────
let atCoderCache = null;
let atCoderCacheTime = 0;
let atCoderLoadPromise = null;

async function loadAtCoderCache() {
  if (atCoderCache && Date.now() - atCoderCacheTime < CACHE_TTL) return atCoderCache;
  if (atCoderLoadPromise) return atCoderLoadPromise;
  atCoderLoadPromise = (async () => {
    try {
      const res = await fetch('https://kenkoooo.com/atcoder/resources/problems.json');
      const data = await res.json();
      atCoderCache = {};
      for (const p of data) {
        const key = (p.title || p.name || '').toLowerCase().trim();
        if (key) atCoderCache[key] = p;
      }
      atCoderCacheTime = Date.now();
      console.log(`[AtCoder] Cached ${Object.keys(atCoderCache).length} problems`);
    } catch (err) {
      console.warn('[AtCoder] Cache load failed:', err.message);
      atCoderCache = atCoderCache || {};
    }
    atCoderLoadPromise = null;
    return atCoderCache;
  })();
  return atCoderLoadPromise;
}

async function atCoderLookup(title) {
  const map = await loadAtCoderCache();
  const hit = map[title.toLowerCase().trim()];
  if (hit) return `https://atcoder.jp/contests/${hit.contest_id}/tasks/${hit.id}`;
  // AI link is usually correct for AtCoder DP contest — return null to keep it
  return null;
}

// Maps topic keywords → Codeforces tag names
// Used to validate that the CF problem actually matches the requested topic
const TOPIC_TO_CF_TAGS = {
  'dynamic programming': ['dp'],
  'dp': ['dp'],
  'graph': ['graphs', 'dfs and similar', 'bfs', 'shortest paths', 'trees'],
  'bfs': ['bfs'],
  'dfs': ['dfs and similar'],
  'shortest path': ['shortest paths'],
  'minimum spanning tree': ['graphs'],
  'binary search': ['binary search'],
  'greedy': ['greedy'],
  'segment tree': ['data structures'],
  'binary indexed tree': ['data structures'],
  'fenwick': ['data structures'],
  'string': ['strings', 'string suffix structures', 'hashing'],
  'hashing': ['hashing'],
  'number theory': ['number theory', 'math'],
  'math': ['math', 'number theory'],
  'geometry': ['geometry'],
  'two pointer': ['two pointers'],
  'sliding window': ['two pointers'],
  'bit manipulation': ['bitmasks'],
  'bitmask': ['bitmasks'],
  'trie': ['strings', 'trees'],
  'disjoint set': ['dsu'],
  'union find': ['dsu'],
  'combinatorics': ['combinatorics', 'math'],
};

function extractCFTagsForTopic(topic) {
  const t = topic.toLowerCase();
  for (const [keyword, tags] of Object.entries(TOPIC_TO_CF_TAGS)) {
    if (t.includes(keyword)) return tags;
  }
  return null; // unknown topic — no filtering
}

function cfTagsMatchTopic(cfTags, requiredTags) {
  if (!requiredTags) return true; // unknown topic, always pass
  return cfTags.some(tag => requiredTags.includes(tag));
}
// ─────────────────────────────────────────────────────────────────────────────

function leetcodeSlug(title) {
  return title
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}


const VALID_PLATFORMS = new Set([
  'Codeforces', 'LeetCode', 'CodeChef', 'AtCoder',
  'CSES', 'SPOJ', 'Toph', 'HackerRank', 'Kattis',
]);

const PLATFORM_ALIASES = {
  codeforces: 'Codeforces', cf: 'Codeforces',
  leetcode: 'LeetCode',
  codechef: 'CodeChef', 'code chef': 'CodeChef',
  atcoder: 'AtCoder', 'at coder': 'AtCoder',
  cses: 'CSES', 'cses.fi': 'CSES',
  spoj: 'SPOJ',
  toph: 'Toph',
  hackerrank: 'HackerRank', 'hacker rank': 'HackerRank',
  kattis: 'Kattis',
};

function normalizePlatform(raw) {
  const key = (raw || '').trim().toLowerCase();
  return PLATFORM_ALIASES[key]
    || [...VALID_PLATFORMS].find(p => p.toLowerCase() === key)
    || null;
}

function searchUrl(platform, title) {
  const q = encodeURIComponent(title);
  switch (platform) {
    case 'LeetCode':   return `https://leetcode.com/search/?q=${q}`;
    case 'CodeChef':   return `https://www.codechef.com/practice?page=0&search=${q}`;
    case 'AtCoder':    return `https://kenkoooo.com/atcoder/#/search?query=${q}`;
    case 'CSES':       return `https://cses.fi/problemset/`;
    case 'SPOJ':       return `https://www.spoj.com/search/?text=${q}`;
    case 'Toph':       return `https://toph.co/problems?q=${q}`;
    case 'HackerRank': return `https://www.hackerrank.com/search?q=${q}`;
    case 'Kattis':     return `https://open.kattis.com/problems?q=${q}`;
    default:           return `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + platform)}`;
  }
}

// ─── AI prompts ───────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a world-class LeetCode problem curator.

ABSOLUTE RULES — any violation makes the response incorrect:
1. TOPIC RELEVANCE: Every problem must REQUIRE the user's topic as the PRIMARY and ESSENTIAL solution technique.
   - "dynamic programming" → every problem must be unsolvable without DP (memoization or tabulation required)
   - "graphs" → every problem must require graph traversal/algorithms
   - Do NOT include problems that are merely easy or popular but unrelated to the topic
   - Do NOT include problems where the topic is optional or just one possible approach
2. REAL PROBLEMS ONLY: Every problem must actually exist on LeetCode.
3. NO TUTORIALS: Never link to GeeksforGeeks, Wikipedia, blogs, or articles.
4. PLATFORM: Only use LeetCode.
5. ACCURATE DIFFICULTY: Use LeetCode's official difficulty — Easy / Medium / Hard.`;

function buildPrompt(topic, count) {
  return `Curate exactly ${count} LeetCode problems where "${topic}" is the PRIMARY required technique.

Include a good range from Easy to Hard difficulty.

BEFORE choosing each problem, ask yourself: "Is ${topic} truly required to solve this optimally?"
If the answer is no — skip that problem and pick another.

Return ONLY a raw JSON array. No markdown, no code fences, nothing else.

Each object must have EXACTLY these fields:
  "title"      - exact official LeetCode name including number: "300. Longest Increasing Subsequence"
  "platform"   - always "LeetCode"
  "difficulty" - "Easy" / "Medium" / "Hard"
  "link"       - https://leetcode.com/problems/{slug}/
  "tags"       - 2-4 specific subtopic strings e.g. ["1d dp","kadane's algorithm"] not just ["dp"]
  "description" - explain what makes this problem require "${topic}" specifically

Raw JSON only.`;
}
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAICompat(baseUrl, apiKey, model, messages, extraHeaders = {}) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 8192 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

async function callAI(prompt) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: prompt },
  ];

  console.log('[AI] Providers configured:', [
    geminiClient && 'Gemini',
    groqClient && 'Groq',
    process.env.CEREBRAS_API_KEY && 'Cerebras',
    process.env.OPENROUTER_API_KEY && 'OpenRouter',
  ].filter(Boolean).join(', ') || 'none');

  if (geminiClient) {
    try {
      const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      console.log('[AI] Gemini OK');
      return result.response.text().trim();
    } catch (err) {
      console.warn('[AI] Gemini failed:', err.message.split('\n')[0]);
    }
  }

  if (groqClient) {
    const groqModels = [
      { model: 'llama-3.3-70b-versatile',  max_tokens: 8192 },
      { model: 'llama-3.1-8b-instant',     max_tokens: 5000 }, // 6000 TPM cap — keep prompt+output under it
    ];
    for (const { model, max_tokens } of groqModels) {
      try {
        const res = await groqClient.chat.completions.create({
          model,
          messages,
          temperature: 0.1,
          max_tokens,
        });
        console.log(`[AI] Groq OK (${model})`);
        return res.choices[0]?.message?.content?.trim() || '';
      } catch (err) {
        console.warn(`[AI] Groq ${model} failed:`, err.message.split('\n')[0]);
      }
    }
  }

  if (process.env.CEREBRAS_API_KEY) {
    const cerebrasModels = ['llama3.3-70b', 'llama3.1-70b', 'llama3.1-8b'];
    for (const model of cerebrasModels) {
      try {
        const text = await callOpenAICompat(
          'https://api.cerebras.ai/v1',
          process.env.CEREBRAS_API_KEY.trim(),
          model,
          messages
        );
        console.log(`[AI] Cerebras OK (${model})`);
        return text;
      } catch (err) {
        console.warn(`[AI] Cerebras ${model} failed:`, err.message.split('\n')[0]);
      }
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    const orModels = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'qwen/qwen-2.5-7b-instruct:free',
      'google/gemma-2-9b-it:free',
    ];
    for (const model of orModels) {
      try {
        const text = await callOpenAICompat(
          'https://openrouter.ai/api/v1',
          process.env.OPENROUTER_API_KEY.trim(),
          model,
          messages,
          { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'CP Coach' }
        );
        console.log(`[AI] OpenRouter OK (${model})`);
        return text;
      } catch (err) {
        console.warn(`[AI] OpenRouter ${model} failed:`, err.message.split('\n')[0]);
      }
    }
  }

  throw new Error('No AI provider available. Add a key for Gemini, Groq, Cerebras, or OpenRouter in .env');
}

function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in AI response');
  const arr = JSON.parse(match[0]);
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array from AI');
  return arr;
}

async function getProblems(topic, count = 25) {
  // Ask for slightly more than needed — some will be filtered
  const text = await callAI(buildPrompt(topic, Math.ceil(count * 1.2)));
  console.log('[AI] Preview:', text.slice(0, 150));

  const raw = parseJSON(text);
  const requiredCFTags = extractCFTagsForTopic(topic);

  const problems = await Promise.all(
    raw
      .filter(p => p && typeof p === 'object')
      .map(async p => {
        const title    = String(p.title || p.name || '').trim();
        const platform = normalizePlatform(p.platform || p.judge || '');
        const aiLink   = String(p.link || p.url || '').trim();
        const aiDiff   = String(p.difficulty || p.rating || '').trim();

        if (!title || !platform) return null;

        let link = aiLink;
        let difficulty = aiDiff;

        if (platform === 'Codeforces') {
          const cf = await cfLookup(title);
          link = cf.link;
          if (cf.difficulty) difficulty = cf.difficulty; // real rating from CF API

          // Skip CF problems whose tags don't match the requested topic
          if (cf.found && !cfTagsMatchTopic(cf.cfTags, requiredCFTags)) {
            console.log(`[Filter] Skipped CF problem "${title}" — tags [${cf.cfTags.join(', ')}] don't match topic`);
            return null;
          }
        } else if (platform === 'LeetCode') {
          const slug = leetcodeSlug(title);
          link = aiLink.includes('leetcode.com/problems/') ? aiLink
               : `https://leetcode.com/problems/${slug}/`;
        } else if (platform === 'CSES') {
          link = await csesLookup(title); // verified against scraped CSES problem list
        } else if (platform === 'AtCoder') {
          const ac = await atCoderLookup(title);
          link = ac || (aiLink || searchUrl('AtCoder', title)); // use API hit, else keep AI link
        } else {
          link = aiLink || searchUrl(platform, title);
        }

        return {
          title,
          platform,
          difficulty,
          link,
          tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
          description: String(p.description || '').trim(),
        };
      })
  );

  const filtered = problems.filter(Boolean).slice(0, count);
  console.log(`[Problems] ${filtered.length} returned after validation`);
  return filtered;
}

module.exports = { getProblems };
