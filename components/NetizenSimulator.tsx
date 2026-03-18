
import React, { useState, useEffect, useRef } from 'react';
import { generateComments } from '../services/gemini';
import { MessageSquare, Send, Loader2, AlertCircle } from 'lucide-react';

interface Reaction {
  user: string;
  comment: string;
  likes: number;
  color?: string;
}

const NetizenSimulator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const getUserColor = (name: string) => {
    const colors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
      '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleGenerate = async () => {
    const targetTopic = topic.trim() || "AI가 기사를 쓰는 미래";
    setIsGenerating(true);
    setReactions([]);

    try {
      const data = await generateComments(targetTopic, false);
      let index = 0;
      const interval = setInterval(() => {
        if (index >= data.length) {
          clearInterval(interval);
          setIsGenerating(false);
          return;
        }
        const newReaction = {
          ...data[index],
          color: getUserColor(data[index].user)
        };
        setReactions(prev => [...prev, newReaction]);
        index++;
      }, 800);
    } catch (error: unknown) {
      console.error(error);
      setIsGenerating(false);
      showToast("분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [reactions]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 text-slate-900">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-fade-in">
          {toast}
        </div>
      )}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold mb-2">댓글 예측 시뮬레이터</h2>
          <p className="text-slate-500">기사 출고 후 예상되는 네티즌들의 반응을 AI가 시뮬레이션합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-6 space-y-4 shadow-sm border border-slate-200">
            <h4 className="font-bold flex items-center gap-2 text-slate-900">
              <MessageSquare size={18} className="text-blue-600" /> 기사 주제 또는 내용
            </h4>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-48 resize-none"
              placeholder="예상 반응을 분석할 기사 내용을 입력하세요..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button 
              onClick={() => { handleGenerate(); showToast("분석을 시작합니다"); }}
              disabled={isGenerating}
              className="w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-md bg-blue-600 text-white disabled:opacity-50 hover:opacity-90"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              {isGenerating ? '여론 분석 중...' : '여론 시뮬레이션 시작'}
            </button>
          </div>

          <div className="bg-white rounded-2xl p-5 border-l-4 border-blue-500 shadow-sm border border-slate-200">
            <h5 className="font-bold text-sm mb-2 flex items-center gap-2 text-slate-900">
              <AlertCircle size={16} className="text-blue-600" /> AI 분석 가이드
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              입력하신 내용을 바탕으로 동아일보 독자 및 일반 네티즌들의 성향을 분석하여 예상 댓글을 생성합니다. 
              부정적 반응이나 논란이 예상되는 부분을 미리 점검해 보세요.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl overflow-hidden flex flex-col h-[600px] border border-slate-200 shadow-sm">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900">실시간 여론 예측 스트리밍</span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">실시간 시뮬레이터</span>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 custom-scrollbar">
              {reactions.length === 0 && !isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                  <MessageSquare size={80} className="opacity-20" />
                  <p className="font-bold fs-5 opacity-40">분석을 시작하면 예상 댓글이 표시됩니다.</p>
                </div>
              ) : (
                reactions.map((msg, idx) => (
                  <div key={idx} className="flex gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div 
                      className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-black text-white text-sm shadow-sm"
                      style={{ backgroundColor: msg.color || '#334155' }}
                    >
                      {msg.user.substring(0, 1)}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{msg.user}</span>
                        <span className="text-[10px] text-slate-400">방금 전</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-5 py-3.5 text-sm text-slate-800 shadow-sm inline-block max-w-[92%] leading-relaxed">
                        {msg.comment}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 px-1">
                        <button className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-600 transition-colors border-0 bg-transparent p-0">
                          <i className="bi bi-hand-thumbs-up-fill"></i> {msg.likes}
                        </button>
                        <button className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-600 transition-colors border-0 bg-transparent p-0">
                          <i className="bi bi-hand-thumbs-down-fill"></i> 0
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <div className="bg-white border border-slate-200 rounded-full px-6 py-2.5 flex items-center justify-between text-slate-500 text-xs font-bold">
                <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin text-blue-600"/> 데이터 취합 중...</span>
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetizenSimulator;
