import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

const callWithRetry = async (fn, retries = 3, delay = 1500) => {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorStr = String(error);
      if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('503') || errorStr.includes('500')) {
        if (i < retries) {
          console.log(`[retry] API issue (${errorStr.slice(0, 30)}...), retrying ${i + 1}/${retries} in ${delay * (i + 1)}ms...`);
          await new Promise(r => setTimeout(r, delay * (i + 1)));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
};

const decodeHtml = (text = '') =>
  text
    .replace(/<b>/gi, '')
    .replace(/<\/b>/gi, '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const getHostname = (uri) => {
  try {
    return new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const inferMediaNameFromHostname = (uri) => {
  const hostname = getHostname(uri);

  if (hostname.includes('donga.com')) return '동아일보';
  if (hostname.includes('chosun.com')) return '조선일보';
  if (hostname.includes('joongang.co.kr') || hostname.includes('joongang.joins.com')) return '중앙일보';
  if (hostname.includes('hani.co.kr')) return '한겨레';
  if (hostname.includes('khan.co.kr')) return '경향신문';
  if (hostname.includes('sbs.co.kr')) return 'SBS';
  if (hostname.includes('kbs.co.kr')) return 'KBS';
  if (hostname.includes('imbc.com') || hostname.includes('mbc.co.kr')) return 'MBC';
  if (hostname.includes('ytn.co.kr')) return 'YTN';
  if (hostname.includes('mk.co.kr')) return '매일경제';
  if (hostname.includes('hankyung.com')) return '한국경제';
  if (hostname.includes('yna.co.kr') || hostname.includes('yna.kr')) return '연합뉴스';
  if (hostname.includes('news1.kr')) return '뉴스1';
  if (hostname.includes('newsis.com')) return '뉴시스';
  if (hostname.includes('jtbc.co.kr')) return 'JTBC';
  if (hostname.includes('tvchosun.com')) return 'TV조선';
  if (hostname.includes('mbn.co.kr')) return 'MBN';

  return hostname || '주요 언론';
};

const isLikelyArticleUrl = (uri) => {
  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    const search = url.search.toLowerCase();

    if (!path || path === '/' || path === '/main.html' || path === '/index.html') {
      return false;
    }

    const blocked = [
      '/search',
      '/category',
      '/tag',
      '/topic',
    ];

    if (blocked.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return false;
    }

    // Allow common news paths even if they contain 'main' or 'index'
    if (path.includes('article') || path.includes('read.nhn') || path.includes('view')) {
      return true;
    }

    if (path === '/' || path === '/index.html') {
      return false;
    }

    if (
      search.includes('query=') ||
      search.includes('keyword=') ||
      search.includes('search=') ||
      search.includes('q=')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

// 신뢰할 수 있는 주요 언론사 도메인 목록
const TRUSTED_DOMAINS = [
  'donga.com',
  'chosun.com',
  'joongang.co.kr', 'joins.com',
  'hani.co.kr',
  'khan.co.kr',
  'yna.co.kr',
  'yonhapnews.co.kr',
  'news1.kr',
  'newsis.com',
  'ytn.co.kr',
  'sbs.co.kr',
  'kbs.co.kr',
  'mbc.co.kr', 'imbc.com',
  'jtbc.co.kr',
  'tvchosun.com',
  'mbn.co.kr',
  'mk.co.kr',
  'hankyung.com',
  'sedaily.com',
  'dt.co.kr',
  'etnews.com',
  'zdnet.co.kr',
  'bloter.net',
  'hankookilbo.com',
  'ohmynews.com',
  'pressian.com',
  'newspim.com',
  'edaily.co.kr',
  'mt.co.kr',
  'heraldcorp.com',
];

const isTrustedMedia = (uri) => {
  try {
    const hostname = new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
    return TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

const scoreNews = (query, item) => {
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 2);

  const haystack = `${item.title} ${item.snippet || ''}`.toLowerCase();
  let score = 0;

  // 키워드 관련성
  for (const keyword of keywords) {
    if (item.title.toLowerCase().includes(keyword)) score += 5;
    else if (haystack.includes(keyword)) score += 2;
  }

  // 신뢰 언론사 가중치
  if (item.mediaName === '동아일보') score += 5;
  else if (isTrustedMedia(item.uri)) score += 3;

  if (isLikelyArticleUrl(item.uri)) score += 2;

  return score;
};

app.get('/api/search-news', async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const getValidKey = () => {
      const keys = [process.env.GEMINI_API_KEY, process.env.API_KEY];
      for (const key of keys) {
        if (key && !key.includes('TODO') && !key.includes('YOUR_') && key.length > 20) {
          return key;
        }
      }
      return null;
    };

    const apiKey = getValidKey();
    
    if (!apiKey) {
      const gKey = process.env.GEMINI_API_KEY;
      const aKey = process.env.API_KEY;
      console.error('[search-news] API Key issue. GEMINI_API_KEY:', gKey ? 'Set (but maybe invalid)' : 'Missing', 'API_KEY:', aKey ? 'Set (but maybe invalid)' : 'Missing');
      return res.status(500).json({ error: 'A valid Gemini API key is required. Please set GEMINI_API_KEY in the application settings.' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // Gemini Google Search grounding — 서버에서 호출하므로 CORS/차단 없음
    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `"${query}" 관련 최신 한국 뉴스를 검색해주세요. 동아일보·조선일보·중앙일보·한겨레·연합뉴스·KBS·MBC·SBS·JTBC·매일경제·한국경제 등 주요 언론사 기사를 중심으로 3~4개 찾아서, 각 기사의 제목과 핵심 내용 1~2문장을 한국어로 알려주세요.`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    }));

    const responseText = response.text ?? '';

    // 1순위: groundingChunks — 실제 검색된 URL (hallucination 없음)
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    console.log(`[search-news] grounding chunks: ${chunks.length}, query: "${query}"`);

    let items = [];

    if (chunks.length > 0) {
      const textLines = responseText.split('\n').map(l => l.trim()).filter(Boolean);

      items = chunks
        .filter(c => c.web?.uri && isLikelyArticleUrl(c.web.uri))
        .map(c => {
          const uri = c.web.uri;
          const title = c.web?.title ?? '';
          const hostname = getHostname(uri);
          const mediaName = inferMediaNameFromHostname(uri);

          // title 키워드로 응답 텍스트에서 snippet 추출
          const keywords = title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 1).slice(0, 4);
          const matched = textLines.find(l =>
            keywords.filter(k => l.includes(k)).length >= Math.min(2, keywords.length)
          ) ?? '';
          const snippet = matched.replace(/^[-•*\d.]+\s*/, '').replace(uri, '').trim().slice(0, 200);

          return { uri, title, mediaName, hostname, snippet, image: FALLBACK_NEWS_IMAGE };
        })
        .filter(item => item.uri && item.title);

      // 신뢰 언론사 우선 정렬
      const trusted = items.filter(item => isTrustedMedia(item.uri));
      items = (trusted.length >= 2 ? trusted : items).slice(0, 4);
    }

    // 2순위: 응답 텍스트에서 URL 직접 추출 (chunks 없을 때)
    if (items.length === 0 && responseText) {
      const urlRegex = /https?:\/\/[^\s\)\]\>"']+/g;
      const foundUrls = [...new Set(responseText.match(urlRegex) ?? [])];
      const newsUrls = foundUrls.filter(url => isTrustedMedia(url) && isLikelyArticleUrl(url));
      const textLines = responseText.split('\n').map(l => l.trim()).filter(Boolean);

      items = newsUrls.slice(0, 4).map(uri => {
        const urlLineIdx = textLines.findIndex(l => l.includes(uri));
        const nearby = textLines.slice(Math.max(0, urlLineIdx - 2), urlLineIdx + 3).join(' ');
        const snippet = nearby.replace(uri, '').replace(/^[-•*\d.]+\s*/, '').trim().slice(0, 200);
        return {
          uri,
          title: snippet.slice(0, 60) || '관련 기사',
          mediaName: inferMediaNameFromHostname(uri),
          hostname: getHostname(uri),
          snippet,
          image: FALLBACK_NEWS_IMAGE,
        };
      });
    }

    console.log(`[search-news] returning ${items.length} items`);
    return res.json({ items });
  } catch (error) {
    console.error('search-news error:', error);
    return res.status(500).json({ error: 'Internal server error', items: [] });
  }
});

// 기사 생성 — 2단계: 1)grounding으로 실제 내용 수집 2)그 내용으로 기사 작성
app.post('/api/write-article', async (req, res) => {
  const { topic, category } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'Missing topic' });

  try {
    const getValidKey = () => {
      const keys = [process.env.GEMINI_API_KEY, process.env.API_KEY];
      for (const key of keys) {
        if (key && !key.includes('TODO') && !key.includes('YOUR_') && key.length > 20) {
          return key;
        }
      }
      return null;
    };

    const apiKey = getValidKey();
    
    if (!apiKey) {
      const gKey = process.env.GEMINI_API_KEY;
      const aKey = process.env.API_KEY;
      console.error('[write-article] API Key issue. GEMINI_API_KEY:', gKey ? 'Set (but maybe invalid)' : 'Missing', 'API_KEY:', aKey ? 'Set (but maybe invalid)' : 'Missing');
      return res.status(500).json({ error: 'A valid Gemini API key is required. Please set GEMINI_API_KEY in the application settings.' });
    }

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    // ── 1단계: googleSearch grounding으로 실제 최신 기사 내용 수집 ──
    let searchRes;
    try {
      searchRes = await callWithRetry(() => ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `"${topic}"을 검색해서 최신 한국 뉴스 보도 내용을 상세하게 정리해주세요.
동아일보·조선일보·중앙일보·한겨레·연합뉴스·KBS·MBC·SBS·JTBC·매일경제·한국경제 등 주요 언론사 기사를 중심으로,
실제 보도된 사실·수치·인물 발언·날짜·기관명을 최대한 구체적으로 정리해주세요.`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      }));
    } catch (searchErr) {
      console.error('[write-article] search step failed:', searchErr);
      throw new Error('최신 정보를 검색하는 중 오류가 발생했습니다. (네트워크 또는 할당량 문제)');
    }

    const searchContent = searchRes.text?.trim() ?? '';
    const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    console.log(`[write-article] step1 grounding chunks: ${chunks.length}, content length: ${searchContent.length}`);

    if (searchContent.length < 50 && chunks.length === 0) {
      throw new Error('최신 정보를 검색하지 못했습니다. 잠시 후 다시 시도해주세요.');
    }

    // 출처 메타데이터: chunks URL + searchContent에서 snippet 추출
    const contentLines = searchContent.split('\n').map(l => l.trim()).filter(Boolean);
    const sources = chunks
      .filter(c => c.web?.uri && isLikelyArticleUrl(c.web.uri))
      .slice(0, 4)
      .map(c => {
        const uri = c.web.uri;
        const title = c.web?.title ?? '';
        const hostname = getHostname(uri);
        const mediaName = inferMediaNameFromHostname(uri);

        // title 키워드로 searchContent에서 관련 문장 추출
        const keywords = title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 1).slice(0, 4);
        const matchedLine = contentLines.find(l =>
          keywords.filter(k => l.includes(k)).length >= Math.min(2, keywords.length)
        ) ?? '';
        const snippet = matchedLine.replace(/^[-•*\d.]+\s*/, '').trim().slice(0, 200);

        return { uri, title, mediaName, hostname, snippet, image: FALLBACK_NEWS_IMAGE };
      });

    const trustedSources = sources.filter(s => isTrustedMedia(s.uri));
    const finalSources = trustedSources.length >= 2 ? trustedSources : sources;

    // ── 2단계: 수집된 실제 내용으로 기사 작성 (JSON schema 사용) ──
    const writeRes = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `당신은 동아일보의 전문 기자입니다.
주제: "${topic}" (카테고리: ${category || 'general'})

아래는 Google 검색으로 수집한 실제 최신 보도 내용입니다.
이 내용에 있는 사실만 사용해서 기사를 작성하세요. 검색 내용에 없는 내용은 절대 추가하지 마세요.

[실제 검색된 최신 보도 내용]
${searchContent}

[기사 작성 규칙]
1. 마크다운 기호(###, **, *) 절대 금지
2. 본문은 <p> 태그로 문단 구분, 최소 5문단
3. 소제목은 <h3 style="font-family:Pretendard;margin-top:24px;color:#1a3a6b;">소제목</h3>
4. 위 검색 내용의 수치·인물·기관명·날짜를 그대로 사용
5. summary는 2~3문장 요약
6. factCheck는 위 검색 내용에서 확인된 핵심 팩트 3가지`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING },
            content: { type: Type.STRING },
            factCheck: { type: Type.ARRAY, items: { type: Type.STRING } },
            imageKeyword: { type: Type.STRING },
          },
          required: ['title', 'category', 'summary', 'content', 'factCheck', 'imageKeyword'],
        },
        temperature: 0.2,
      },
    }));

    const articleText = writeRes.text?.trim() ?? '';
    let parsed;
    try {
      // JSON 블록만 추출하는 더 견고한 방식
      const jsonMatch = articleText.match(/\{[\s\S]*\}/);
      const jsonToParse = jsonMatch ? jsonMatch[0] : articleText;
      const clean = jsonToParse.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('[write-article] JSON parse failed:', articleText.slice(0, 500));
      throw new Error('기사 데이터 형식이 올바르지 않습니다. (JSON 파싱 실패)');
    }

    console.log(`[write-article] done. sources: ${finalSources.length}, title: "${parsed.title?.slice(0,30)}"`);

    return res.json({
      ...parsed,
      searchSources: finalSources,
      citedIndices: [],
    });
  } catch (error) {
    console.error('write-article error:', error);
    return res.status(500).json({ error: String(error) });
  }
});

