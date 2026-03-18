import React, { useState } from 'react';
import NetizenSimulator from './NetizenSimulator';
import HeadlineMaker from './HeadlineMaker';
import RealtimeNews from './RealtimeNews';
import AudioNews from './AudioNews';

interface Props {
  onExit: () => void;
}

const ViewerLayout: React.FC<Props> = ({ onExit }) => {
  const [activeViewerTab, setActiveViewerTab] = useState('realtime');

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f1ec',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        /* 최상단 날짜 바 */
        .vl-topbar {
          background: #1a3a6b;
          padding: 5px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .vl-topbar-left {
          font-size: 0.65rem;
          color: rgba(255,255,255,0.5);
          font-weight: 400;
          letter-spacing: 0.5px;
        }
        .vl-topbar-right {
          display: flex; align-items: center; gap: 6px;
        }
        .vl-live-dot {
          width: 6px; height: 6px;
          background: #22c55e;
          border-radius: 50%;
          animation: vl-pulse 1.5s infinite;
        }
        @keyframes vl-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .vl-live-text {
          font-size: 0.62rem;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        /* 메인 헤더 */
        .vl-header {
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
        .vl-logo {
          display: flex; align-items: center; gap: 11px;
          cursor: default;
        }
        .vl-logo-icon {
          width: 40px; height: 40px;
          background: #1a3a6b;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
        }
        .vl-logo-text {
          font-family: 'Pretendard', sans-serif;
          font-size: 1.35rem;
          font-weight: 900;
          color: #1a3a6b;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .vl-logo-sub {
          font-size: 0.62rem;
          color: #aaa;
          font-weight: 400;
          display: block;
          margin-top: 2px;
        }

        /* 탭 네비 */
        .vl-nav {
          display: flex; align-items: center;
          height: 100%; gap: 0;
        }
        .vl-nav-btn {
          height: 66px;
          padding: 0 22px;
          display: flex; align-items: center; gap: 7px;
          font-size: 0.84rem; font-weight: 600;
          color: #666;
          background: transparent; border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Pretendard', sans-serif;
          white-space: nowrap;
          position: relative; top: 1.5px;
        }
        .vl-nav-btn:hover { color: #1a3a6b; }
        .vl-nav-btn.active {
          color: #1a3a6b;
          border-bottom-color: #e8192c;
          font-weight: 700;
        }

        /* 우측 버튼 */
        .vl-exit-btn {
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
        }
        .vl-exit-btn:hover { background: #12295a; }

        /* 콘텐츠 */
        .vl-content {
          flex: 1;
          padding: 36px 40px 60px;
        }
        .vl-content-inner {
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .vl-topbar { padding: 5px 16px; }
          .vl-header { padding: 0 16px; height: 58px; }
          .vl-nav { display: none; }
          .vl-content { padding: 20px 16px 40px; }
        }
      `}</style>

      {/* 최상단 날짜 바 */}
      <div className="vl-topbar">
        <span className="vl-topbar-left">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} · 서울, 대한민국
        </span>
        <div className="vl-topbar-right">
          <div className="vl-live-dot" />
          <span className="vl-live-text">실시간 피드 활성화</span>
        </div>
      </div>

      {/* 메인 헤더 */}
      <header className="vl-header">
        {/* 로고 */}
        <div className="vl-logo">
          <div className="vl-logo-icon">🍿</div>
          <div>
            <div className="vl-logo-text">방구석 1열</div>
            <span className="vl-logo-sub">동아일보 시청자 채널</span>
          </div>
        </div>

        {/* 탭 네비 */}
        <nav className="vl-nav">
          {[
            { key: 'realtime', icon: '📡', label: '실시간 기사' },
            { key: 'audio',    icon: '🥁', label: '국악 변환' },
            { key: 'netizen',  icon: '💬', label: '댓글 전쟁' },
            { key: 'headline', icon: '📸', label: '속보 합성' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`vl-nav-btn ${activeViewerTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveViewerTab(tab.key)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* 우측 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="vl-exit-btn" onClick={onExit}>나가기</button>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="vl-content">
        <div className="vl-content-inner">

          {/* 실시간 기사: 항상 마운트 유지 */}
          <div style={{ display: activeViewerTab === 'realtime' ? 'block' : 'none' }}>
            <RealtimeNews />
          </div>

          {/* 국악 변환: 항상 마운트 유지 → 생성 중 다른 탭 가도 계속 실행됨 */}
          <div style={{ display: activeViewerTab === 'audio' ? 'block' : 'none' }}>
            <AudioNews />
          </div>

          {/* 댓글 전쟁, 속보 합성: 탭 전환 시 마운트/언마운트 */}
          {activeViewerTab === 'netizen'  && <NetizenSimulator />}
          {activeViewerTab === 'headline' && <HeadlineMaker />}

        </div>
      </main>
    </div>
  );
};

export default ViewerLayout;
