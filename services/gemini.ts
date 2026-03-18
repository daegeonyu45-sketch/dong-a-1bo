import { GoogleGenAI, Type, Modality } from '@google/genai';

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

const extractJson = (text: string) => {
  if (!text) return '';
  try {
    // Remove markdown code blocks if present
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');

    let startIdx = -1;
    let endIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endIdx = lastBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endIdx = lastBracket;
    }

    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      return cleanText.substring(startIdx, endIdx + 1);
    }
    return cleanText;
  } catch {
    return text;
  }
};

const safeJsonParse = (text: string) => {
  const extracted = extractJson(text);
  if (!extracted) return null;

  try {
    return JSON.parse(extracted);
  } catch (e) {
    // Attempt 1: Remove trailing commas
    try {
      const fixed = extracted.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch {
      // Attempt 2: Handle unescaped newlines in strings
      try {
        const fixed = extracted.replace(/\n/g, '\\n')
                               .replace(/\\n\s*([}\]])/g, '$1') // restore structure
                               .replace(/{\\n/g, '{')
                               .replace(/\[\\n/g, '[')
                               .replace(/,\\n/g, ',');
        return JSON.parse(fixed);
      } catch {
        // If all fails, throw original error
        throw e;
      }
    }
  }
};

export const handleAIError = (error: unknown) => {
  console.error('Gemini API Error Details:', error);
  
  let errorStr = '';
  try {
    errorStr = typeof error === 'string' ? error : (error instanceof Error ? error.message : JSON.stringify(error));
  } catch {
    errorStr = String(error);
  }

  if (
    errorStr.includes('404') ||
    errorStr.includes('NOT_FOUND') ||
    errorStr.includes('no longer available')
  ) {
    throw new Error('MODEL_NOT_FOUND');
  }

  if (
    errorStr.includes('429') ||
    errorStr.includes('RESOURCE_EXHAUSTED') ||
    errorStr.includes('quota')
  ) {
    throw new Error('QUOTA_EXCEEDED');
  }

  if (errorStr.includes('403') || errorStr.includes('PERMISSION_DENIED')) {
    throw new Error('PERMISSION_DENIED');
  }

  if (errorStr.includes('500') || errorStr.includes('INTERNAL')) {
    throw new Error('INTERNAL_SERVER_ERROR');
  }

  throw error;
};

let apiQueue: Promise<void> = Promise.resolve();

const callWithQueue = async <T>(fn: () => Promise<T>): Promise<T> => {
  const currentQueue = apiQueue;

  apiQueue = (async () => {
    try {
      await currentQueue;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 300));
  })();

  await currentQueue;
  return fn();
};

const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callWithQueue(fn);
    } catch (error) {
      lastError = error;
      const errorStr = typeof error === 'string' ? error : JSON.stringify(error);

      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        if (i === maxRetries - 1) throw error;
        await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};

export const createAI = () => {
  const apiKey =
    process.env?.GEMINI_API_KEY ||
    process.env?.API_KEY ||
    import.meta.env?.VITE_API_KEY ||
    import.meta.env?.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey.includes('TODO') || apiKey.includes('YOUR_')) {
    console.error(
      'Gemini API Key is missing or invalid. Please check your environment variables.'
    );
    throw new Error('A valid Gemini API key is required. Please set GEMINI_API_KEY in the application settings.');
  }

  return new GoogleGenAI({ apiKey });
};

// Helper functions moved from server.js
const getHostname = (uri: string) => {
  try {
    return new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const inferMediaNameFromHostname = (uri: string) => {
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

const isLikelyArticleUrl = (uri: string) => {
  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    const search = url.search.toLowerCase();

    if (!path || path === '/' || path === '/main.html' || path === '/index.html') {
      return false;
    }

    const blocked = ['/search', '/category', '/tag', '/topic'];
    if (blocked.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return false;
    }

    if (path.includes('article') || path.includes('read.nhn') || path.includes('view')) {
      return true;
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

const TRUSTED_DOMAINS = [
  'donga.com', 'chosun.com', 'joongang.co.kr', 'joins.com', 'hani.co.kr',
  'khan.co.kr', 'yna.co.kr', 'yonhapnews.co.kr', 'news1.kr', 'newsis.com',
  'ytn.co.kr', 'sbs.co.kr', 'kbs.co.kr', 'mbc.co.kr', 'imbc.com',
  'jtbc.co.kr', 'tvchosun.com', 'mbn.co.kr', 'mk.co.kr', 'hankyung.com',
  'sedaily.com', 'dt.co.kr', 'etnews.com', 'zdnet.co.kr', 'bloter.net',
  'hankookilbo.com', 'ohmynews.com', 'pressian.com', 'newspim.com',
  'edaily.co.kr', 'mt.co.kr', 'heraldcorp.com',
];

const isTrustedMedia = (uri: string) => {
  try {
    const hostname = new URL(uri).hostname.replace(/^www\./, '').toLowerCase();
    return TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

export const generateCoverageSuggestions = async (isMock: boolean = false) => {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      { id: '1', title: '손흥민 프리미어리그 통산 득점 신기록 도전', category: 'Sports', angle: '데이터 분석', urgency: 'High' },
      { id: '2', title: '글로벌 OTT 신작 라인업과 K-콘텐츠 위상', category: 'Entertainment', angle: '산업 리포트', urgency: 'Medium' },
      { id: '3', title: 'K-배터리 전고체 전지 로드맵 발표', category: 'Tech', angle: '시장 점유율 전망', urgency: 'High' },
      { id: '4', title: '프로야구 개막 시즌 관전 포인트', category: 'Sports', angle: '현장 취재', urgency: 'Low' },
    ];
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const currentDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
      });

      let text = response.text?.trim();
      
      // Fallback: If .text is empty, try to extract from parts directly
      if (!text) {
        const parts = response.candidates?.[0]?.content?.parts || [];
        text = parts.map(p => p.text || '').join('').trim();
      }

      if (!text) throw new Error('Empty response from AI');
      return safeJsonParse(text);
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const searchReferenceMaterials = async (query: string, isMock: boolean = false) => {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      summary: `${query}에 대한 AI 분석 결과입니다.`,
      references: [
        { title: '관련 보도 자료 1', uri: 'https://example.com/1', snippet: '상세 내용 요약입니다.' },
        { title: '관련 보도 자료 2', uri: 'https://example.com/2', snippet: '상세 내용 요약입니다.' },
      ],
    };
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `"${query}" 관련 최신 한국 뉴스를 검색해주세요. 동아일보·조선일보·중앙일보·한겨레·연합뉴스·KBS·MBC·SBS·JTBC·매일경제·한국경제 등 주요 언론사 기사를 중심으로 3~4개 찾아서, 각 기사의 제목과 핵심 내용 1~2문장을 한국어로 알려주세요. 반드시 각 뉴스에 대해 [제목], [언론사], [요약], [URL] 형식을 포함해서 답변해주세요.`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      });

      const responseText = response.text ?? '';
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      
      let items = [];

      if (chunks.length > 0) {
        const textLines = responseText.split('\n').map(l => l.trim()).filter(Boolean);
        items = chunks
          .filter(c => c.web?.uri && isLikelyArticleUrl(c.web.uri))
          .map(c => {
            const uri = c.web!.uri!;
            let title = c.web?.title ?? '';
            const hostname = getHostname(uri);
            const mediaName = inferMediaNameFromHostname(uri);

            // 제목이 도메인이거나 너무 짧으면 텍스트 응답에서 찾아보기
            if (!title || title === hostname || title.length < 5) {
              const match = responseText.match(new RegExp(`\\[제목\\]:?\\s*(.*?)(?=\\n|\\[|$)`, 'i'));
              if (match) title = match[1].trim();
            }

            const keywords = title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 1).slice(0, 4);
            const matched = textLines.find(l => keywords.filter(k => l.includes(k)).length >= Math.min(2, keywords.length)) ?? '';
            const snippet = matched.replace(/^[-•*\d.]+\s*/, '').replace(uri, '').trim().slice(0, 200);
            return { uri, title: title || hostname, mediaName, hostname, snippet, image: FALLBACK_NEWS_IMAGE };
          })
          .filter(item => item.uri && item.title);
      }

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

      return {
        summary: `"${query}" 관련 최신 뉴스 검색 결과입니다.`,
        references: items,
      };
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const generateFactBasedArticle = async (
  topic: string,
  category: string,
  isMock: boolean = false,
  context?: string
) => {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      title: `[분석] ${topic}의 핵심 포인트`,
      category,
      summary: 'AI가 분석한 실시간 핵심 요약 기사입니다.',
      content: '<p>이번 사건은 해당 업계에 큰 파장을 일으키고 있습니다.</p><p>전문가들은 이번 변화가 장기적인 트렌드가 될 것으로 내다보고 있습니다.</p>',
      factCheck: ['상위 채널 교차 검증 완료', '업계 전문가 의견 수렴', '데이터 기반 트렌드 분석'],
      sources: ['관련 공식 발표'],
      searchSources: [],
      imageKeyword: topic,
    };
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      
      // 1단계: 내용 수집
      const searchRes = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `주제: "${topic}"
${context ? `[참고 정보/맥락]: ${context}\n` : ''}
위 주제와 관련된 최신 한국 뉴스 보도 내용을 Google 검색을 통해 상세하게 정리해주세요. 특히 제공된 [참고 정보]가 있다면 해당 내용을 중심으로 사실 관계를 확인하고, 동아일보·조선일보·중앙일보·한겨레·연합뉴스·KBS·MBC·SBS·JTBC·매일경제·한국경제 등 주요 언론사 기사를 교차 검증하여 실제 보도된 사실·수치·인물 발언·날짜·기관명을 구체적으로 정리해주세요.`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      });

      let searchContent = searchRes.text?.trim() ?? '';
      
      if (!searchContent) {
        const parts = searchRes.candidates?.[0]?.content?.parts || [];
        searchContent = parts.map(p => p.text || '').join('').trim();
      }
      const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      // 맥락 정보가 있다면 검색 결과가 조금 부족해도 진행
      const minLength = context ? 20 : 50;
      if (searchContent.length < minLength && chunks.length === 0 && !context) {
        throw new Error('최신 정보를 검색하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }

      const contentLines = searchContent.split('\n').map(l => l.trim()).filter(Boolean);
      const sources = chunks
        .filter(c => c.web?.uri && isLikelyArticleUrl(c.web.uri))
        .slice(0, 4)
        .map(c => {
          const uri = c.web!.uri!;
          const title = c.web?.title ?? '';
          const hostname = getHostname(uri);
          const mediaName = inferMediaNameFromHostname(uri);
          const keywords = title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 1).slice(0, 4);
          const matchedLine = contentLines.find(l => keywords.filter(k => l.includes(k)).length >= Math.min(2, keywords.length)) ?? '';
          const snippet = matchedLine.replace(/^[-•*\d.]+\s*/, '').trim().slice(0, 200);
          return { uri, title, mediaName, hostname, snippet, image: FALLBACK_NEWS_IMAGE };
        });

      // 2단계: 기사 작성
      const writeRes = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `당신은 동아일보의 전문 기자입니다.
주제: "${topic}" (카테고리: ${category || 'general'})

아래는 Google 검색으로 수집한 실제 최신 보도 내용입니다. 이 내용에 있는 사실만 사용해서 기사를 작성하세요.

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
      });

      let articleText = writeRes.text?.trim() || '';
      if (!articleText) {
        const parts = writeRes.candidates?.[0]?.content?.parts || [];
        articleText = parts.map(p => p.text || '').join('').trim();
      }

      const parsed = safeJsonParse(articleText);
      return {
        ...parsed,
        searchSources: sources,
        citedIndices: [],
      };
    } catch (error) {
      return handleAIError(error);
    }
  });
};

const buildImageDirection = (prompt: string) => {
  return `
[EDITORIAL IMAGE BRIEF]
Create a premium Korean newsroom hero image for: ${prompt}

OUTPUT FORMAT:
- Generate exactly one still image only.
- Do not generate a video, animation, motion clip, storyboard, contact sheet, or multi-frame sequence.
- Return image data only.

VISUAL STYLE:
- ultra realistic editorial image
- cinematic lighting
- premium brand campaign composition

STRICT RULES:
- No random text, gibberish letters, or unreadable typography.
- No watermarks, signatures, subtitles, or fake UI overlays.
- Keep screens, signs, and backgrounds clean.
`.trim();
};

export const generateImage = async (prompt: string, isMock: boolean = false) => {
  if (isMock) {
    return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=80';
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ text: buildImageDirection(prompt) }],
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: { aspectRatio: '16:9' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        const inline = part.inlineData;
        if (!inline?.data) continue;

        const mimeType = inline.mimeType || 'image/png';
        if (!mimeType.startsWith('image/')) continue;

        return `data:${mimeType};base64,${inline.data}`;
      }

      return 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1600&q=80';
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const generateComments = async (content: string, isMock: boolean = false) => {
  if (isMock) {
    return [{ user: '독자', comment: '이건 정말 중요한 뉴스네요.', likes: 12 }];
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `기사 내용: ${content}\n위 기사에 대한 실시간 댓글 5개를 생성하세요.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                user: { type: Type.STRING },
                comment: { type: Type.STRING },
                likes: { type: Type.NUMBER },
              },
            },
          },
        },
      });

      return safeJsonParse(response.text);
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const generateTrotLyrics = async (newsText: string, isMock: boolean = false) => {
  if (isMock) {
    return `[얼쑤] 오늘의 뉴스~ \n\n${newsText}\n\n좋구나!`;
  }

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `뉴스 내용: ${newsText}\n판소리 명창 스타일로 가사를 작성하세요.`,
        config: { temperature: 0.7 },
      });

      return response.text;
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const speakTrot = async (lyrics: string, isMock: boolean = false) => {
  if (isMock) return null;

  return callWithRetry(async () => {
    try {
      const ai = createAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: lyrics }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      return handleAIError(error);
    }
  });
};

export const decodeAudio = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const sampleRate = 24000;
  const numChannels = 1;
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  return buffer;
};