app.get('/api/suggestions', async (req, res) => {
  try {
    const getValidKey = () => {
      const keys = [process.env.GEMINI_API_KEY, process.env.API_KEY];
      for (const key of keys) {
        if (key && !key.includes('TODO') && !key.includes('YOUR_') && key.length > 20) {
          return key;
        }
      }
      return null;
    };

    const apiKey = getValidKey();
    if (!apiKey) return res.status(500).json({ error: 'API key missing' });

    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const currentDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    const response = await callWithRetry(() => ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `당신은 대한민국 대표 일간지인 동아일보의 AI 편집국장입니다. 오늘 날짜는 ${currentDate}입니다. Google 검색 도구를 사용하여 현재 대한민국에서 가장 화제가 되고 있는 정치, 경제, 사회, IT/과학 분야의 핵심 뉴스 4가지를 찾아 취재 아이템으로 추천하세요. 반드시 현재 실제로 보도되고 있는 실시간 속보 및 주요 뉴스여야 합니다.`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              angle: { type: Type.STRING },
              urgency: { type: Type.STRING },
            },
            required: ['id', 'title', 'category', 'angle', 'urgency'],
          },
        },
      },
    }));

    const text = response.text?.trim();
    if (!text) throw new Error('Empty response');
    
    return res.json(JSON.parse(text));
  } catch (error) {
    console.error('suggestions error:', error);
    return res.status(500).json({ error: String(error) });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile('dist/index.html', { root: '.' });
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
}

startServer();
