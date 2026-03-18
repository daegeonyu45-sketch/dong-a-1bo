import React from 'react';

interface Props {
  onSelectMode: (mode: 'reporter' | 'viewer') => void;
}

const NetflixIntro: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="bg-[#f4f1ec] min-h-screen flex flex-col">

      {/* 헤더 */}
      <header className="bg-white border-b-3 border-[#1a3a6b] px-12 flex items-center justify-between h-18 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#1a3a6b] rounded-full flex items-center justify-center text-2xl">🎯</div>
          <span className="text-2xl font-black text-[#1a3a6b] tracking-tight">뉴스룸</span>
        </div>
        <div className="text-sm text-gray-400 font-light">접속 모드를 선택하세요</div>
      </header>

      {/* 히어로 */}
      <main className="flex-1 flex flex-col items-center justify-center px-10 py-14 relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1a3a6b] via-[#e8192c] to-[#1a3a6b]"></div>
        <h1 className="text-5xl font-black text-[#1a1a2e] text-center leading-tight mb-3 tracking-tighter">
          뉴스룸에 오신 것을<br />환영합니다
        </h1>
        <p className="text-base text-gray-500 mb-12 font-normal">접속 모드를 선택하여 시작하세요</p>

        <div className="flex gap-9 items-stretch">

          {/* ── 기자실 ── */}
          <div className="w-80 bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all duration-250 ease-in-out shadow-md hover:transform hover:-translate-y-2 hover:border-[#1a3a6b] hover:shadow-2xl" onClick={() => onSelectMode('reporter')}>
            <div className="w-19 h-19 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl transition-all duration-250 ease-in-out">🎙️</div>
            <div className="text-xl font-bold text-[#1a1a2e]">기자실</div>
            <div className="text-sm text-gray-500 leading-relaxed mb-1">직접 뉴스를 생성하고<br />관리하는 작업 공간</div>

            <div className="flex flex-col gap-2 w-full">
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#1a3a6b] flex-shrink-0"></span> 대시보드 </span>
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#1a3a6b] flex-shrink-0"></span> 기사 작성 </span>
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#1a3a6b] flex-shrink-0"></span> 사용자 관리 </span>
            </div>

            <div className="text-xs font-bold text-[#e8192c] border border-[#e8192c] rounded-full px-3 py-1 tracking-wider mt-1">기자</div>
          </div>

          <div className="flex items-center self-center text-gray-400 text-sm font-light px-1">또는</div>

          {/* ── 방구석 1열 ── */}
          <div className="w-80 bg-gray-50 border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all duration-250 ease-in-out shadow-md hover:transform hover:-translate-y-2 hover:border-[#1a3a6b] hover:shadow-2xl" onClick={() => onSelectMode('viewer')}>
            <div className="w-19 h-19 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl transition-all duration-250 ease-in-out">🍿</div>
            <div className="text-xl font-bold text-[#1a1a2e]">방구석 1열</div>
            <div className="text-sm text-gray-500 leading-relaxed mb-1">실시간 뉴스를 다양한 방식으로<br />즐기는 시청자 공간</div>

            <div className="flex flex-col gap-2 w-full">
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-200 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#e8192c] flex-shrink-0"></span> 실시간 기사 </span>
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-200 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#e8192c] flex-shrink-0"></span> 국악 변환 </span>
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-200 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#e8192c] flex-shrink-0"></span> 댓글 전쟁 </span>
              <span className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gray-200 text-sm font-medium text-gray-700 text-left"> <span className="w-2 h-2 rounded-full bg-[#e8192c] flex-shrink-0"></span> 속보 합성 </span>
            </div>

            <div className="text-xs font-bold text-gray-600 border border-gray-400 rounded-full px-3 py-1 tracking-wider mt-1">시청자</div>
          </div>

        </div>
      </main>

    </div>
  );
};

export default NetflixIntro;
