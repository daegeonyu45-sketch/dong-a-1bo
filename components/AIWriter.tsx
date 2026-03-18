import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateFactBasedArticle, generateImage, generateCoverageSuggestions, searchReferenceMaterials } from '../services/gemini';
import { storage as dbStorage, type Article as DBArticle } from '../services/db';
import { type SearchSource } from '../services/news';
import {
  Sparkles,
  Loader2,
  Cpu,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Trash2,
  Quote,
  X,
  ShieldAlert,
  Image as ImageIcon,
  Copy,
  CheckCircle,
  Newspaper,
  ExternalLink,
  Save,
  Pencil,
  BookCheck,
  Search,
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  factCheck: string[];
  citedIndices: number[];
  searchSources: SearchSource[];
  date: string;
  image?: string | null;
}

interface Suggestion {
  id: string;
  title: string;
  category: string;
  angle: string;
  urgency: string;
}

interface GeneratedArticle {
  title: string;
  category: string;
  summary: string;
  content: string;
  factCheck: string[];
  imageKeyword: string;
  citedIndices?: number[];
  searchSources?: SearchSource[];
}

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

const Toast = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <div
    style={{
      position: 'fixed',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#1a3a6b',
      color: '#fff',
      padding: '14px 28px',
      borderRadius: 14,
      fontWeight: 700,
      fontSize: '0.95rem',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    }}
  >
    <CheckCircle size={20} color="#22c55e" />
    {message}
    <button
      onClick={onClose}
      style={{
        background: 'none',
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        marginLeft: 8,
        opacity: 0.6,
      }}
    >
      <X size={16} />
    </button>
  </div>
);

const getSafeHostname = (url?: string) => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const normalizeMediaName = (mediaName?: string, hostname?: string) => {
  const raw = (mediaName || '').trim();
  const host = (hostname || '').toLowerCase();

  if (raw) {
    if (raw.includes('동아')) return '동아일보';
    if (raw.includes('연합뉴스')) return '연합뉴스';
    if (raw.includes('조선')) return '조선일보';
    if (raw.includes('중앙')) return '중앙일보';
    if (raw.includes('한겨레')) return '한겨레';
    if (raw.includes('경향')) return '경향신문';
    if (raw.includes('SBS')) return 'SBS';
    if (raw.includes('KBS')) return 'KBS';
    if (raw.includes('MBC')) return 'MBC';
    return raw;
  }

  if (host.includes('donga.com')) return '동아일보';
  if (host.includes('yna.co.kr')) return '연합뉴스';
  if (host.includes('chosun.com')) return '조선일보';
  if (host.includes('joongang.co.kr')) return '중앙일보';
  if (host.includes('hani.co.kr')) return '한겨레';
  if (host.includes('khan.co.kr')) return '경향신문';
  if (host.includes('sbs.co.kr')) return 'SBS';
  if (host.includes('kbs.co.kr')) return 'KBS';
  if (host.includes('mbc.co.kr')) return 'MBC';

  return '주요 언론';
};

const normalizeSearchSources = (sources?: SearchSource[], topic?: string) => {
  if (!Array.isArray(sources)) return [];

  const seen = new Set<string>();

  return sources
    .filter((item) => item && item.uri && item.title)
    .filter((item) => {
      if (seen.has(item.uri)) return false;
      seen.add(item.uri);
      return true;
    })
    .slice(0, 6)
    .map((item, idx) => {
      const hostname = item.hostname || getSafeHostname(item.uri);
      const fallback = `https://picsum.photos/seed/${encodeURIComponent(topic || 'news')}-${idx}/800/450`;

      return {
        ...item,
        hostname,
        image: item.image && item.image !== FALLBACK_NEWS_IMAGE ? item.image : fallback,
        mediaName: normalizeMediaName(item.mediaName, hostname),
        snippet: item.snippet || '',
      };
    });
};

