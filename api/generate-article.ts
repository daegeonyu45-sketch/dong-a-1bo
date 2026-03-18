import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

type RawArticleCandidate = {
  uri?: string;
  url?: string;
  link?: string;
  title?: string;
  mediaName?: string;
  source?: string;
  press?: string;
  publisher?: string;
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  snippet?: string;
  description?: string;
  summary?: string;
};

type SearchSource = {
  uri: string;
  title: string;
  mediaName: string;
  hostname: string;
  image?: string;
  snippet?: string;
};

type ScoredSearchSource = SearchSource & {
  relevanceScore: number;
};

const TRUSTED_NEWS_MEDIA = [
  { name: '동아일보', domains: ['donga.com'] },
  { name: '조선일보', domains: ['chosun.com'] },
  { name: '중앙일보', domains: ['joongang.co.kr', 'joongang.joins.com'] },
  { name: '한겨레', domains: ['hani.co.kr'] },
  { name: '경향신문', domains: ['khan.co.kr'] },
  { name: 'SBS', domains: ['sbs.co.kr', 'news.sbs.co.kr'] },
  { name: 'KBS', domains: ['kbs.co.kr', 'news.kbs.co.kr'] },
  { name: 'MBC', domains: ['mbc.co.kr', 'imnews.imbc.com'] },
  { name: 'YTN', domains: ['ytn.co.kr'] },
  { name: '매일경제', domains: ['mk.co.kr'] },
  { name: '한국경제', domains: ['hankyung.com'] },
  { name: '연합뉴스', domains: ['yna.co.kr', 'yna.kr'] },
  { name: '뉴스1', domains: ['news1.kr'] },
  { name: '뉴시스', domains: ['newsis.com'] },
  { name: 'TV조선', domains: ['tvchosun.com'] },
  { name: 'MBN', domains: ['mbn.co.kr'] },
  { name: 'JTBC', domains: ['jtbc.co.kr', 'news.jtbc.joins.com'] },
];

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

const normalizeUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return '';
};

