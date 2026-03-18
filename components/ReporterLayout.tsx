import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import AIWriter from './AIWriter';
import SupabaseAdminChat from './SupabaseAdminChat';

interface Props {
  onExit: () => void;
}

const ReporterLayout: React.FC<Props> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('donga_reporter_tab');
    return (saved === 'research' || !saved) ? 'dashboard' : saved;
  });

  useEffect(() => {
    localStorage.setItem('donga_reporter_tab', activeTab);
  }, [activeTab]);

  return (
    <div className="reporter-layout">
      <style>{`
        .reporter-layout {
          display: flex; flex-direction: column; min-height: 100vh; background: #f4f1ec;
        }
        .rl-topbar { background: #1a3a6b; padding: 5px 40px; display: flex; justify-content: space-between; align-items: center; }
        .rl-topbar-left { font-size: 0.65rem; color: rgba(255,255,255,0.5); font-weight: 400; letter-spacing: 0.5px; }
        .rl-topbar-right { display: flex; align-items: center; gap: 6px; }
        .rl-live-dot { width: 6px; height: 6px; border-radius: 50%; animation: rl-pulse 1.5s infinite; background: #22c55e; }
        @keyframes rl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        .rl-live-text { font-size: 0.62rem; color: rgba(255,255,255,0.6); font-weight: 700; letter-spacing: 1.5px; }
        .rl-header { background: #fff; border-bottom: 3px solid #1a3a6b; padding: 0 40px; display: flex; align-items: center; justify-content: space-between; height: 66px; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
        .rl-logo { display: flex; align-items: center; gap: 11px; cursor: pointer; }
        .rl-logo-icon { width: 40px; height: 40px; background: #1a3a6b; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .rl-logo-text { font-family: 'Pretendard', sans-serif; font-size: 1.35rem; font-weight: 900; color: #1a3a6b; letter-spacing: -0.5px; line-height: 1; }
        .rl-logo-sub { font-size: 0.62rem; color: #aaa; font-weight: 400; display: block; margin-top: 2px; }
        .rl-nav { display: flex; align-items: center; height: 100%; gap: 0; }
        .rl-nav-btn { height: 66px; padding: 0 22px; display: flex; align-items: center; gap: 8px; font-size: 0.84rem; font-weight: 600; color: #888; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; transition: all 0.2s; font-family: 'Pretendard', sans-serif; white-space: nowrap; position: relative; top: 1.5px; }
        .rl-nav-btn:hover { color: #1a3a6b; }
        .rl-nav-btn.active { color: #1a3a6b; border-bottom-color: #e8192c; font-weight: 700; }
        .rl-exit-btn { padding: 8px 18px; background: #1a3a6b; color: #fff; border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; font-family: 'Pretendard', sans-serif; transition: background 0.2s; }
        .rl-exit-btn:hover { background: #12295a; }
        .rl-content { flex: 1; overflow: auto; }
        .rl-content-inner { max-width: 1400px; margin: 0 auto; }

        /* 기사 생성 중 배지 */
        .rl-generating-badge {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 20px;
          background: #fffbeb; border: 1px solid #fde68a;
          font-size: 0.7rem; font-weight: 700; color: #d97706;
          font-family: 'Pretendard', sans-serif;
          animation: badge-pulse 1.5s infinite;
        }
        @keyframes badge-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>

      {/* 최상단 날짜 바 */}
      <div className="rl-topbar">
        <span className="rl-topbar-left">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 서울, 대한민국
        </span>
        <div className="rl-topbar-right" />
      </div>

      {/* 메인 헤더 */}
      <header className="rl-header">
        <div className="rl-logo" onClick={() => setActiveTab('dashboard')}>
          <div className="rl-logo-icon">🎯</div>
          <div>
            <div className="rl-logo-text">동아일보</div>
            <span className="rl-logo-sub">기자실 시스템</span>
          </div>
        </div>

        <nav className="rl-nav">
          <button className={`rl-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span>📋</span> 대시보드
          </button>
          <button className={`rl-nav-btn ${activeTab === 'writer' ? 'active' : ''}`} onClick={() => setActiveTab('writer')}>
            <span>✍️</span> 기사 작성
          </button>
          <button className={`rl-nav-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
            <span>👤</span> 사용자 관리
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="rl-exit-btn" onClick={onExit}>나가기</button>
        </div>
      </header>

      {/* 콘텐츠 - AIWriter는 항상 마운트, display로만 숨김 */}
      <main className="rl-content">
        <div className="rl-content-inner">

          {/* Dashboard: 탭 전환 시 숨김 */}
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard />
          </div>

          {/* AIWriter: 항상 마운트 유지 → 기사 생성 중 다른 탭 가도 계속 실행됨 */}
          <div style={{ display: activeTab === 'writer' ? 'block' : 'none' }}>
            <AIWriter />
          </div>

          {/* Admin: 탭 전환 시 마운트/언마운트 (무거운 컴포넌트 아님) */}
          {activeTab === 'admin' && <SupabaseAdminChat />}

        </div>
      </main>
    </div>
  );
};

export default ReporterLayout;