const AIWriter: React.FC = () => {
  const [topic, setTopic] = useState(() => localStorage.getItem('donga_writer_topic') || '');
  const [category, setCategory] = useState(() => localStorage.getItem('donga_writer_category') || 'social');
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => {
    const saved = localStorage.getItem('donga_writer_suggestions');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [articleData, setArticleData] = useState<Article | null>(() => {
    const saved = localStorage.getItem('donga_writer_article');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [imageResult, setImageResult] = useState<string | null>(() => localStorage.getItem('donga_writer_image'));
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 실시간 검색 상태 (topic과 완전 분리)
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('donga_writer_search_query') || '');
  const [searchResults, setSearchResults] = useState<SearchSource[]>(() => {
    const saved = localStorage.getItem('donga_writer_search_results');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // 실시간 검색 핸들러 (topic과 독립)
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setErrorMsg('');
    try {
      const data = await searchReferenceMaterials(q.trim(), false);
      setSearchResults(Array.isArray(data?.references) ? data.references : []);
    } catch (e: unknown) {
      console.error('Search error:', e);
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
        setErrorMsg('API 할당량이 소진되어 검색 결과를 불러올 수 없습니다.');
      } else {
        setErrorMsg('검색 중 오류가 발생했습니다. API 키 설정을 확인해주세요.');
      }
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  // 검색 결과 클릭 → 기사 생성기 topic에만 반영
  const handleSearchItemClick = (item: SearchSource) => {
    setTopic(item.title);
    window.scrollTo({ top: 600, behavior: 'smooth' });
  };

  const handleSearchItemGenerate = (item: SearchSource) => {
    setTopic(item.title);
    setTimeout(() => handleCreate(), 100);
  };

  useEffect(() => {
    localStorage.setItem('donga_writer_topic', topic);
  }, [topic]);

  useEffect(() => {
    localStorage.setItem('donga_writer_category', category);
  }, [category]);

  useEffect(() => {
    localStorage.setItem('donga_writer_search_query', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem('donga_writer_search_results', JSON.stringify(searchResults));
  }, [searchResults]);

  useEffect(() => {
    localStorage.setItem('donga_writer_suggestions', JSON.stringify(suggestions));
  }, [suggestions]);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setErrorMsg('');
    try {
      const data = await generateCoverageSuggestions(false);
      setSuggestions(data || []);
    } catch (e: unknown) {
      console.error('Fetch suggestions error:', e);
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
        setErrorMsg('API 할당량이 소진되어 실시간 이슈를 불러올 수 없습니다.');
      } else {
        setErrorMsg('실시간 이슈를 불러오는 중 오류가 발생했습니다. API 키 설정을 확인해주세요.');
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const cleanContent = (text: string) => {
    if (!text) return '';
    let cleaned = text.replace(/[#*`_~]{1,}/g, '').trim();
    if (!cleaned.includes('<p>')) {
      cleaned = cleaned
        .split('\n\n')
        .map((p) => `<p style="margin-bottom: 1.5rem; line-height: 1.8;">${p.trim()}</p>`)
        .join('');
    }
    return cleaned;
  };

  const handleSuggestionClick = (item: Suggestion) => {
    setTopic(item.title);
    setCategory(item.category.toLowerCase());
    setArticleData(null);
    setImageResult(null);
    setErrorMsg('');
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  // 대시보드에 저장 (신규 추가 또는 업데이트)
  const saveToDashboard = async (article: Article, image?: string | null) => {
    try {
      const toSave: DBArticle = {
        ...article,
        image: image !== undefined ? image : article.image,
        factCheck: Array.isArray(article.factCheck) ? article.factCheck.join(', ') : article.factCheck,
      };
      await dbStorage.save(toSave);
      console.log(`[dashboard] saved "${article.title?.slice(0, 20)}" to IndexedDB`);
    } catch (e) {
      console.error('saveToDashboard failed:', e);
    }
  };

  const handleCreate = async () => {
    if (!topic.trim()) {
      alert('주제를 입력하세요.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      setStatusText('최신 기사 검색 중...');
      const result = (await generateFactBasedArticle(topic, category, false)) as GeneratedArticle;

      const articleId = `art_${Date.now()}`;
      const cleaned = cleanContent(result.content);
      const normalizedSources = normalizeSearchSources(result.searchSources || [], topic);

      const newArticle: Article = {
        id: articleId,
        title: result.title,
        summary: result.summary,
        content: cleaned,
        category: result.category,
        factCheck: Array.isArray(result.factCheck) ? result.factCheck : [],
        citedIndices: [],
        searchSources: normalizedSources,
        date: new Date().toLocaleString(),
      };

      setArticleData(newArticle);
      localStorage.setItem('donga_writer_article', JSON.stringify(newArticle));
      await saveToDashboard(newArticle, null); // 이미지 없이 먼저 저장

      setStatusText('현장감 있는 보도 이미지 생성 중...');
      const img = await generateImage(
        `${result.imageKeyword || topic}. [STRICT: NO TEXT, NO LETTERS, NO NUMBERS, NO TYPOGRAPHY, NO LOGO, NO WATERMARK]`,
        false
      );
      
      const articleWithImage = { ...newArticle, image: img };
      setArticleData(articleWithImage);
      localStorage.setItem('donga_writer_article', JSON.stringify(articleWithImage));
      setImageResult(img);
      localStorage.setItem('donga_writer_image', img || '');
      await saveToDashboard(articleWithImage, img); // 이미지 포함해서 업데이트
      showToast('기사가 대시보드에 저장되었습니다 ✓');
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
        setErrorMsg('API 할당량이 소진되었습니다.');
      } else {
        setErrorMsg('기사 생성 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleCopy = () => {
    if (!articleData) return;
    const plain = articleData.content.replace(/<[^>]*>/g, '\n\n');
    navigator.clipboard.writeText(`${articleData.title}\n\n${plain}`).then(() => {
      showToast('기사가 복사되었습니다');
    });
  };

  // 대시보드 저장 버튼 (수동)
  const handleSaveToDashboard = async () => {
    if (!articleData) return;
    try {
      await saveToDashboard(articleData, imageResult);
      showToast('대시보드에 저장되었습니다 ✓');
    } catch (e) {
      console.error('Save to dashboard failed:', e);
      showToast('저장 중 오류가 발생했습니다');
    }
  };

  // 수정 모드 시작
  const handleEditStart = () => {
    if (!articleData) return;
    setEditTitle(articleData.title);
    // content에서 HTML 태그를 유지하되 편집 가능하게
    setEditContent(articleData.content);
    setIsEditing(true);
  };

  // 수정 내용 저장
  const handleEditSave = async () => {
    if (!articleData) return;
    const updated: Article = {
      ...articleData,
      title: editTitle.trim() || articleData.title,
      content: editContent,
    };
    setArticleData(updated);
    localStorage.setItem('donga_writer_article', JSON.stringify(updated));
    await saveToDashboard(updated, imageResult); // 대시보드도 동기화
    setIsEditing(false);
    showToast('수정사항이 저장되었습니다');
  };

  const handleReset = () => {
    setTopic('');
    setArticleData(null);
    setImageResult(null);
    localStorage.removeItem('donga_writer_article');
    localStorage.removeItem('donga_writer_image');
  };

  return (
    <div className="bg-[#f4f1ec] min-h-screen font-sans">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {isZoomed && imageResult && (
        <div
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-5"
          onClick={() => setIsZoomed(false)}
        >
          <img
            src={imageResult}
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
            alt="Zoomed"
          />
          <button
            className="absolute top-6 right-6 bg-white/10 rounded-full w-11 h-11 text-white flex items-center justify-center"
            onClick={() => setIsZoomed(false)}
          >
            <X size={22} />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── 상단 검색창 + 실시간 결과 ── */}
        <div className="mb-6">
          {/* 검색 입력 */}
          <div className="relative flex items-center mb-4">
            <div className="absolute left-4 text-gray-400 pointer-events-none">
              {searchLoading
                ? <Loader2 size={18} className="animate-spin text-blue-400" />
                : <Search size={18} />}
            </div>
            <input
              className="w-full pl-11 pr-10 py-3.5 bg-[#111] border-2 border-gray-800 rounded-2xl text-base font-sans text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 shadow-sm transition-all"
              placeholder="뉴스를 검색하세요... (예: 반도체 수출, 금리 인상)"
              value={searchQuery}
              onChange={handleSearchQueryChange}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); }
              }}
            />
            {searchQuery && (
              <button
                className="absolute right-4 text-gray-300 hover:text-gray-500 transition-colors"
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* 검색 결과 카드 (인라인) */}
          {searchLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-28 animate-pulse" />
              ))}
            </div>
          )}

          {!searchLoading && searchResults.length > 0 && (
            <>
              <div className="text-xs font-extrabold text-gray-400 tracking-[3px] uppercase border-b border-gray-200 pb-2 mb-3">
                <span className="text-blue-500 mr-1.5">●</span>
                실시간 검색 결과 — {searchResults.length}건
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {searchResults.map((item, i) => {
                  const isValid = (() => { try { const u = new URL(item.uri); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } })();
                  return (
                    <div
                      key={`sr-${i}`}
                      className="group bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-[#1a3a6b] hover:-translate-y-1 hover:shadow-lg transition-all duration-200 cursor-pointer"
                      onClick={() => handleSearchItemClick(item)}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-[#1a3a6b] bg-[#eef4ff] px-2 py-0.5 rounded-full">
                            {item.mediaName || item.hostname || '언론사'}
                          </span>
                          {isValid && (
                            <a
                              href={item.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-gray-300 hover:text-[#1a3a6b] transition-colors"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug group-hover:text-[#1a3a6b] mb-1.5">
                          {item.title}
                        </p>
                        {item.snippet && (
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {item.snippet}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSearchItemGenerate(item); }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-white bg-[#1a3a6b] hover:bg-[#0f2448] py-1.5 rounded-lg transition-colors"
                      >
                        <Cpu size={11} /> 이 기사로 작성
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <RefreshCw size={16} className={`text-blue-800 ${loadingSuggestions ? 'animate-spin' : ''}`} />
              </div>
              <span className="font-extrabold text-lg text-gray-800">실시간 이슈 브리핑</span>
            </div>

            <button
              onClick={handleReset}
              className="text-gray-400 hover:text-green-500 text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 size={13} /> 초기화
            </button>
          </div>

          <div className="text-xs font-extrabold text-gray-400 tracking-[3px] uppercase border-b border-gray-300 pb-2 mb-4">
            <span className="text-green-500 mr-1.5">●</span> 속보 이슈
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {loadingSuggestions ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/50 border border-gray-100 rounded-xl p-4 h-32 animate-pulse" />
              ))
            ) : errorMsg && suggestions.length === 0 ? (
              <div className="col-span-full py-8 px-4 text-center bg-orange-50 rounded-xl border border-orange-200">
                <AlertCircle size={24} className="mx-auto mb-2 text-orange-500" />
                <p className="text-orange-700 font-bold text-sm mb-1">{errorMsg}</p>
                <p className="text-orange-600/70 text-xs">Vercel 환경 변수(GEMINI_API_KEY) 설정을 확인하고 재배포해주세요.</p>
              </div>
            ) : Array.isArray(suggestions) && suggestions.length > 0 ? (
              suggestions.map((item) => {
                const urgencyClasses: Record<string, string> = {
                  HIGH: 'bg-orange-100 text-orange-600',
                  MEDIUM: 'bg-yellow-100 text-yellow-700',
                  LOW: 'bg-blue-100 text-blue-800',
                };

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer h-full flex flex-col justify-between transition-all duration-200 ease-in-out shadow-md hover:border-blue-800 hover:-translate-y-1 hover:shadow-xl"
                    onClick={() => handleSuggestionClick(item)}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2.5">
                        <span
                          className={`text-[0.62rem] font-extrabold tracking-wider uppercase px-2 py-1 rounded ${urgencyClasses[item.urgency] || 'bg-gray-100 text-gray-600'}`}
                        >
                          {item.urgency}
                        </span>
                        <span className="text-[0.65rem] font-bold text-blue-800 tracking-wider uppercase">
                          {item.category}
                        </span>
                      </div>
                      <h6 className="font-bold text-sm leading-snug text-gray-800 line-clamp-2">
                        {item.title}
                      </h6>
                    </div>

                    <div className="flex justify-between items-center mt-3.5 text-xs text-gray-400 italic">
                      <span className="truncate pr-2">"{item.angle}"</span>
                      <ArrowRight size={13} className="flex-shrink-0 text-blue-800" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-xs">추천 아이템을 불러올 수 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-lg mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Sparkles size={18} className="text-blue-800" />
            </div>
            <span className="font-extrabold text-xl text-gray-800">기사 생성기</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2">
              <select
                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-sans text-gray-800 bg-gray-50 appearance-none cursor-pointer focus:outline-none focus:border-blue-800"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="social">사회</option>
                <option value="politics">정치</option>
                <option value="economy">경제</option>
                <option value="tech">IT/과학</option>
                <option value="entertainment">연예</option>
                <option value="sports">스포츠</option>
              </select>
            </div>

            <div className="md:col-span-8">
              <input
                className="w-full p-3 border border-gray-300 rounded-lg text-base font-sans text-gray-900 bg-gray-50 focus:outline-none focus:border-blue-800 focus:ring-2 focus:ring-blue-800/20 placeholder-gray-400"
                placeholder="기사 주제를 입력하세요..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="md:col-span-2">
              <button
                className="w-full py-3 px-5 bg-blue-900 text-white border-none rounded-lg text-sm font-bold font-sans cursor-pointer flex items-center justify-center gap-2 transition-colors hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Cpu size={17} />}
                생성
              </button>
            </div>
          </div>

          {(loading || errorMsg) && (
            <div
              className={`rounded-xl p-7 text-center mt-5 ${
                errorMsg ? 'bg-orange-50 border border-orange-200' : 'bg-blue-50 border border-blue-200'
              }`}
            >
              {errorMsg ? (
                <AlertCircle size={36} className="mx-auto mb-3 text-orange-500" />
              ) : (
                <Loader2 size={36} className="mx-auto mb-3 text-blue-800 animate-spin" />
              )}

              <p className={`font-bold ${errorMsg ? 'text-orange-600' : 'text-blue-800'} m-0 text-base`}>
                {errorMsg || statusText}
              </p>
            </div>
          )}
        </div>

        {articleData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-9">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-10 shadow-lg">
                {articleData && (
                  <>
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                      <div>
                        <span className="text-xs font-extrabold text-blue-500 tracking-widest uppercase">
                          {articleData.category}
                        </span>
                        <span className="mx-2.5 text-gray-300">|</span>
                        <span className="text-xs text-gray-400 font-medium">{articleData.date}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 복사 */}
                        <button
                          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer text-gray-600 transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold hover:border-blue-800 hover:text-blue-800 hover:bg-blue-50"
                          onClick={handleCopy}
                        >
                          <Copy size={13} /> 복사
                        </button>

                        {/* 수정 */}
                        {!isEditing ? (
                          <button
                            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer text-gray-600 transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold hover:border-amber-500 hover:text-amber-600 hover:bg-amber-50"
                            onClick={handleEditStart}
                          >
                            <Pencil size={13} /> 수정
                          </button>
                        ) : (
                          <button
                            className="bg-amber-500 border border-amber-500 rounded-lg px-3 py-2 cursor-pointer text-white transition-all duration-200 flex items-center gap-1.5 text-xs font-bold hover:bg-amber-600"
                            onClick={handleEditSave}
                          >
                            <Save size={13} /> 저장
                          </button>
                        )}

                        {/* 대시보드 저장 */}
                        <button
                          className="bg-[#1a3a6b] border border-[#1a3a6b] rounded-lg px-3 py-2 cursor-pointer text-white transition-all duration-200 flex items-center gap-1.5 text-xs font-bold hover:bg-[#0f2448]"
                          onClick={handleSaveToDashboard}
                        >
                          <BookCheck size={13} /> 대시보드 저장
                        </button>
                      </div>
                    </div>

                    {/* 제목 */}
                    {isEditing ? (
                      <input
                        className="w-full font-black text-3xl sm:text-4xl leading-tight text-gray-800 mb-7 border-b-2 border-amber-400 bg-amber-50 px-2 py-1 rounded-t-lg outline-none focus:bg-amber-100 transition-colors"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                      />
                    ) : (
                      <h1 className="font-black text-3xl sm:text-4xl leading-tight text-gray-800 mb-7">
                        {articleData.title}
                      </h1>
                    )}

                    {/* 본문 */}
                    {isEditing ? (
                      <div className="mb-6">
                        <p className="text-xs text-amber-600 font-semibold mb-2 flex items-center gap-1">
                          <Pencil size={11} /> HTML 태그 포함 편집 모드
                        </p>
                        <textarea
                          className="w-full min-h-[400px] text-sm text-gray-700 leading-relaxed border border-amber-300 bg-amber-50 rounded-xl p-4 outline-none focus:border-amber-500 focus:bg-white transition-colors resize-y font-mono"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div
                        className="prose prose-lg max-w-none text-gray-800 mb-6 article-content"
                        dangerouslySetInnerHTML={{ __html: articleData.content }}
                      />
                    )}

                    <style>{`
                      .article-content p {
                        margin-bottom: 1.5rem;
                        line-height: 1.8;
                        color: #374151;
                        font-size: 1.1rem;
                      }
                      .article-content h3 {
                        font-family: 'Pretendard', sans-serif;
                        margin-top: 2.5rem;
                        margin-bottom: 1rem;
                        color: #1a3a6b;
                        font-weight: 800;
                        font-size: 1.5rem;
                        border-left: 4px solid #1a3a6b;
                        padding-left: 1rem;
                      }
                    `}</style>

                    <div className="mt-10 p-6 bg-blue-50 border-l-4 border-blue-800 rounded-r-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Quote size={18} className="text-blue-800" />
                        <span className="text-sm font-black text-blue-800 tracking-[2px] uppercase">
                          기사 요약
                        </span>
                      </div>
                      <p className="text-lg leading-relaxed text-gray-700 m-0 font-medium">
                        {articleData.summary}
                      </p>
                    </div>

                    {/* ── 출처 및 참고 기사 ── */}
                    {articleData.searchSources && articleData.searchSources.length > 0 && (() => {
                      const cited = articleData.searchSources.map((source) => ({ source }));
                      if (cited.length === 0) return null;

                      return (
                        <div className="mt-8">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                              <Newspaper size={18} className="text-blue-700" />
                            </div>
                            <div>
                              <h3 className="text-gray-900 font-black text-lg">참고 출처</h3>
                              <p className="text-sm text-gray-500">
                                이 기사는 아래 {cited.length}개의 보도 자료를 바탕으로 작성되었습니다.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cited.map(({ source }, i) => {
                              // URI가 실제 유효한 언론사 URL인지 확인
                              const isValidUrl = (() => {
                                try {
                                  const url = new URL(source.uri);
                                  return url.protocol === 'https:' || url.protocol === 'http:';
                                } catch { return false; }
                              })();

                              const cardContent = (
                                <>
                                  {/* 텍스트 */}
                                  <div className="flex-1 flex flex-col p-4">
                                    {/* 언론사 */}
                                    <span className="inline-flex items-center self-start text-[11px] font-bold text-[#1a3a6b] bg-[#eef4ff] px-2.5 py-1 rounded-full mb-2">
                                      {source.mediaName || source.hostname || '언론사'}
                                    </span>

                                    {/* 제목 */}
                                    <p className="text-sm font-bold text-gray-900 line-clamp-2 group-hover:text-[#1a3a6b] transition-colors leading-snug mb-2">
                                      {source.title}
                                    </p>

                                    {/* Snippet */}
                                    {source.snippet && (
                                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed flex-1">
                                        {source.snippet}
                                      </p>
                                    )}

                                    {/* 원문 링크 or 링크 없음 안내 */}
                                    <div className={`flex items-center gap-1 mt-3 pt-3 border-t border-gray-50 text-[12px] font-bold transition-all ${isValidUrl ? 'text-[#1a3a6b] group-hover:gap-2' : 'text-gray-300 cursor-default'}`}>
                                      <ExternalLink size={12} />
                                      {isValidUrl ? '원문 보기' : '링크 준비 중'}
                                    </div>
                                  </div>
                                </>
                              );

                              return isValidUrl ? (
                                <a
                                  key={`cited-${i}-${source.uri}`}
                                  href={source.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all duration-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1"
                                >
                                  {cardContent}
                                </a>
                              ) : (
                                <div
                                  key={`cited-${i}-${source.title}`}
                                  className="flex flex-col rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm opacity-75"
                                >
                                  {cardContent}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div
                className="bg-gray-100 border border-gray-200 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 aspect-video hover:shadow-2xl mb-4"
                onClick={() => articleData && setIsZoomed(true)}
              >
                {imageResult ? (
                  <img src={imageResult} className="w-full h-full object-cover" alt="Article visual" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                    {loading ? (
                      <Loader2 size={36} className="animate-spin text-blue-200" />
                    ) : (
                      <ImageIcon size={36} className="text-gray-200" />
                    )}
                  </div>
                )}
              </div>

              {articleData ? (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-md border-l-4 border-green-500">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={14} className="text-green-600" />
                    <span className="text-xs font-extrabold text-green-600 tracking-[2px] uppercase">
                      팩트체크
                    </span>
                  </div>

                  <ul className="space-y-3 text-sm text-gray-700 leading-relaxed">
                    {Array.isArray(articleData.factCheck) ? (
                      articleData.factCheck.map((fact, idx) => (
                        <li key={idx} className="flex gap-3 p-2 rounded-lg hover:bg-green-50/50 transition-colors">
                          <CheckCircle size={14} className="text-green-600 mt-[3px] flex-shrink-0" />
                          <span className="font-medium">{fact}</span>
                        </li>
                      ))
                    ) : (
                      <li className="flex gap-3 p-2 rounded-lg">
                        <CheckCircle size={14} className="text-green-600 mt-[3px] flex-shrink-0" />
                        <span className="font-medium">{String(articleData.factCheck)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-md border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert size={14} className="text-blue-600" />
                    <span className="text-xs font-extrabold text-blue-600 tracking-[2px] uppercase">
                      취재 가이드
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    관련 보도 자료를 바탕으로 기사를 생성할 수 있습니다. '생성' 버튼을 눌러 AI 기자의 심층 분석을 확인하세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIWriter;