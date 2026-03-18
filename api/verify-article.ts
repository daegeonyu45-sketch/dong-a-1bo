import type { VercelRequest, VercelResponse } from '@vercel/node';

const isRedirectedToHomepage = (originalUrl: string, finalUrl: string) => {
  try {
    const original = new URL(originalUrl);
    const final = new URL(finalUrl);

    if (original.hostname !== final.hostname) return false;

    const finalPath = final.pathname.toLowerCase();

    return (
      finalPath === '/' ||
      finalPath === '' ||
      finalPath === '/index.html' ||
      finalPath === '/main.html' ||
      finalPath === '/home'
    );
  } catch {
    return false;
  }
};

const isDeletedOrBlockedArticle = (htmlText: string) => {
  const text = (htmlText || '').toLowerCase();

  const blockedPatterns = [
    '404 not found',
    'page not found',
    '페이지를 찾을 수 없습니다',
    '요청하신 페이지를 찾을 수 없습니다',
    '삭제된 기사',
    '존재하지 않는 기사',
    '로그인이 필요합니다',
    '구독 후 이용',
    '유료회원',
    'access denied',
    'forbidden',
    'bad request',
    'error occurred',
    '서비스 점검',
  ];

  return blockedPatterns.some((token) => text.includes(token));
};

const extractReadableTextLength = (htmlText: string) => {
  if (!htmlText) return 0;

  const stripped = htmlText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.length;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { uri } = req.body || {};

    if (!uri || typeof uri !== 'string') {
      return res.status(400).json({ ok: false, error: 'uri is required' });
    }

    const response = await fetch(uri, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: `http_${response.status}`,
      });
    }

    const finalUrl = response.url || uri;

    if (isRedirectedToHomepage(uri, finalUrl)) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: 'redirected_to_homepage',
        finalUrl,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: 'not_html',
        finalUrl,
      });
    }

    const text = await response.text();

    if (!text || text.length < 200) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: 'too_short_html',
        finalUrl,
      });
    }

    if (isDeletedOrBlockedArticle(text)) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: 'deleted_or_blocked',
        finalUrl,
      });
    }

    const readableLength = extractReadableTextLength(text);
    if (readableLength < 300) {
      return res.status(200).json({
        ok: true,
        valid: false,
        reason: 'not_enough_content',
        finalUrl,
      });
    }

    return res.status(200).json({
      ok: true,
      valid: true,
      finalUrl,
      readableLength,
    });
  } catch (error) {
    console.error('verify-article error:', error);
    return res.status(200).json({
      ok: true,
      valid: false,
      reason: 'fetch_failed',
    });
  }
}