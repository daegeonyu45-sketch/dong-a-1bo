import { searchReferenceMaterials } from './gemini';

export type SearchSource = {
  title: string;
  uri: string;
  snippet: string;
  mediaName?: string;
};

/**
 * Gemini Google Search grounding을 통해 뉴스를 검색합니다.
 * 백엔드 API 키 이슈를 피하기 위해 프론트엔드에서 직접 호출합니다.
 */
export const fetchRelatedNews = async (query: string): Promise<SearchSource[]> => {
  const trimmedQuery = query?.trim();

  if (!trimmedQuery) {
    console.warn('fetchRelatedNews skipped: empty query');
    return [];
  }

  try {
    const data = await searchReferenceMaterials(trimmedQuery);
    return data.references || [];
  } catch (error) {
    console.error('fetchRelatedNews exception:', error);
    return [];
  }
};
