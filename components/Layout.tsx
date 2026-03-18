import React from 'react';
import { ViewType } from '../types';


interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, setActiveView, isMockMode, setIsMockMode }) => {
  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ec' }}>
      <style>{`
      

        /* ── 최상단 날짜 바 ── */
        .layout-topbar {
          background: #1a3a6b;
          padding: 5px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .layout-topbar-left {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.5);
          font-weight: 400;
          letter-spacing: 0.5px;
        }
        .layout-topbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .layout-live-dot {
          width: 6px; height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: live-pulse 1.5s infinite;
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .layout-live-text {
          font-size: 0.62rem;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        /* ── 메인 헤더 ── */
        .layout-header {
          background: #fff;
          border-bottom: 3px solid #1a3a6b;
          padding: 0 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 66px;
          position: sticky;
          top: 0;
          z-index: 200;
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
        }

        /* 로고 */
        .layout-logo {
          display: flex;
          align-items: center;
          gap: 11px;
          text-decoration: none;
          cursor: default;
        }
        .layout-logo-icon {
          width: 40px; height: 40px;
          background: #1a3a6b;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .layout-logo-text {
          font-family: 'Pretendard', sans-serif;
          font-size: 1.35rem;
          font-weight: 900;
          color: #1a3a6b;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .layout-logo-sub {
          font-size: 0.62rem;
          color: #aaa;
          font-weight: 400;
          display: block;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }

        /* ── 네비게이션 탭 ── */
        .layout-nav {
          display: flex;
          align-items: center;
          height: 100%;
          gap: 0;
        }
        .layout-nav-btn {
          height: 100%;
          padding: 0 22px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.84rem;
          font-weight: 600;
          color: #666;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Pretendard', sans-serif;
          white-space: nowrap;
          position: relative;
          top: 1.5px; /* border-bottom 정렬 보정 */
        }
        .layout-nav-btn:hover { color: #1a3a6b; }
        .layout-nav-btn.active {
          color: #1a3a6b;
          border-bottom-color: #e8192c;
          font-weight: 700;
        }
        .layout-nav-btn .nav-icon {
          font-size: 1rem;
          line-height: 1;
        }

        /* ── 우측 유틸 ── */
        .layout-utils {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* 목 모드 토글 */
        .layout-mock-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #dce6f5;
          background: #f0f4ff;
          cursor: pointer;
          font-family: 'Pretendard', sans-serif;
          transition: all 0.2s;
        }
        .layout-mock-label {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        /* 나가기 버튼 */
        .layout-exit-btn {
          padding: 8px 18px;
          background: #1a3a6b;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Pretendard', sans-serif;
          transition: background 0.2s;
          letter-spacing: 0.3px;
        }
        .layout-exit-btn:hover { background: #12295a; }

        /* ── 콘텐츠 영역 ── */
        .layout-content {
          min-height: calc(100vh - 66px - 29px);
        }

        /* ── 모바일 하단 네비 ── */
        .layout-mobile-nav {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: #fff;
          border-top: 2px solid #1a3a6b;
          padding: 8px 0 12px;
          z-index: 300;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
        }
        .layout-mobile-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
        }
        .layout-mobile-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Pretendard', sans-serif;
          color: #aaa;
          font-size: 0.65rem;
          font-weight: 600;
          transition: color 0.2s;
        }
        .layout-mobile-btn.active { color: #1a3a6b; }
        .layout-mobile-btn span:first-child { font-size: 1.3rem; }

        @media (max-width: 768px) {
          .layout-topbar { padding: 5px 16px; }
          .layout-header { padding: 0 16px; height: 58px; }
          .layout-nav { display: none; }
          .layout-utils { display: none; }
          .layout-mobile-nav { display: block; }
          .layout-content { padding-bottom: 72px; }
          .layout-logo-text { font-size: 1.1rem; }
        }
      `}</style>

      {/* 최상단 날짜 바 */}
      <div className="layout-topbar">
        <span className="layout-topbar-left">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 서울, 대한민국
        </span>
        <div className="layout-topbar-right">
          <div className="layout-live-dot" />
          <span className="layout-live-text">실시간 AI 활성</span>
        </div>
      </div>

      {/* 메인 헤더 */}
      <header className="layout-header">

        {/* 로고 */}
        <div className="layout-logo">
          <div className="layout-logo-icon">🎯</div>
          <div>
            <div className="layout-logo-text">동아일보</div>
            <span className="layout-logo-sub">뉴스룸 시스템</span>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="layout-nav">
          <button
            className={`layout-nav-btn ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            <span className="nav-icon">📋</span>
            대시보드
          </button>
          <button
            className={`layout-nav-btn ${activeView === 'writer' ? 'active' : ''}`}
            onClick={() => setActiveView('writer')}
          >
            <span className="nav-icon">✍️</span>
            기사 작성
          </button>
          <button
            className={`layout-nav-btn ${activeView === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveView('admin')}
          >
            <span className="nav-icon">👤</span>
            사용자 관리
          </button>
        </nav>

        {/* 우측 유틸 */}
        <div className="layout-utils">
          {/* 목 모드 토글 */}
          <button
            onClick={() => setIsMockMode(!isMockMode)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${isMockMode ? '#fde68a' : '#dce6f5'}`,
              background: isMockMode ? '#fffbeb' : '#f0f4ff',
              cursor: 'pointer', fontFamily: "'Pretendard', sans-serif",
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 28, height: 16, borderRadius: 8, position: 'relative',
              background: isMockMode ? '#d97706' : '#1a3a6b',
              transition: 'background 0.2s',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: isMockMode ? 14 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700,
              color: isMockMode ? '#d97706' : '#1a3a6b',
              letterSpacing: 0.5,
            }}>
              {isMockMode ? '데모 모드' : '실제 모드'}
            </span>
          </button>

          {/* 나가기 */}
          <button className="layout-exit-btn" onClick={() => setActiveView('intro' as ViewType)}>
            나가기
          </button>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="layout-content">
        {children}
      </main>

      {/* 모바일 하단 네비 */}
      <nav className="layout-mobile-nav">
        <div className="layout-mobile-nav-inner">
          {[
            { view: 'dashboard', icon: '📋', label: '대시보드' },
            { view: 'writer',    icon: '✍️', label: '기사 작성' },
            { view: 'admin',     icon: '👤', label: '사용자 관리' },
          ].map(item => (
            <button
              key={item.view}
              className={`layout-mobile-btn ${activeView === item.view ? 'active' : ''}`}
              onClick={() => setActiveView(item.view as ViewType)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
