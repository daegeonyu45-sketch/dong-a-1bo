import React, { useState, useEffect, useRef } from 'react';
import { Type } from "@google/genai";
import { Send, UserX, ShieldCheck, Terminal, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { createAI } from '../services/gemini';
import { storage as dbStorage, type Article } from '../services/db';

interface Message {
  role: 'user' | 'model';
  text: string;
  isSystem?: boolean;
}

const SupabaseAdminChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "안녕하세요. Supabase 및 뉴스룸 대시보드 통합 관리자 AI입니다. 사용자 삭제나 대시보드 기사 관리를 도와드릴까요?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // ★ scrollRef를 메시지 목록의 맨 끝 더미 div에 붙여서 항상 최신 메시지로 스크롤
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  /* ── 내부 함수 (원본 그대로) ── */
  const delete_user_by_email = async (args: { email: string }) => {
    console.log(`Deleting user: ${args.email}`);
    return { success: true, message: `Supabase 인증 서버에서 사용자 ${args.email}가 성공적으로 제거되었습니다.` };
  };

  const list_dashboard_articles = async () => {
    try {
      const saved = await dbStorage.getAll();
      if (saved.length === 0) return { success: true, articles: [], message: "현재 대시보드에 저장된 기사가 없습니다." };
      const articleList = saved.map((a: Article) => ({ id: a.id, title: a.title, date: a.date }));
      return { success: true, articles: articleList };
    } catch (e: unknown) {
      console.error(e);
      return { success: false, message: "기사 목록을 불러오는 중 오류가 발생했습니다." };
    }
  };

  const delete_dashboard_article = async (args: { title: string }) => {
    try {
      const saved = await dbStorage.getAll();
      const toDelete = saved.filter((a: Article) => a.title.toLowerCase().includes(args.title.toLowerCase()));
      
      if (toDelete.length === 0) {
        return { success: false, message: `제목에 "${args.title}"이(가) 포함된 기사를 대시보드에서 찾을 수 없습니다.` };
      }

      for (const article of toDelete) {
        await dbStorage.delete(article.id);
      }
      
      return { success: true, message: `제목에 "${args.title}"이(가) 포함된 기사 ${toDelete.length}건이 대시보드에서 영구 삭제되었습니다.` };
    } catch (e: unknown) {
      console.error(e);
      return { success: false, message: "기사 삭제 처리 중 오류가 발생했습니다." };
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const ai = createAI();
      const contents = [
        ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: `당신은 Supabase 데이터베이스 및 동아 AI 뉴스룸 대시보드를 관리하는 관리자(Admin) AI입니다.

[보유 권한 및 도구]
1. delete_user_by_email: 사용자의 이메일을 기반으로 인증 서버에서 삭제합니다.
2. list_dashboard_articles: 현재 대시보드에 저장된 모든 기사의 제목과 정보를 확인합니다.
3. delete_dashboard_article: 대시보드에서 특정 제목을 가진 기사를 영구 삭제합니다.

[중요 규칙 - 반드시 지킬 것]
1. 삭제(사용자 또는 기사) 요청이 들어오면, 즉시 도구를 실행하지 마십시오.
2. 반드시 삭제 대상(이메일 또는 기사 제목)을 정확히 언급하며 "정말로 삭제하시겠습니까? 이 작업은 복구할 수 없습니다."라고 명시적으로 확인을 받으십시오.
3. 사용자가 "예", "동의", "진행해" 등 확실한 긍정 답변을 했을 때만 삭제 도구를 실행하십시오.
4. 모든 작업은 자동으로 설정된 시스템 권한을 통해 수행됩니다.`,
          tools: [{
            functionDeclarations: [
              {
                name: 'delete_user_by_email',
                description: '사용자의 이메일을 기반으로 Supabase에서 사용자를 삭제합니다.',
                parameters: {
                  type: Type.OBJECT,
                  properties: { email: { type: Type.STRING, description: '삭제할 사용자의 이메일 주소' } },
                  required: ['email']
                }
              },
              {
                name: 'list_dashboard_articles',
                description: '현재 대시보드에 저장된 모든 기사 목록을 조회합니다.',
                parameters: { type: Type.OBJECT, properties: {} }
              },
              {
                name: 'delete_dashboard_article',
                description: '대시보드(localStorage)에서 특정 제목을 포함하는 기사를 삭제합니다.',
                parameters: {
                  type: Type.OBJECT,
                  properties: { title: { type: Type.STRING, description: '삭제할 기사의 제목 또는 키워드' } },
                  required: ['title']
                }
              }
            ]
          }]
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses = [];
        for (const fc of response.functionCalls) {
          let result;
          if (fc.name === 'delete_user_by_email') result = await delete_user_by_email(fc.args as { email: string });
          else if (fc.name === 'list_dashboard_articles') result = await list_dashboard_articles();
          else if (fc.name === 'delete_dashboard_article') result = await delete_dashboard_article(fc.args as { title: string });
          if (result) functionResponses.push({ name: fc.name, id: fc.id, response: result });
        }

        if (functionResponses.length > 0) {
          const modelTurn = response.candidates[0].content;
          const toolResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
              ...contents,
              modelTurn,
              { role: 'user', parts: functionResponses.map(fr => ({ functionResponse: fr })) }
            ]
          });
          setMessages(prev => [...prev, { role: 'model', text: toolResponse.text || "요청하신 작업을 완료했습니다." }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'model', text: response.text || "죄송합니다. 명령을 처리하는 중 문제가 발생했습니다." }]);
      }
    } catch (error: unknown) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }]);
    } finally {
      setLoading(false);
    }
  };

  const quickCmds = [
    { icon: <FileText size={13} />, label: '기사 목록 조회', cmd: '기사 목록 보여줘' },
    { icon: <Trash2 size={13} />, label: '기사 전체 삭제', cmd: '기사 전체 삭제해줘' },
    { icon: <UserX size={13} />, label: '사용자 삭제 예시', cmd: 'user@example.com 사용자를 삭제해줘' },
  ];

  return (
    <div style={{ background: '#f4f1ec', minHeight: '100vh' }}>
      <style>{`
      

        .adm-section-title {
          font-size: 0.7rem; font-weight: 800; color: #aaa;
          letter-spacing: 3px; text-transform: uppercase;
          border-bottom: 1px solid #d8d0c8;
          padding-bottom: 8px; margin-bottom: 20px;
        }
        .adm-section-title span { color: #e8192c; margin-right: 6px; }

        /* ── 채팅 전체 래퍼: flex column + 고정 높이 ── */
        .adm-chat-wrap {
          background: #fff;
          border: 1px solid #e0d8d0;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 2px 18px rgba(0,0,0,0.07);

          /* ★ 핵심: 부모가 flex column이어야 내부 flex:1 이 동작 */
          display: flex;
          flex-direction: column;
          height: 580px;      /* 전체 채팅 박스 고정 높이 */
        }

        /* 채팅 헤더 – 고정 높이 */
        .adm-chat-header {
          background: #1a3a6b;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;   /* ★ 줄어들지 않게 */
        }

        /* ★ 메시지 영역: flex:1 + overflow-y:auto 로 남은 공간 채우고 스크롤 */
        .adm-messages {
          flex: 1;
          overflow-y: auto;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;    /* ★ flex 자식에서 overflow 작동하려면 필수 */
        }
        .adm-messages::-webkit-scrollbar { width: 4px; }
        .adm-messages::-webkit-scrollbar-track { background: #f4f1ec; }
        .adm-messages::-webkit-scrollbar-thumb { background: #d8d0c8; border-radius: 4px; }

        /* 입력 영역 – 고정 높이 */
        .adm-input-area {
          border-top: 1px solid #ede8e2;
          padding: 14px 20px;
          display: flex;
          gap: 10px;
          align-items: center;
          background: #fff;
          flex-shrink: 0;   /* ★ 줄어들지 않게 */
        }

        /* 말풍선 */
        .adm-bubble-ai {
          background: #fff;
          border: 1px solid #dce6f5;
          border-radius: 4px 14px 14px 14px;
          padding: 13px 17px;
          max-width: 82%;
          box-shadow: 0 1px 6px rgba(26,58,107,0.06);
        }
        .adm-bubble-user {
          background: #1a3a6b;
          border-radius: 14px 4px 14px 14px;
          padding: 13px 17px;
          max-width: 82%;
        }

        /* 입력 */
        .adm-input {
          flex: 1;
          padding: 11px 18px;
          border: 1px solid #d8d0c8;
          border-radius: 24px;
          font-size: 0.88rem;
          font-family: 'Pretendard', sans-serif;
          color: #333;
          background: #fafaf8;
          transition: border-color 0.2s;
          outline: none;
        }
        .adm-input:focus { border-color: #1a3a6b; }
        .adm-input::placeholder { color: #bbb; }

        .adm-send-btn {
          width: 42px; height: 42px;
          border-radius: 50%;
          background: #1a3a6b;
          border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .adm-send-btn:hover { background: #12295a; }
        .adm-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* 사이드 카드 */
        .adm-side-card {
          background: #fff;
          border: 1px solid #e0d8d0;
          border-radius: 14px;
          padding: 20px 22px;
          box-shadow: 0 1px 8px rgba(0,0,0,0.05);
          margin-bottom: 14px;
        }

        .adm-quick-btn {
          width: 100%; text-align: left;
          padding: 10px 14px; border-radius: 9px;
          background: #fafaf8; border: 1px solid #e0d8d0;
          font-size: 0.8rem; font-weight: 500; color: #444;
          cursor: pointer; font-family: 'Pretendard', sans-serif;
          display: flex; align-items: center; gap: 9px;
          transition: all 0.18s; margin-bottom: 8px;
        }
        .adm-quick-btn:last-child { margin-bottom: 0; }
        .adm-quick-btn:hover { background: #f0f4ff; border-color: #1a3a6b; color: #1a3a6b; }

        @keyframes bounce-dot {
          from { transform: translateY(0); opacity: 0.4; }
          to   { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>

      <div style={{ padding: '32px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>

        {/* 페이지 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, background: '#fff0f0', border: '1px solid #fdd', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#22c55e" />
            </div>
            <div>
              <h4 style={{ fontFamily: "Pretendard", fontWeight: 900, fontSize: '1.15rem', color: '#1a1a2e', margin: 0 }}>
                통합 관리자 콘트롤 타워
              </h4>
              <p style={{ fontSize: '0.72rem', color: '#aaa', margin: 0 }}>
                Supabase 및 뉴스룸 대시보드 관리자
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#f0f4ff', border: '1px solid #dce6f5', borderRadius: 20, padding: '6px 14px' }}>
            <Terminal size={12} color="#1a3a6b" />
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1a3a6b', letterSpacing: 1.2 }}>권한: 전체 액세스</span>
          </div>
        </div>

        <div className="row g-4">

          {/* ── 메인 채팅 ── */}
          <div className="col-lg-8">
            <div className="adm-section-title">
              <span style={{ color: '#22c55e' }}>●</span> 통합 관리 콘솔
            </div>

            <div className="adm-chat-wrap">

              {/* 헤더 */}
              <div className="adm-chat-header">
                <div style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.14)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Terminal size={19} color="#fff" />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', fontFamily: "Pretendard" }}>
                    통합 관리자 콘솔
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                    Supabase 및 뉴스룸 대시보드 관리자
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: 20 }}>
                  <div style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', animation: 'bounce-dot 1.4s infinite alternate' }} />
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: 1 }}>실시간</span>
                </div>
              </div>

              {/* ★ 메시지 스크롤 영역 */}
              <div className="adm-messages">
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '0.62rem', color: '#bbb', fontWeight: 600, marginBottom: 4 }}>
                      {m.role === 'user' ? '관리자' : '🤖 시스템'}
                    </span>
                    <div className={m.role === 'model' ? 'adm-bubble-ai' : 'adm-bubble-user'}>
                      <p style={{
                        margin: 0,
                        fontSize: '0.88rem',
                        lineHeight: 1.75,
                        whiteSpace: 'pre-line',
                        color: m.role === 'model' ? '#1a1a2e' : '#fff',
                        fontFamily: "Pretendard"
                      }}>
                        {m.text}
                      </p>
                    </div>
                  </div>
                ))}

                {/* 로딩 타이핑 애니메이션 */}
                {loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.62rem', color: '#bbb', fontWeight: 600, marginBottom: 4 }}>🤖 시스템</span>
                    <div className="adm-bubble-ai">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {[0, 0.18, 0.36].map((d, idx) => (
                          <div key={idx} style={{ width: 7, height: 7, background: '#1a3a6b', borderRadius: '50%', animation: `bounce-dot 0.7s ${d}s infinite alternate` }} />
                        ))}
                        <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: 6 }}>데이터베이스 쿼리 중...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ★ 항상 맨 아래로 스크롤되는 앵커 */}
                <div ref={bottomRef} />
              </div>

              {/* 입력 */}
              <div className="adm-input-area">
                <input
                  className="adm-input"
                  type="text"
                  placeholder="명령어 입력 (예: 기사 목록 보여줘, [제목] 기사 삭제해줘)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button className="adm-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
                  <Send size={17} color="#fff" />
                </button>
              </div>

            </div>
          </div>

          {/* ── 사이드 패널 ── */}
          <div className="col-lg-4">
            <div className="adm-section-title">
              <span style={{ color: '#22c55e' }}>●</span> 빠른 명령어
            </div>

            <div className="adm-side-card">
              <p style={{ fontSize: '0.78rem', color: '#aaa', marginBottom: 14, lineHeight: 1.6 }}>
                클릭하면 입력창에 자동으로 채워집니다.
              </p>
              {quickCmds.map((qc, i) => (
                <button key={i} className="adm-quick-btn" onClick={() => setInput(qc.cmd)}>
                  <span style={{ color: '#1a3a6b' }}>{qc.icon}</span>
                  {qc.label}
                </button>
              ))}
            </div>

            {/* 경고 */}
            <div className="adm-side-card" style={{ borderLeft: '3px solid #e8192c', background: '#fff8f8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AlertCircle size={15} color="#e8192c" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#e8192c', letterSpacing: 1.5 }}>주의사항</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.7, margin: 0 }}>
                삭제 명령은 <strong style={{ color: '#e8192c' }}>복구가 불가능</strong>합니다.<br />
                실행 전 반드시 대상을 확인하세요.<br />
                AI가 확인 절차를 거친 후 실행합니다.
              </p>
            </div>

            {/* 권한 정보 */}
            <div className="adm-side-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <ShieldCheck size={15} color="#1a3a6b" />
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1a3a6b', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  권한 정보
                </span>
              </div>
              {[
                { label: '접속 시간', value: new Date().toLocaleTimeString('ko-KR') },
                { label: '권한 등급', value: '전체 액세스' },
                { label: '사용자 삭제', value: '✅ 허용' },
                { label: '기사 삭제', value: '✅ 허용' },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  borderBottom: i < arr.length - 1 ? '1px solid #f0ebe4' : 'none',
                  paddingBottom: i < arr.length - 1 ? 9 : 0,
                  marginBottom: i < arr.length - 1 ? 9 : 0
                }}>
                  <span style={{ color: '#aaa' }}>{row.label}</span>
                  <span style={{ color: '#333', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SupabaseAdminChat;
