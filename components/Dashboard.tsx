import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Calendar, FileText, FileCheck, ArrowUpRight, Newspaper, TrendingUp, ShieldCheck, Quote } from 'lucide-react';
import { storage as dbStorage, type Article } from '../services/db';

// 토스트 컴포넌트
const Toast = ({ message }: { message: string }) => (
  <div style={{
    position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
    zIndex: 99999, background: '#1a3a6b', color: '#fff',
    padding: '14px 28px', borderRadius: 14, fontWeight: 700, fontSize: '0.95rem',
    display: 'flex', alignItems: 'center', gap: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    animation: 'toast-in 0.25s ease',
    fontFamily: 'Pretendard, sans-serif',
    whiteSpace: 'nowrap',
  }}>
    🗑️ {message}
    <style>{`@keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
  </div>
);

const Dashboard = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedItem, setSelectedItem] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 삭제된 id 목록 (폴링이 복원 못하게)
  const deletedIds = useRef<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = useCallback(async () => {
    try {
      const savedArticles = await dbStorage.getAll();
      const filtered = savedArticles.filter(a => !deletedIds.current.has(a.id));
      
      setArticles(prev => {
        // ID만 비교하면 기사 내용이나 이미지 업데이트를 감지하지 못함
        // 전체 데이터를 문자열화하여 비교하거나, 주요 필드들을 비교
        const prevData = JSON.stringify(prev.map(a => ({ id: a.id, image: a.image, title: a.title })));
        const newData = JSON.stringify(filtered.map(a => ({ id: a.id, image: a.image, title: a.title })));
        
        if (prevData === newData) return prev;
        return filtered;
      });
    } catch (e) {
      console.error("Dashboard data load failed:", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await dbStorage.migrateFromLocalStorage();
      loadData();
    };
    init();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ✅ 삭제: confirm 없음, deletedIds로 폴링 차단, 토스트 표시
  const deleteArticle = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    deletedIds.current.add(id);

    try {
      await dbStorage.delete(id);
    } catch (e) {
      console.error("Failed to delete from IndexedDB:", e);
    }

    setArticles(prev => prev.filter(a => a.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    showToast("기사가 삭제되었습니다");
  };

  const mainStory = articles.length > 0 ? articles[0] : null;
  const leftColumnStories = articles.length > 1 ? articles.slice(1, 5) : [];
  const bottomArchive = articles.length > 5 ? articles.slice(5) : [];

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh' }}>
      {toast && <Toast message={toast} />}

      <style>{`
        .db-tab-bar {
          background: #fff;
          border-bottom: 1px solid #e8e8e8;
          border-top: 1px solid #f0ebe4;
          padding: 0 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 52px;
        }
        .db-tabs { display: flex; gap: 0; height: 100%; }
        .db-tab-btn {
          height: 100%; padding: 0 24px; font-size: 0.82rem; font-weight: 600;
          color: #888; background: transparent; border: none;
          border-bottom: 3px solid transparent; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 7px; font-family: Pretendard, sans-serif;
        }
        .db-tab-btn:hover { color: #1a3a6b; }
        .db-tab-btn.active { color: #1a3a6b; border-bottom-color: #1a3a6b; font-weight: 700; }
        .db-tab-count {
          background: #f0f4ff; color: #1a3a6b; font-size: 0.68rem;
          font-weight: 700; padding: 2px 7px; border-radius: 20px;
        }
        .db-tab-btn.active .db-tab-count { background: #1a3a6b; color: #fff; }
        .db-clear-btn {
          font-size: 0.75rem; color: #bbb; background: none; border: none;
          cursor: pointer; font-family: Pretendard, sans-serif; transition: color 0.2s;
        }
        .db-clear-btn:hover { color: #1a3a6b; }
        .db-content { padding: 36px 40px 60px; max-width: 1400px; margin: 0 auto; }
        .db-section-title {
          font-size: 0.7rem; font-weight: 800; color: #aaa; letter-spacing: 3px;
          text-transform: uppercase; border-bottom: 1px solid #d8d0c8;
          padding-bottom: 8px; margin-bottom: 20px;
        }
        .db-section-title span { color: #22c55e; margin-right: 6px; }
        .db-hero-card {
          background: #fff; border-radius: 16px; overflow: hidden;
          border: 1px solid #e0d8d0; box-shadow: 0 2px 16px rgba(0,0,0,0.07);
          cursor: pointer; transition: all 0.25s ease;
        }
        .db-hero-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(26,58,107,0.12); border-color: #1a3a6b; }
        .db-side-card {
          background: #fff; border-radius: 12px; border: 1px solid #e0d8d0;
          padding: 16px 18px; cursor: pointer; transition: all 0.2s ease;
          box-shadow: 0 1px 8px rgba(0,0,0,0.05);
        }
        .db-side-card:hover { transform: translateX(4px); border-color: #1a3a6b; box-shadow: 0 4px 16px rgba(26,58,107,0.1); }
        .db-archive-card {
          background: #fff; border-radius: 12px; border: 1px solid #e0d8d0;
          overflow: hidden; cursor: pointer; transition: all 0.2s ease;
          box-shadow: 0 1px 8px rgba(0,0,0,0.05); height: 100%;
          display: flex; flex-direction: column;
        }
        .db-archive-card:hover { transform: translateY(-4px); border-color: #1a3a6b; box-shadow: 0 8px 24px rgba(26,58,107,0.12); }
        .db-cat-badge { font-size: 0.65rem; font-weight: 800; color: #1a3a6b; letter-spacing: 1.5px; text-transform: uppercase; }
        .db-top-badge {
          background: #1a3a6b; color: #fff; font-size: 0.65rem; font-weight: 800;
          padding: 3px 10px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase;
        }
        .db-empty {
          background: #fff; border: 2px dashed #d8d0c8; border-radius: 20px;
          padding: 80px 40px; text-align: center; min-height: 400px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .db-modal-overlay {
          position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px); display: flex; align-items: center;
          justify-content: center; padding: 20px;
        }
        .db-modal {
          background: #fff; border-radius: 20px; overflow: hidden; width: 100%;
          max-width: 860px; max-height: 90vh; display: flex; flex-direction: column;
          box-shadow: 0 30px 80px rgba(0,0,0,0.25); border: 1px solid #e0d8d0;
        }
        .db-modal-header {
          padding: 18px 28px; border-bottom: 1px solid #e8e8e8;
          display: flex; align-items: center; justify-content: space-between; background: #fafaf8;
        }
        .db-modal-body { padding: 40px 48px; overflow-y: auto; flex: 1; }
        .db-modal-footer {
          padding: 16px 28px; border-top: 1px solid #e8e8e8;
          display: flex; justify-content: space-between; align-items: center; background: #fafaf8;
        }
        .db-btn-primary {
          background: #1a3a6b; color: #fff; border: none; padding: 9px 22px;
          border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer;
          font-family: Pretendard, sans-serif; transition: background 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .db-btn-primary:hover { background: #12295a; }
        .db-btn-danger {
          background: #f0f4ff; color: #1a3a6b; border: 1px solid #dce6f5;
          padding: 9px 22px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; font-family: Pretendard, sans-serif; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .db-btn-danger:hover { background: #e0e7ff; }
        .db-btn-ghost {
          background: transparent; color: #666; border: 1px solid #ddd;
          padding: 9px 22px; border-radius: 8px; font-size: 0.82rem; font-weight: 500;
          cursor: pointer; font-family: Pretendard, sans-serif; transition: all 0.2s;
        }
        .db-btn-ghost:hover { background: #f5f5f5; }
        .db-article-body p { margin-bottom: 1.8rem; }
        .db-article-body h3 {
          color: #1a1a2e; font-weight: 800; font-size: 1.4rem; margin: 2.5rem 0 1rem;
          font-family: Pretendard, sans-serif; border-bottom: 1px solid #e8e8e8; padding-bottom: 8px;
        }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .db-live-dot {
          width: 7px; height: 7px; background: #22c55e; border-radius: 50%;
          display: inline-block; animation: pulse-dot 1.5s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>

      {/* ── 탭 바 ── */}
      <div className="db-tab-bar">
        <div className="db-tabs">
          <button className="db-tab-btn active">
            <Newspaper size={15} />
            오늘의 신문
            <span className="db-tab-count">{articles.length}</span>
          </button>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="db-content">
        {articles.length === 0 ? (
          <div className="db-empty">
            <div style={{ background: '#f5f0ea', padding: 20, borderRadius: '50%', marginBottom: 24, color: '#c8b8a0' }}>
              <Newspaper size={44} />
            </div>
            <h4 style={{ color: '#555', fontFamily: "Pretendard", fontWeight: 700, fontSize: '1.3rem', marginBottom: 10 }}>
              발행된 기사가 없습니다
            </h4>
            <p style={{ color: '#aaa', fontSize: '0.88rem', maxWidth: 340, lineHeight: 1.7, margin: 0 }}>
              기사 작성 메뉴에서 첫 면을 장식할 기사를 작성해보세요.<br/>
              특종은 당신을 기다립니다.
            </p>
          </div>
        ) : (
          <div>
            <div className="row g-4">
              {/* 왼쪽 컬럼 */}
              <div className="col-lg-3">
                <div className="db-section-title"><span>●</span> 편집장 추천</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {leftColumnStories.length > 0 ? leftColumnStories.map((article) => (
                    <div key={article.id} className="db-side-card" onClick={() => setSelectedItem(article)}>
                      <div className="db-cat-badge" style={{ marginBottom: 6 }}>{article.category}</div>
                      <h5 style={{ fontFamily: "Pretendard", fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.5, color: '#1a1a2e', margin: '0 0 8px' }}>
                        {article.title}
                      </h5>
                      <p style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.6, margin: 0 }} className="line-clamp-3">
                        {article.summary || article.content.replace(/<[^>]*>/g, '').substring(0, 80)}
                      </p>
                    </div>
                  )) : (
                    <div style={{ textAlign: 'center', color: '#ccc', fontSize: '0.78rem', padding: '40px 0', fontStyle: 'italic' }}>
                      더 많은 기사를 작성하면<br/>이곳에 채워집니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 가운데 히어로 */}
              <div className="col-lg-6">
                <div className="db-section-title"><span>●</span> 주요 기사</div>
                {mainStory && (
                  <div className="db-hero-card" onClick={() => setSelectedItem(mainStory)}>
                    <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
                      {mainStory.image ? (
                        <img src={mainStory.image} alt="main" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: '#f0ebe4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d8c8b8' }}>
                          <FileText size={60} />
                        </div>
                      )}
                      <div style={{ position: 'absolute', top: 16, left: 16 }}>
                        <span className="db-top-badge">주요 기사</span>
                      </div>
                    </div>
                    <div style={{ padding: '24px 28px 20px' }}>
                      <h2 style={{ fontFamily: "Pretendard", fontWeight: 900, fontSize: '1.7rem', lineHeight: 1.35, color: '#1a1a2e', marginBottom: 14, letterSpacing: '-0.5px' }}>
                        {mainStory.title}
                      </h2>
                      <p style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.75, marginBottom: 20 }} className="line-clamp-3">
                        {mainStory.summary || mainStory.content.replace(/<[^>]*>/g, '').substring(0, 200)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ede8e2', paddingTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.72rem', color: '#aaa', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {mainStory.date}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#22c55e' }}><FileCheck size={12} /> 검증 완료</span>
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#1a3a6b', fontWeight: 700 }}>
                          자세히 보기 <ArrowUpRight size={13} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 오른쪽 브리프 */}
              <div className="col-lg-3">
                <div className="db-section-title"><span>●</span> 뉴스룸 정보</div>
                <div style={{ background: '#f0f4ff', border: '1px solid #dce6f5', borderRadius: 12, padding: '16px 18px' }}>
                  <TrendingUp size={18} style={{ color: '#1a3a6b', marginBottom: 8 }} />
                  <h6 style={{ color: '#1a3a6b', fontWeight: 800, fontSize: '0.75rem', marginBottom: 6 }}>뉴스룸 Press</h6>
                  <p style={{ color: '#7a8fa8', fontSize: '0.72rem', lineHeight: 1.6, margin: 0 }}>
                    모든 기사는 최첨단 엔진을 통해 팩트 검증이 이루어집니다.
                  </p>
                </div>
              </div>
            </div>

            {/* ── 아카이브 ── */}
            {bottomArchive.length > 0 && (
              <div style={{ marginTop: 56 }}>
                <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}>
                  <div style={{ height: 1, background: '#d8d0c8', position: 'absolute', top: '50%', left: 0, right: 0 }} />
                  <span style={{ position: 'relative', background: '#f4f1ec', padding: '0 20px', fontSize: '0.72rem', fontWeight: 800, color: '#aaa', letterSpacing: 4, textTransform: 'uppercase' }}>
                    뉴스 아카이브
                  </span>
                </div>
                <div className="row g-3">
                  {bottomArchive.map(article => (
                    <div key={article.id} className="col-md-6 col-xl-3">
                      <div className="db-archive-card" onClick={() => setSelectedItem(article)}>
                        <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: '#f0ebe4' }}>
                          {article.image ? (
                            <img src={article.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d8c8b8' }}>
                              <FileText size={24} />
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <div className="db-cat-badge" style={{ marginBottom: 6 }}>{article.category}</div>
                          <h6 className="line-clamp-2" style={{ fontFamily: "Pretendard", fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.5, color: '#1a1a2e', margin: '0 0 auto', paddingBottom: 12 }}>
                            {article.title}
                          </h6>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0ebe4', paddingTop: 10 }}>
                            <span style={{ fontSize: '0.65rem', color: '#bbb', fontWeight: 600 }}>{article.date?.split(' ')[0]}</span>
                            <button
                              onClick={(e) => deleteArticle(article.id, e)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, transition: 'color 0.2s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#1a3a6b')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 기사 상세 모달 ── */}
      {selectedItem && (
        <div className="db-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="db-modal" onClick={(e) => e.stopPropagation()}>
            <div className="db-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: '#1a3a6b', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {selectedItem.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Newspaper size={14} /> 기사 상세보기
                </span>
              </div>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
            </div>

            <div className="db-modal-body">
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.72rem', color: '#aaa', fontWeight: 600, marginBottom: 28, borderBottom: '1px solid #ede8e2', paddingBottom: 18 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={13} style={{ color: '#1a3a6b' }} /> {selectedItem.date}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e', fontWeight: 700 }}>
                    <FileCheck size={13} /> 검증 완료
                  </span>
                </div>
                <h1 style={{ fontFamily: "Pretendard", fontWeight: 900, fontSize: '2rem', lineHeight: 1.35, color: '#1a1a2e', marginBottom: 28, letterSpacing: '-0.5px' }}>
                  {selectedItem.title}
                </h1>
                {selectedItem.image && (
                  <div style={{ marginBottom: 32, borderRadius: 14, overflow: 'hidden', border: '1px solid #ede8e2' }}>
                    <img src={selectedItem.image} style={{ width: '100%', display: 'block' }} />
                  </div>
                )}
                <div className="db-article-body" style={{ fontSize: '1.05rem', lineHeight: 2, color: '#333', fontFamily: "Pretendard", marginBottom: 40 }}
                  dangerouslySetInnerHTML={{ __html: selectedItem.content }}
                />
                <div style={{ padding: '32px', background: '#f8fafc', borderRadius: '24px', borderLeft: '4px solid #1a3a6b', marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <Quote size={18} style={{ color: '#1a3a6b' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1a3a6b', letterSpacing: 2, textTransform: 'uppercase' }}>기사 요약</span>
                  </div>
                  <p style={{ fontSize: '1.15rem', fontWeight: 700, lineHeight: 1.6, color: '#334155', margin: '0 0 24px 0', fontStyle: 'italic' }}>
                    "{selectedItem.summary || '요약 정보가 없습니다.'}"
                  </p>
                  <div style={{ paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ShieldCheck size={16} style={{ color: '#22c55e' }} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                        팩트체크: <span style={{ color: '#22c55e' }}>{selectedItem.factCheck || 'AI 검증 완료'}</span>
                      </span>
                    </div>
                    {(selectedItem.searchSources && selectedItem.searchSources.length > 0) && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8 }}>참고 자료 및 출처</span>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                          {selectedItem.searchSources.slice(0, 2).map((source, idx) => {
                            const url = source.uri;
                            const title = source.title;
                            if (!url || typeof url !== 'string') return null;
                            return (
                              <li key={idx} style={{ fontSize: '0.72rem', color: '#000', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 }}>
                                {url.startsWith('http') ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{title || url}</a>
                                ) : (title || url)}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="db-modal-footer">
              <button className="db-btn-danger" onClick={() => deleteArticle(selectedItem.id)}>
                <Trash2 size={15} /> 기사 파기
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="db-btn-ghost" onClick={() => setSelectedItem(null)}>닫기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
