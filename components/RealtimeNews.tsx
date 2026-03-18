import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, ChevronRight, MessageCircle, Heart, Newspaper, Send, ShieldCheck, Award, X, Copy } from 'lucide-react';
import { storage as dbStorage } from '../services/db';

interface Comment {
  id: string;
  user: string;
  text: string;
  date: string;
}

interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  image: string | null;
  date: string;
  factCheck: string;
  sources?: string[];
  searchSources?: { uri: string; title: string }[];
  likes?: number;
  comments?: Comment[];
  summary?: string;
  imageKeyword?: string;
}

const getAutoImage = (article: Article) => {
  if (article.image) return article.image;
  const keyword = encodeURIComponent(article.imageKeyword || article.category || 'news');
  return `https://picsum.photos/seed/${keyword}/800/500`;
};

const RealtimeNews: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const deletedIds = useRef<Set<string>>(new Set());

  const fetchArticles = useCallback(async () => {
    try {
      const fresh = await dbStorage.getAll();
      const filtered = fresh.filter(a => !deletedIds.current.has(a.id));
      setArticles(prev => {
        const prevIds = prev.map(a => a.id).join(',');
        const newIds = filtered.map(a => a.id).join(',');
        if (prevIds === newIds) return prev;
        return filtered.map((a: Article) => ({ ...a, likes: a.likes || 0, comments: a.comments || [] }));
      });
    } catch (e) {
      console.error("Failed to fetch articles from IndexedDB:", e);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
    const interval = setInterval(fetchArticles, 3000);
    return () => clearInterval(interval);
  }, [fetchArticles]);

  const updateArticleInStorage = async (updatedArticle: Article) => {
    try {
      await dbStorage.save(updatedArticle);
      const fresh = await dbStorage.getAll();
      setArticles(fresh.map((a: Article) => ({ ...a, likes: a.likes || 0, comments: a.comments || [] })));
      if (selectedArticle?.id === updatedArticle.id) setSelectedArticle(updatedArticle);
    } catch (e) { console.error("Storage update failed", e); }
  };

  const handleLike = (e: React.MouseEvent, article: Article) => {
    e.stopPropagation();
    updateArticleInStorage({ ...article, likes: (article.likes || 0) + 1 });
  };

  const handleCopy = () => {
    if (!selectedArticle) return;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = selectedArticle.content;
    const plainText = tempDiv.innerText || tempDiv.textContent || "";
    navigator.clipboard.writeText(`${selectedArticle.title}\n\n${plainText}`).catch(err => console.error('복사 실패:', err));
  };

  const handleAddComment = () => {
    if (!selectedArticle || !commentInput.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      user: `익명_${Math.floor(Math.random() * 9000) + 1000}`,
      text: commentInput,
      date: "방금 전"
    };
    updateArticleInStorage({ ...selectedArticle, comments: [newComment, ...(selectedArticle.comments || [])] });
    setCommentInput("");
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-10">
      <div className="d-flex align-items-center justify-content-between mb-8 pb-4 border-b border-slate-200">
        <div>
          <h2 className="fw-black mb-1 flex items-center gap-3 text-3xl text-slate-900">
            <div className="bg-blue-600 px-3 py-1 rounded text-white text-[10px] font-black animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.3)] uppercase tracking-widest">LIVE</div>
            📡 실시간 보도 파이프라인
          </h2>
          <p className="text-slate-500 text-sm m-0">AI 편집국에서 전송된 최신 속보를 실시간으로 브리핑합니다.</p>
        </div>

      </div>

      <div className="row g-4">
        {articles.length === 0 ? (
          <div className="col-12">
            <div className="bg-white p-20 rounded-[40px] text-center border border-slate-200 border-dashed flex flex-col items-center justify-center min-h-[500px] shadow-sm">
              <Newspaper size={100} className="mb-6 text-slate-200" />
              <h3 className="text-slate-400 fw-black text-2xl mb-3">현재 대기 중인 속보가 없습니다</h3>
              <p className="text-slate-400 max-w-sm">기자실에서 기사를 작성하고 저장하면 이곳에 실시간으로 뉴스가 도착합니다.</p>
            </div>
          </div>
        ) : (
          <div className="col-12">
            <div className="d-flex flex-column gap-6">
              {articles.map((article, idx) => (
                <div
                  key={article.id}
                  className={`newspaper-feed-item group cursor-pointer transition-all ${idx === 0 ? 'top-story' : ''}`}
                  onClick={() => setSelectedArticle(article)}
                >
                  <div className={`row g-0 rounded-[32px] overflow-hidden border transition-all duration-500 shadow-sm hover:shadow-md ${idx === 0 ? 'bg-white border-blue-600/30 ring-1 ring-blue-600/10' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                    <div className="col-md-5 position-relative overflow-hidden" style={{ minHeight: idx === 0 ? '400px' : '240px' }}>
                      <img
                        src={getAutoImage(article)}
                        alt="news"
                        referrerPolicy="no-referrer"
                        className="w-100 h-100 object-cover group-hover:scale-110 transition-transform duration-1000"
                        style={{ minHeight: idx === 0 ? '400px' : '240px', width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${article.id}/800/500`; }}
                      />
                      {idx === 0 && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6 md:hidden">
                          <span className="badge bg-blue-600 px-3 py-2 text-[10px] font-black tracking-widest uppercase">지금 속보</span>
                        </div>
                      )}
                    </div>
                    <div className="col-md-7 p-6 md:p-8 flex flex-col">
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-blue-600 text-[10px] font-black uppercase tracking-[2px]">{article.category}</span>
                          {idx === 0 && <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black animate-pulse">속보</span>}
                        </div>
                        <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1 uppercase"><Clock size={12} /> {article.date}</span>
                      </div>
                      <h3 className={`text-slate-900 fw-black mb-4 tracking-tighter group-hover:text-blue-600 transition-colors leading-tight ${idx === 0 ? 'text-3xl md:text-4xl' : 'text-2xl'}`}>{article.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-6 flex-grow">
                        {article.summary || article.content.replace(/<[^>]*>/g, '').substring(0, 200)}
                      </p>
                      <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <button onClick={(e) => handleLike(e, article)} className="flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors border-0 bg-transparent p-0">
                            <Heart size={14} className={article.likes && article.likes > 0 ? "fill-blue-600 text-blue-600" : ""} />
                            <span className="text-[11px] font-black">{article.likes || 0}</span>
                          </button>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <MessageCircle size={14} />
                            <span className="text-[11px] font-black">{article.comments?.length || 0}</span>
                          </div>
                        </div>
                        <span className="text-slate-900 text-[11px] font-black flex items-center gap-2 group-hover:translate-x-1 transition-transform uppercase">전체 기사 보기 <ChevronRight size={14} className="text-blue-600" /></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 기사 상세 모달 */}
      {selectedArticle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-fade-in" onClick={() => setSelectedArticle(null)}>
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[40px] overflow-hidden border border-slate-200 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative h-64 md:h-[450px] flex-shrink-0">
              <img
                src={getAutoImage(selectedArticle)}
                alt="Full"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${selectedArticle.id}/1200/600`; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
              <button className="absolute top-8 right-8 w-12 h-12 bg-white/80 hover:bg-blue-600 hover:text-white rounded-full flex items-center justify-center transition-all shadow-xl border-0" onClick={() => setSelectedArticle(null)}>
                <X size={24} />
              </button>
              <div className="absolute bottom-10 left-10 right-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-blue-600 px-4 py-1.5 text-[10px] font-black shadow-lg rounded tracking-widest uppercase text-white">{selectedArticle.category}</span>
                  <span className="bg-white/80 backdrop-blur-md px-3 py-1.5 rounded text-[10px] font-bold text-slate-600 flex items-center gap-2 border border-slate-200"><Clock size={12} /> {selectedArticle.date}</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 leading-[1.1] tracking-tighter">{selectedArticle.title}</h1>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
              <div className="p-8 md:p-16">
                <div className="max-w-3xl mx-auto">
                  <div className="mb-12 p-6 rounded-3xl bg-slate-50 border-l-4 border-blue-600 shadow-sm">
                    <h6 className="text-blue-600 font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2"><Award size={14} /> 요약 및 팩트체크</h6>
                    <p className="text-slate-800 text-lg font-bold leading-relaxed m-0 italic">"{selectedArticle.summary || '본 기사의 핵심 내용을 요약 중입니다.'}"</p>
                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase">
                      <ShieldCheck size={14} className="text-green-600" /> 검증 상태: <span className="text-green-600">{selectedArticle.factCheck || 'AI 검증 완료'}</span>
                    </div>
                  </div>

                  <div
                    className="article-rich-text text-slate-700 text-xl leading-[2.1] space-y-8"
                    style={{ fontFamily: "'Pretendard', sans-serif" }}
                    dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                  />

                  {/* 참고 자료 및 출처 섹션 */}
                  {(selectedArticle.searchSources && selectedArticle.searchSources.length > 0) && (
                    <div className="mt-16 pt-10 border-t border-slate-100">
                      <h4 className="text-slate-900 font-black text-lg mb-6 flex items-center gap-2">
                        <Newspaper size={20} className="text-blue-600" /> 참고 자료 및 관련 보도
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {selectedArticle.searchSources.slice(0, 4).map((source, idx) => {
                          const url = source.uri;
                          const title = source.title;
                          if (!url || typeof url !== 'string') return null;
                          return (
                            <a 
                              key={idx} 
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-600/30 hover:bg-blue-50 transition-all group"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                  <Clock size={14} className="text-slate-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-700 truncate">{title || url}</span>
                              </div>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-20 pt-16 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-10">
                      <h3 className="text-slate-900 fw-black text-2xl m-0 flex items-center gap-3">시청자 반응 <span className="text-slate-400 text-lg">{selectedArticle.comments?.length || 0}</span></h3>
                      <div className="flex items-center gap-4">
                        <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 border border-blue-500/30 text-white hover:bg-blue-500 transition-all">
                          <Copy size={18} /> 기사 복사
                        </button>
                        <button onClick={(e) => handleLike(e, selectedArticle)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-blue-600 transition-all">
                          <Heart size={18} className={selectedArticle.likes && selectedArticle.likes > 0 ? "fill-blue-600 text-blue-600" : ""} /> {selectedArticle.likes || 0}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[28px] border border-slate-100 mb-10 shadow-inner">
                      <div className="d-flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center flex-shrink-0 text-white font-black shadow-lg">나</div>
                        <div className="flex-grow-1 position-relative">
                          <textarea
                            className="form-control !bg-white border-slate-200 text-slate-900 rounded-2xl p-4 h-28 focus:ring-2 focus:ring-blue-600/30 transition-all resize-none shadow-sm"
                            placeholder="기사에 대한 생각을 자유롭게 남겨주세요..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                          />
                          <button
                            onClick={handleAddComment}
                            className="btn btn-primary position-absolute bottom-4 end-4 rounded-xl py-2 px-5 font-black flex items-center gap-2 shadow-lg border-0"
                            disabled={!commentInput.trim()}
                          >
                            <Send size={16} /> 댓글 등록
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {selectedArticle.comments && selectedArticle.comments.length > 0 ? (
                        selectedArticle.comments.map((comment) => (
                          <div key={comment.id} className="comment-bubble d-flex gap-4 animate-fade-in">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">익명</div>
                            <div className="flex-grow-1">
                              <div className="d-flex items-center gap-3 mb-2">
                                <span className="text-slate-900 font-bold text-sm">익명 시청자</span>
                                <span className="text-slate-400 text-[10px] font-bold uppercase">{comment.date}</span>
                              </div>
                              <div className="text-slate-600 text-base leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                {comment.text}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 opacity-40">
                          <p className="m-0 font-black tracking-widest uppercase text-xs text-slate-400">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터: 기사 파기 제거, 닫기만 */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end items-center">
              <button className="btn btn-primary px-12 py-3 font-black rounded-2xl shadow-lg border-0" onClick={() => setSelectedArticle(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .article-rich-text p { margin-bottom: 2rem; }
        .article-rich-text h3 { color: #1a3a6b; font-weight: 900; font-size: 1.8rem; margin-top: 3.5rem; margin-bottom: 1.5rem; letter-spacing: -0.5px; }
        .article-rich-text b { color: #1a3a6b; font-weight: 800; }
        .top-story { margin-bottom: 2rem; }
        .newspaper-feed-item:hover { transform: scale(1.005); }
        .newspaper-feed-item { transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default RealtimeNews;
