import { GoogleGenAI, Type, Modality } from '@google/genai';

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
  const errorStr = typeof error === 'string' ? error : JSON.stringify(error);

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
    (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.API_KEY) ||
    import.meta.env?.VITE_API_KEY ||
    import.meta.env?.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      'Gemini API Key is missing. Checked: process.env.GEMINI_API_KEY, process.env.API_KEY, import.meta.env.VITE_API_KEY, import.meta.env.VITE_GEMINI_API_KEY'
    );
    throw new Error('API key must be set when using the Gemini API.');
  }

  return new GoogleGenAI({ apiKey });
};

export const generateCoverageSuggestions = async (isMock: boolean = false) => {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return [
      {
        id: '1',
        title: '손흥민 프리미어리그 통산 득점 신기록 도전',
        category: 'Sports',
        angle: '데이터 분석',
        urgency: 'High',
      },
      {
        id: '2',
        title: '글로벌 OTT 신작 라인업과 K-콘텐츠 위상',
        category: 'Entertainment',
        angle: '산업 리포트',
        urgency: 'Medium',
      },
      {
        id: '3',
        title: 'K-배터리 전고체 전지 로드맵 발표',
        category: 'Tech',
        angle: '시장 점유율 전망',
        urgency: 'High',
      },
      {
        id: '4',
        title: '프로야구 개막 시즌 관전 포인트',
        category: 'Sports',
        angle: '현장 취재',
        urgency: 'Low',
      },
    ];
  }

  try {
    const response = await fetch('/api/suggestions');
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch suggestions');
    }
    return await response.json();
  } catch (error) {
    return handleAIError(error);
  }
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

  try {
    const response = await fetch(`/api/search-news?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to search news');
    }
    const data = await response.json();
    return {
      summary: `"${query}" 관련 최신 뉴스 검색 결과입니다.`,
      references: data.items || [],
    };
  } catch (error) {
    return handleAIError(error);
  }
};

export const generateFactBasedArticle = async (
  topic: string,
  category: string,
  isMock: boolean = false
) => {
  if (isMock) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      title: `[분석] ${topic}의 핵심 포인트`,
      category,
      summary: 'AI가 분석한 실시간 핵심 요약 기사입니다.',
      content:
        '<p>이번 사건은 해당 업계에 큰 파장을 일으키고 있습니다.</p><p>전문가들은 이번 변화가 장기적인 트렌드가 될 것으로 내다보고 있습니다.</p>',
      factCheck: ['상위 채널 교차 검증 완료', '업계 전문가 의견 수렴', '데이터 기반 트렌드 분석'],
      sources: ['관련 공식 발표'],
      searchSources: [],
      imageKeyword: topic,
    };
  }

  try {
    const response = await fetch('/api/write-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, category }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate article');
    }
    return await response.json();
  } catch (error) {
    return handleAIError(error);
  }
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