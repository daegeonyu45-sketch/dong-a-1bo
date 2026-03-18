
import React, { useState } from 'react';

const TrotKaraoke = () => {
  const [requestSong, setRequestSong] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const chartData = [
    { rank: 1, title: "AI라서 다행이야", singer: "알고리즘", votes: 12500 },
    { rank: 2, title: "코딩의 늪", singer: "디버깅", votes: 9800 },
    { rank: 3, title: "퇴근은 없다", singer: "야근맨", votes: 8400 },
    { rank: 4, title: "서버가 터졌네", singer: "데브옵스", votes: 7200 },
    { rank: 5, title: "사랑의 API", singer: "제미나이", votes: 5100 },
  ];

  const handleRequest = () => {
    if (!requestSong) return;
    setIsPlaying(true);
    setTimeout(() => {
      alert(`🎤 신청하신 곡 '${requestSong}'\nAI 가수가 연습 중입니다! (곧 재생됨)`);
      setIsPlaying(false);
      setRequestSong("");
    }, 2000);
  };

  return (
    <div className="h-100 d-flex flex-column align-items-center justify-content-center p-4 text-white position-relative" style={{ overflow: 'hidden' }}>
      
      <div style={{
        position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
        background: 'conic-gradient(from 0deg, #3b82f6, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #3b82f6)',
        opacity: 0.1, animation: 'spin 12s linear infinite', zIndex: 0
      }}></div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="container position-relative" style={{ zIndex: 1, maxWidth: '1000px' }}>
        
        <div className="mb-5 p-1 bg-slate-800 rounded-4 border border-slate-700 shadow-2xl">
          <div className="rounded-4 d-flex flex-column align-items-center justify-content-center" 
               style={{ height: '380px', background: 'black', border: '8px solid #1e293b' }}>
            
            {isPlaying ? (
              <div className="text-center animate-pulse">
                <h1 className="text-warning display-2 fw-bold mb-4" style={{ textShadow: '0 0 20px #eab308' }}>🎵 연주 중...</h1>
                <p className="text-white fs-2">🕺 💃 🕺 💃</p>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-green-500 fw-bold mb-3 tracking-widest">RESERVE AVAILABLE</h2>
                <h1 className="text-white display-3 fw-bold" style={{textShadow: '0 0 15px white', fontFamily: 'monospace'}}>0000</h1>
                <p className="text-slate-500 mt-4 fs-5">리모컨으로 신청곡을 입력하세요</p>
              </div>
            )}
          </div>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <div className="glass-card p-4 rounded-4 shadow-xl" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #334155' }}>
              <h4 className="text-warning fw-bold mb-4 d-flex align-items-center gap-2">
                <i className="bi bi-trophy-fill"></i> 실시간 인기 차트
              </h4>
              <ul className="list-unstyled m-0">
                {chartData.map((song) => (
                  <li key={song.rank} className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-slate-800">
                    <span className="text-white fw-bold">
                      <span className="badge bg-blue-600 me-3 rounded-pill px-2">{song.rank}</span>
                      {song.title}
                    </span>
                    <small className="text-slate-400 font-bold">{song.singer}</small>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-md-6">
            <div className="glass-card p-5 rounded-4 h-100 d-flex flex-column justify-content-center shadow-xl" style={{ background: 'rgba(30, 41, 59, 0.9)', border: '3px solid #475569' }}>
              <h4 className="text-white fw-bold mb-4 text-center">🎤 노래 신청 리모컨</h4>
              <input 
                type="text" 
                className="form-control form-control-lg mb-4 bg-slate-900 text-white text-center border-slate-700 py-3 fs-4"
                placeholder="제목을 입력하세요"
                value={requestSong}
                style={{ fontWeight: 'bold' }}
                onChange={(e) => setRequestSong(e.target.value)}
              />
              <button 
                className="btn btn-lg btn-success w-100 fw-bold py-3 fs-4 transition-all"
                onClick={handleRequest}
                disabled={isPlaying}
                style={{
                  boxShadow: isPlaying ? 'none' : '0 6px 0 #064e3b', 
                  transform: isPlaying ? 'translateY(6px)' : 'none',
                  background: '#10b981',
                  border: 'none'
                }}
              >
                {isPlaying ? '신명나는 중...' : '곡 예약 (START)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrotKaraoke;
