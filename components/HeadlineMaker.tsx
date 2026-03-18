
import React, { useState, useRef, useEffect } from 'react';
import { storage as dbStorage, type SavedHeadline } from '../services/db';
import { Camera, MessageCircle, Heart, ThumbsUp, Angry, Trash2, Sparkles } from 'lucide-react';

const HeadlineMaker: React.FC = () => {
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{ id: number | 'all', action: () => void } | null>(null);
  const [savedHeadlines, setSavedHeadlines] = useState<SavedHeadline[]>([]);
  const [commentInputs, setCommentInputs] = useState<{ [key: number]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await dbStorage.getAllHeadlines();
      setSavedHeadlines(data);
    };
    loadData();
  }, []);

  const loadHeadlines = async () => {
    const data = await dbStorage.getAllHeadlines();
    setSavedHeadlines(data);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setUploadedImage(reader.result as string);
      reader.readAsDataURL(file);
      showToast("이미지가 업로드되었습니다");
    }
  };

  const publishHeadline = async () => {
    if (!name.trim() || !headline.trim()) {
      showToast("이름과 내용을 입력해주세요");
      return;
    }

    const newEntry: SavedHeadline = {
      id: Date.now(),
      name,
      headline,
      image: uploadedImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80',
      reactions: { like: 0, heart: 0, angry: 0, sad: 0 },
      comments: [],
      date: new Date().toLocaleString()
    };

    await dbStorage.saveHeadline(newEntry);
    await loadHeadlines();
    
    // Reset
    setName('');
    setHeadline('');
    setUploadedImage(null);
    showToast("속보가 발행되었습니다");
  };

  const handleReaction = async (id: number, type: keyof SavedHeadline['reactions']) => {
    const target = savedHeadlines.find(h => h.id === id);
    if (!target) return;

    const updated: SavedHeadline = {
      ...target,
      reactions: { ...target.reactions, [type]: target.reactions[type] + 1 }
    };

    await dbStorage.saveHeadline(updated);
    await loadHeadlines();
  };

  const deleteHeadline = async (id: number) => {
    await dbStorage.deleteHeadline(id);
    await loadHeadlines();
    showToast("속보가 삭제되었습니다");
  };

  const clearAllHeadlines = async () => {
    await dbStorage.clearHeadlines();
    await loadHeadlines();
    showToast("전체 삭제되었습니다");
  };

  const addComment = async (id: number) => {
    const text = commentInputs[id];
    if (!text?.trim()) return;

    const target = savedHeadlines.find(h => h.id === id);
    if (!target) return;

    const updated: SavedHeadline = {
      ...target,
      comments: [...target.comments, { id: Date.now(), user: "방구석 네티즌", text, date: "방금 전" }]
    };

    await dbStorage.saveHeadline(updated);
    await loadHeadlines();
    setCommentInputs({ ...commentInputs, [id]: '' });
    showToast("댓글이 등록되었습니다");
  };

  return (
    <div className="text-slate-900 pb-5 animate-fade-in">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-fade-in">
          {toast}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <h4 className="font-black text-xl mb-4">정말 삭제하시겠습니까?</h4>
            <p className="text-slate-500 mb-6">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button className="flex-1 py-3 bg-slate-100 rounded-xl font-bold" onClick={() => setShowConfirm(null)}>취소</button>
              <button className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold" onClick={() => { showConfirm.action(); setShowConfirm(null); }}>삭제</button>
            </div>
          </div>
        </div>
      )}

      <div className="row g-5">
        <div className="col-lg-5">
          <div className="bg-white p-4 sticky-top border border-slate-200 shadow-sm rounded-[32px]" style={{ top: '20px' }}>
            <h3 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Sparkles className="text-blue-600" /> 속보 합성 스튜디오
            </h3>
            
            <div className="mb-3">
              <label className="text-slate-500 text-xs font-bold mb-1 block uppercase">주인공</label>
              <input type="text" placeholder="이름" className="form-control bg-slate-50 border-slate-200 text-slate-900 focus:bg-white" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="mb-3">
              <label className="text-slate-500 text-xs font-bold mb-1 block uppercase">속보 헤드라인</label>
              <input type="text" placeholder="속보 제목" className="form-control bg-slate-50 border-slate-200 text-slate-900 focus:bg-white" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className="text-slate-500 text-xs font-bold mb-1 block uppercase">배경 사진 업로드</label>
              <button onClick={() => { fileInputRef.current?.click(); }} className="btn btn-outline-slate-200 w-100 py-3 border-dashed border-2 text-slate-500 hover:bg-slate-50">
                <Camera size={20} className="me-2"/> 사진 선택하기
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
            </div>

            <div className="preview-container mb-4">
              <div className="position-relative rounded-3 overflow-hidden" style={{ height: '200px', background: '#000' }}>
                <img src={uploadedImage || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=800&q=80'} className="w-100 h-100 object-cover opacity-60" />
                <div className="position-absolute bottom-0 start-0 w-100 p-3" style={{ background: 'linear-gradient(to right, #1a3a6b 0%, #2a4a7b 100%)' }}>
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-white text-blue-600 fw-black px-1 py-1">속보</span>
                        <span className="text-white fw-bold truncate">{name ? `${name} 씨, ` : ''}{headline || '내용을 입력하세요'}</span>
                    </div>
                </div>
              </div>
            </div>

            <button className="btn btn-primary w-100 py-3 fw-bold shadow-md" onClick={publishHeadline}>속보 발행</button>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="fw-bold m-0 text-slate-900">📡 시청자 발행 타임라인</h3>
            {savedHeadlines.length > 0 && (
              <button onClick={() => setShowConfirm({ id: 'all', action: () => clearAllHeadlines() })} className="btn btn-outline-slate-200 btn-sm rounded-xl px-3 border-0 hover:text-blue-500 font-bold">
                전체 삭제
              </button>
            )}
          </div>
          
          <div className="d-flex flex-column gap-5">
            {savedHeadlines.length === 0 ? (
              <div className="bg-white p-10 rounded-4 text-center border border-slate-200 shadow-sm opacity-60">
                <Sparkles size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="fw-bold text-slate-400">아직 발행된 나만의 속보가 없습니다.</p>
              </div>
            ) : (
              savedHeadlines.map(h => (
                <div key={h.id} className="bg-white rounded-4 overflow-hidden border border-slate-200 shadow-sm group">
                  <div className="position-relative" style={{ height: '300px' }}>
                    <img src={h.image} className="w-100 h-100 object-cover" />
                    <div className="position-absolute top-4 right-4 z-10">
                      <button 
                        onClick={() => setShowConfirm({ id: h.id, action: () => deleteHeadline(h.id) })} 
                        className="w-10 h-10 bg-black/50 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all border-0 shadow-xl opacity-0 group-hover:opacity-100"
                        title="속보 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="position-absolute bottom-0 start-0 w-100 p-4" style={{ background: 'linear-gradient(to top, rgba(127,0,0,1) 0%, rgba(204,0,0,0.8) 40%, rgba(204,0,0,0) 100%)' }}>
                        <h2 className="text-white fw-bold m-0 fs-3">{h.name} 씨, {h.headline}</h2>
                    </div>
                  </div>

                  <div className="p-3 px-4 d-flex align-items-center justify-content-between bg-slate-50 border-b border-slate-100">
                    <div className="d-flex gap-4">
                      <button onClick={() => { handleReaction(h.id, 'like'); alert("완료되었습니다"); }} className="reaction-btn text-slate-500 hover:text-blue-600 border-0 bg-transparent p-0"><ThumbsUp size={18}/> {h.reactions.like}</button>
                      <button onClick={() => { handleReaction(h.id, 'heart'); alert("완료되었습니다"); }} className="reaction-btn text-slate-500 hover:text-pink-600 border-0 bg-transparent p-0"><Heart size={18}/> {h.reactions.heart}</button>
                      <button onClick={() => { handleReaction(h.id, 'angry'); alert("완료되었습니다"); }} className="reaction-btn text-slate-500 hover:text-blue-600 border-0 bg-transparent p-0"><Angry size={18}/> {h.reactions.angry}</button>
                    </div>
                    <div className="text-slate-400 text-xs font-bold flex items-center gap-1"><MessageCircle size={14}/> 댓글 {h.comments.length}</div>
                  </div>

                  <div className="bg-slate-50/50 p-4">
                    <div className="space-y-2 mb-3">
                      {h.comments.map(c => (
                        <div key={c.id} className="d-flex gap-2 animate-fade-in">
                          <div className="text-blue-600 text-xs font-bold">{c.user}</div>
                          <div className="text-slate-600 text-xs">{c.text}</div>
                        </div>
                      ))}
                    </div>
                    <div className="d-flex gap-2">
                      <input type="text" className="form-control form-control-sm bg-white border-slate-200 text-slate-900" placeholder="시청자 의견 달기..." value={commentInputs[h.id] || ''} onChange={(e) => setCommentInputs({...commentInputs, [h.id]: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && addComment(h.id)} />
                      <button onClick={() => { addComment(h.id); }} className="btn btn-primary btn-sm border-0 px-3 shadow-sm">게시</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <style>{`
        .reaction-btn { background: none; border: none; padding: 0; display: flex; align-items: center; gap: 4px; transition: 0.2s; }
        .hidden { display: none; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </div>
  );
};

export default HeadlineMaker;