const getHostname = (uri: string) => {
  try {
    return new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const inferMediaNameFromHostname = (uri?: string) => {
  const hostname = getHostname(uri || '');
  if (!hostname) return '주요 언론';

  const found = TRUSTED_NEWS_MEDIA.find((media) =>
    media.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  );

  return found?.name || hostname;
};

const normalizeSource = (source?: string, uri?: string): string => {
  if (source?.trim()) return source.trim();
  return inferMediaNameFromHostname(uri);
};

const normalizeImageUrl = (image?: string): string => {
  const url = normalizeUrl(image);
  return url || FALLBACK_NEWS_IMAGE;
};

const tokenizeTopic = (topic: string): string[] => {
  const stopwords = new Set([
    '및', '대한', '관련', '기사', '분석', '전망', '최근', '이슈', '논란', '속보',
    '에서', '으로', '한다', '했다', '위한', '국내', '해외', '정부', '시장', '기자',
    '보도', '이번', '현재', '가운데', '있는', '있다', '합니다', '입니다', '여부',
    '영향', '가능성', '상황', '이후', '관련한', '대해', '정리', '기준',
  ]);

  return Array.from(
    new Set(
      topic
        .split(/[\s,.:;!?()[\]'"“”‘’\-_/]+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 2 && !stopwords.has(w))
    )
  );
};

const isLikelyBrokenArticle = (title: string, uri: string) => {
  const normalizedTitle = (title || '').toLowerCase();
  const errorPatterns = [
    '페이지를 찾을 수',
    '404 not found',
    '삭제된 기사',
    '요청하신 페이지',
    'error',
    '로그인',
    '회원가입',
    'access denied',
    'forbidden',
    'not found',
    '잘못된 접근',
    '유효하지 않은',
    '존재하지 않는',
  ];

  if (errorPatterns.some((token) => normalizedTitle.includes(token))) return true;

  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    const full = `${path}${url.search}`.toLowerCase();

    if (!path || path === '/' || path === '/index.html' || path === '/index.php' || path === '/main.html') {
      return true;
    }

    if (
      full.includes('/search') ||
      full.includes('query=') ||
      full.includes('keyword=') ||
      full.includes('search=') ||
      full.includes('q=')
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
};

const isValidArticleUrl = (uri: string) => {
  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    const search = url.search.toLowerCase();
    const hostname = url.hostname.toLowerCase();

    if (!hostname || !path) return false;

    if (path === '/' || path === '' || path === '/index.html' || path === '/main.html') {
      return false;
    }

    const excludedStarts = [
      '/section', '/sections', '/category', '/list', '/search', '/tag',
      '/topic', '/result', '/ranking', '/home', '/main', '/series', '/special',
    ];

    if (excludedStarts.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return false;
    }

    if (
      search.includes('query=') ||
      search.includes('q=') ||
      search.includes('keyword=') ||
      search.includes('search=')
    ) {
      return false;
    }

    const articleHints = [
      '/article/',
      '/articles/',
      '/news/view/',
      '/view/',
      '/news/article/',
      '/articleview/',
      '/v/',
      '/news/',
      '/newsroom/',
    ];

    const hasArticleHint = articleHints.some((hint) => path.includes(hint.toLowerCase()));
    const hasArticleIdParam =
      search.includes('id=') ||
      search.includes('idx=') ||
      search.includes('no=') ||
      search.includes('articleid=') ||
      search.includes('artid=') ||
      search.includes('news_id=') ||
      search.includes('sid=');

    const hasLongNumericToken =
      /\d{6,}/.test(path) ||
      /\d{4}\/\d{2}\/\d{2}/.test(path) ||
      /\d{4}-\d{2}-\d{2}/.test(path);

    if (hasArticleHint || hasArticleIdParam || hasLongNumericToken) return true;

    const segments = path.split('/').filter(Boolean);
    if (segments.length >= 3 && segments.some((seg) => /\d{4,}/.test(seg))) return true;

    return false;
  } catch {
    return false;
  }
};

const verifyArticlePage = async (uri: string): Promise<boolean> => {
  if (!isValidArticleUrl(uri)) return false;

  try {
    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/verify-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return !!data?.valid;
  } catch {
    return false;
  }
};

const scoreRelatedArticle = (
  topic: string,
  article: { title?: string; snippet?: string; mediaName?: string; uri?: string }
): number => {
  const keywords = tokenizeTopic(topic);
  const title = (article.title || '').toLowerCase();
  const snippet = (article.snippet || '').toLowerCase();
  const haystack = `${title} ${snippet}`;

  let score = 0;

  for (const keyword of keywords) {
    if (title.includes(keyword)) score += 6;
    else if (haystack.includes(keyword)) score += 2;
  }

  if (article.title && article.title.length >= 8) score += 1;

  const mediaName = article.mediaName || '';
  if (mediaName.includes('동아일보')) score += 3;
  else if (TRUSTED_NEWS_MEDIA.some((m) => mediaName.includes(m.name))) score += 1;

  if (article.uri && isValidArticleUrl(article.uri)) score += 3;

  return score;
};

const refineRelatedArticles = async (
  topic: string,
  rawArticles: RawArticleCandidate[] = []
): Promise<SearchSource[]> => {
  const normalized: ScoredSearchSource[] = rawArticles
    .map((item) => {
      const uri = normalizeUrl(item.uri || item.url || item.link);
      const title = (item.title || '').trim();
      const mediaName = normalizeSource(
        item.mediaName || item.source || item.press || item.publisher,
        uri
      );
      const snippet = (item.snippet || item.description || item.summary || '').trim();

      const article: SearchSource = {
        uri,
        title,
        mediaName,
        hostname: getHostname(uri),
        image: normalizeImageUrl(
          item.image || item.imageUrl || item.thumbnail || item.thumbnailUrl
        ),
        snippet,
      };

      const relevanceScore = scoreRelatedArticle(topic, {
        title,
        snippet,
        mediaName,
        uri,
      });

      return { ...article, relevanceScore };
    })
    .filter((item) => {
      if (!item.title || !item.uri) return false;
      if (isLikelyBrokenArticle(item.title, item.uri)) return false;
      if (!isValidArticleUrl(item.uri)) return false;
      return true;
    });

  const seen = new Set<string>();
  const deduped = normalized.filter((item) => {
    if (seen.has(item.uri)) return false;
    seen.add(item.uri);
    return true;
  });

  const verificationPool = deduped.slice(0, 12);
  const verifiedResults = await Promise.all(
    verificationPool.map(async (item) => {
      const ok = await verifyArticlePage(item.uri);
      return ok ? item : null;
    })
  );

  const verified = verifiedResults.filter(Boolean) as ScoredSearchSource[];
  const sorted = verified.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const picked: SearchSource[] = [];
  const sourceCount = new Map<string, number>();

  for (const item of sorted) {
    if (item.relevanceScore < 4) continue;

    const count = sourceCount.get(item.mediaName) || 0;
    if (count >= 2) continue;

    picked.push({
      uri: item.uri,
      title: item.title,
      mediaName: item.mediaName,
      image: item.image,
      snippet: item.snippet,
      hostname: item.hostname,
    });

    sourceCount.set(item.mediaName, count + 1);

    if (picked.length >= 4) break;
  }

  if (picked.length < 2) {
    for (const item of sorted) {
      if (picked.some((p) => p.uri === item.uri)) continue;
      if (item.relevanceScore < 2) continue;

      picked.push({
        uri: item.uri,
        title: item.title,
        mediaName: item.mediaName,
        image: item.image,
        snippet: item.snippet,
        hostname: item.hostname,
      });

      if (picked.length >= 2) break;
    }
  }

  return picked;
};

const buildSearchPrompts = (topic: string, category: string) => {
  const keywords = tokenizeTopic(topic).slice(0, 6);
  const keywordQuery = keywords.join(' ');
  const trustedDomainsQuery = TRUSTED_NEWS_MEDIA.map((m) =>
    m.domains.map((d) => `site:${d}`).join(' OR ')
  ).join(' OR ');

  return [
    `
주제: "${topic}"
카테고리: "${category}"

이 주제와 직접 관련된 최신 뉴스 기사 상세 페이지 URL을 최소 8개 찾으세요.
반드시 실제 기사 본문으로 연결되는 URL만 선택하세요.

출력은 JSON 배열만 반환하세요.
각 항목 형식:
{
  "title": "",
  "uri": "",
  "mediaName": "",
  "snippet": ""
}

중요:
- 언론사 메인 홈페이지 금지
- 섹션/카테고리 페이지 금지
- 검색 결과 페이지 금지
- 기사 상세 URL만 허용
- topic과 직접 관련된 기사만 허용
- 삭제되었거나 접근 불가한 기사 제외
`.trim(),

    `
검색 키워드: "${keywordQuery}"

위 키워드와 직접 관련된 한국 언론 기사 상세 페이지 URL을 최소 8개 찾으세요.
실제 기사 본문 링크만 반환하세요.

출력은 JSON 배열만 반환하세요.
각 항목 형식:
{
  "title": "",
  "uri": "",
  "mediaName": "",
  "snippet": ""
}

금지:
- 홈페이지
- 섹션 페이지
- 검색 페이지
- 삭제 기사
`.trim(),

    `
검색 대상 언론사: ${trustedDomainsQuery}
검색 주제: "${topic}"

위 주제와 직접 관련된 기사 상세 페이지 URL만 찾아 JSON 배열로 반환하세요.
반드시 제목에 주제 핵심 키워드가 직접 포함된 기사들을 우선 선택하세요.

각 항목 형식:
{
  "title": "",
  "uri": "",
  "mediaName": "",
  "snippet": ""
}
`.trim(),
  ];
};

const extractJson = (text: string) => {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = cleanText.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = cleanText.lastIndexOf(']');
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return cleanText.substring(startIdx, endIdx + 1);
    }

    return cleanText;
  } catch {
    return text;
  }
};

const safeJsonParse = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(extractJson(text)) as T;
  } catch {
    return fallback;
  }
};

const createAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API key must be set when using the Gemini API.');
  }
  return new GoogleGenAI({ apiKey });
};

const searchArticleCandidates = async (
  ai: GoogleGenAI,
  topic: string,
  category: string
): Promise<RawArticleCandidate[]> => {
  const prompts = buildSearchPrompts(topic, category);
  const merged: RawArticleCandidate[] = [];

  for (const prompt of prompts) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const parsed = safeJsonParse<RawArticleCandidate[]>(response.text, []);
      merged.push(...parsed);

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const groundingCandidates: RawArticleCandidate[] = groundingChunks
        .filter((chunk: { web?: { uri?: string; title?: string } }) => !!chunk.web?.uri)
        .map((chunk: { web?: { uri?: string; title?: string } }) => ({
          uri: chunk.web!.uri!,
          title: chunk.web!.title || '',
          mediaName: inferMediaNameFromHostname(chunk.web!.uri),
          snippet: '',
        }));

      merged.push(...groundingCandidates);
    } catch (e) {
      console.error('searchArticleCandidates prompt failed:', e);
    }
  }

  return merged;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { topic, category } = req.body || {};

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ ok: false, error: 'topic is required' });
    }

    const safeCategory = typeof category === 'string' ? category : 'social';
    const ai = createAI();

    const rawCandidates = await searchArticleCandidates(ai, topic, safeCategory);
    const refinedSources = await refineRelatedArticles(topic, rawCandidates);

    const sourcesContext =
      refinedSources.length > 0
        ? refinedSources
            .map(
              (s, i) =>
                `[참고기사 ${i + 1}]
제목: ${s.title}
언론사: ${s.mediaName}
요약: ${s.snippet || ''}
URL: ${s.uri}`
            )
            .join('\n\n')
        : '관련 기사 참고자료를 찾지 못했습니다.';

    const articleResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `주제: "${topic}" (카테고리: ${safeCategory})
당신은 동아일보의 전문 기자입니다. 아래 제공된 참고 기사들을 바탕으로 심층 기사를 작성하세요.

[참고 기사]
${sourcesContext}

[지침]
1. ###, **, *** 같은 마크다운 기호를 사용하지 마세요.
2. 기사 본문은 <p> 태그를 사용해 문단을 나누세요.
3. 소제목은 <h3 style="font-Pretendard; margin-top: 24px; color: #1a3a6b;">제목</h3> 형식을 사용하세요.
4. 문장 끝에는 마침표를 정확히 찍고 가독성 있게 작성하세요.
5. 참고 기사가 존재하면 그 내용을 핵심적으로 반영하세요.
6. 관련 기사가 없을 경우에는 주제 중심으로 사실 기반 설명 기사를 작성하세요.
7. factCheck는 핵심 내용을 3가지 포인트로 요약해 리스트로 반환하세요.`,
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
      },
    });

    const parsed = JSON.parse(extractJson(articleResponse.text));

    return res.status(200).json({
      ...parsed,
      searchSources: refinedSources,
      sources: refinedSources.map((s) => s.title),
    });
  } catch (error) {
    console.error('generate-article error:', error);
    return res.status(500).json({
      ok: false,
      error: 'ARTICLE_GENERATION_FAILED',
    });
  }
}