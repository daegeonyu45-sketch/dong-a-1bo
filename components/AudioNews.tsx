import React, { useState, useRef, useEffect } from 'react';
import { generateTrotLyrics, speakTrot, decodeAudio } from '../services/gemini';
import { storage as dbStorage, type SavedAudioNews } from '../services/db';
import { Music, Play, Pause, Save, Trash2, Headphones, Sparkles, Loader2, Volume2, Mic2, AlertCircle, RotateCcw, Download } from 'lucide-react';

const AudioNews: React.FC = () => {
  const [inputText, setInputText] = useState(() => {
    const session = localStorage.getItem('donga_audio_session');
    return session ? JSON.parse(session).text : '';
  });
  const [lyrics, setLyrics] = useState<string | null>(() => {
    const session = localStorage.getItem('donga_audio_session');
    return session ? JSON.parse(session).savedLyrics : null;
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<SavedAudioNews[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsBufferRef = useRef<AudioBuffer | null>(null); 
  
  const playbackOffsetRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isManuallyStoppedRef = useRef<boolean>(false);

  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`LocalStorage quota exceeded for key: ${key}. Data not saved to storage.`);
      } else {
        console.error(`Error saving to localStorage for key: ${key}`, e);
      }
    }
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  };

  useEffect(() => {
    loadSavedItems();
    return () => {
      isManuallyStoppedRef.current = true;
      stopPlayback();
    };
  }, []);

  const loadSavedItems = async () => {
    const items = await dbStorage.getAllAudio();
    setSavedItems(items);
  };

  useEffect(() => {
    safeLocalStorageSet('donga_audio_session', JSON.stringify({
      text: inputText,
      savedLyrics: lyrics
    }));
  }, [inputText, lyrics]);

  const stopPlayback = () => {
    const ctx = audioContextRef.current;
    if (ttsSourceRef.current && ctx) {
      isManuallyStoppedRef.current = true;
      const elapsed = ctx.currentTime - startTimeRef.current;
      playbackOffsetRef.current += Math.max(0, elapsed);
      try { ttsSourceRef.current.stop(); } catch {}
      ttsSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const playTts = async (buffer: AudioBuffer, offset: number = 0) => {
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if (ttsSourceRef.current) {
      try { ttsSourceRef.current.stop(); } catch {}
    }
    const startOffset = offset >= buffer.duration ? 0 : offset;
    playbackOffsetRef.current = startOffset;
    const ttsSource = ctx.createBufferSource();
    ttsSource.buffer = buffer;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 1.4;
    ttsSource.connect(voiceGain);
    voiceGain.connect(ctx.destination);
    ttsSourceRef.current = ttsSource;
    isManuallyStoppedRef.current = false;
    ttsSource.onended = () => {
      if (!isManuallyStoppedRef.current) {
        playbackOffsetRef.current = 0;
        setIsPlaying(false);
      }
    };
    const playDelay = 0.1;
    startTimeRef.current = ctx.currentTime + playDelay;
    ttsSource.start(startTimeRef.current, startOffset);
  };

  const handleConvert = async () => {
    if (!inputText.trim()) return;
    setErrorMessage(null);
    const ctx = initAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    playbackOffsetRef.current = 0;
    stopPlayback();
    setIsLoading(true);
    ttsBufferRef.current = null;
    setLyrics(null);
    try {
      const gukakLyrics = await generateTrotLyrics(inputText, false);
      setLyrics(gukakLyrics);
      const audioDataBase64 = await speakTrot(gukakLyrics, false);
      
      if (!audioDataBase64) throw new Error("음성 생성 실패");
      const buffer = await decodeAudio(audioDataBase64, ctx);
      ttsBufferRef.current = buffer;
      setIsLoading(false);
      setIsPlaying(true);
      await playTts(buffer, 0);
    } catch (error: unknown) {
      console.error(error);
      stopPlayback();
      setErrorMessage("국악 음성 제작 중 오류가 발생했습니다. 다시 시도해주세요.");
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      const ctx = initAudioContext();
      await ctx.resume();
      if (ttsBufferRef.current) {
        setIsPlaying(true);
        await playTts(ttsBufferRef.current, playbackOffsetRef.current);
      } else if (lyrics) {
        handleConvert();
      }
    }
  };

  const resetPlayback = () => {
    playbackOffsetRef.current = 0;
    if (isPlaying) {
      stopPlayback();
      if (ttsBufferRef.current) {
        setIsPlaying(true);
        playTts(ttsBufferRef.current, 0);
      }
    }
  };

  // 오디오 WAV 다운로드
  const downloadAudio = () => {
    const buffer = ttsBufferRef.current;
    if (!buffer) return;
    const length = buffer.length * buffer.numberOfChannels * 2 + 44;
    const view = new DataView(new ArrayBuffer(length));
    let offset = 0;
    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
      offset += s.length;
    };
    writeString('RIFF');
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, buffer.numberOfChannels, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * 2 * buffer.numberOfChannels, true); offset += 4;
    view.setUint16(offset, buffer.numberOfChannels * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString('data');
    view.setUint32(offset, length - offset - 4, true); offset += 4;
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      const channel = buffer.getChannelData(i);
      for (let j = 0; j < channel.length; j++) {
        const sample = Math.max(-1, Math.min(1, channel[j]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `동아_국악뉴스_${Date.now()}.wav`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 보관함 가사 텍스트 다운로드
  const downloadLyrics = (item: SavedAudioNews) => {
    const blob = new Blob([`제목: ${item.title}\n날짜: ${item.timestamp}\n\n${item.lyrics}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `국악뉴스_${item.title}_${item.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!lyrics) return;
    const newItem: SavedAudioNews = {
      id: Date.now(),
      title: inputText.split('\n')[0].slice(0, 20) || "신명나는 국악 뉴스",
      lyrics,
      timestamp: new Date().toLocaleString()
    };
    await dbStorage.saveAudio(newItem);
    await loadSavedItems();
  };

  const deleteItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await dbStorage.deleteAudio(id);
    await loadSavedItems();
  };

  return (
    <div className="container-fluid py-2 text-slate-900 animate-fade-in">
      <div className="row g-4">
        {/* Sidebar */}
        <div className="col-lg-3">
          <div className="bg-white h-100 p-4 d-flex flex-column rounded-[32px] border border-slate-200 shadow-sm" style={{ minHeight: '80vh' }}>
            <h5 className="text-slate-900 fw-bold mb-4 pb-3 border-bottom border-slate-100 d-flex justify-content-between align-items-center">
              <span className="flex items-center gap-2"><Music size={20} className="text-blue-600"/> 국악 보관함</span>
              <span className="badge bg-slate-100 text-slate-500 px-2">{savedItems.length}</span>
            </h5>
            <div className="overflow-auto custom-scrollbar flex-grow-1 pr-2">
              {savedItems.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <Headphones size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="small text-slate-400">제작된 국악 뉴스가 없습니다.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {savedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setLyrics(item.lyrics);
                        setInputText(item.title);
                        playbackOffsetRef.current = 0;
                        stopPlayback();
                      }}
                      className={`p-4 rounded-2xl transition-all border cursor-pointer ${lyrics === item.lyrics ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <h6 className="text-slate-900 text-truncate mb-1 fw-bold" style={{ fontSize: '0.9rem' }}>{item.title}</h6>
                      <p className="text-slate-400 m-0 mb-3" style={{ fontSize: '0.7rem' }}>{item.timestamp}</p>
                      {/* 항상 보이는 삭제 + 다운로드 버튼 */}
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => downloadLyrics(item)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold border-0 cursor-pointer transition-all"
                          style={{ background: '#f0f9ff', color: '#0369a1' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f0f9ff')}
                        >
                          <Download size={13} /> 다운로드
                        </button>
                        <button
                          onClick={(e) => deleteItem(e, item.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-xs font-bold border-0 cursor-pointer transition-all"
                          style={{ background: '#f0f9ff', color: '#0369a1' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#e0f2fe')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f0f9ff')}
                        >
                          <Trash2 size={13} /> 삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-lg-9">
          <div className="text-center mb-6">
            <h1 className="display-5 fw-black text-slate-900 mb-2 tracking-tighter">
              <span className="text-gradient-gukak">AI 국악 뉴스룸</span>
            </h1>
            <p className="text-slate-500">우리 가락의 울림으로 전하는 오늘의 핵심 뉴스</p>
          </div>

          <div className="row g-4">
            <div className="col-xl-6">
              <div className="bg-white p-5 h-100 d-flex flex-column rounded-[40px] border border-slate-200 shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <label className="text-slate-400 fw-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <Mic2 size={16} className="text-blue-600" /> 뉴스 기사 본문
                  </label>
                  <div className="flex gap-1">
                    <span className="w-1 h-4 bg-blue-600 animate-[bounce_1.2s_infinite]"></span>
                    <span className="w-1 h-6 bg-blue-500 animate-[bounce_1.5s_infinite]"></span>
                    <span className="w-1 h-3 bg-blue-400 animate-[bounce_0.9s_infinite]"></span>
                  </div>
                </div>
                <textarea
                  className="form-control bg-slate-50 text-slate-900 border-slate-100 mb-5 flex-grow-1 p-4 rounded-3xl shadow-inner custom-scrollbar"
                  style={{ resize: 'none', minHeight: '400px', fontSize: '1rem', lineHeight: '1.7' }}
                  placeholder="기사를 입력하면 AI가 신명나는 국악(판소리) 스타일 가사와 음성으로 변환해 드립니다."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <div className="d-flex gap-3">
                  <button
                    className="btn flex-grow-1 py-4 rounded-2xl fw-black fs-5 shadow-lg border-0 transition-transform active:scale-95 flex items-center justify-center gap-3"
                    style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2a4a7b 100%)', color: '#fff' }}
                    onClick={handleConvert}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="animate-spin" /> <span>국악 가사 짓는 중...</span></>
                    ) : (
                      <><Play fill="white" /> 🥁 국악 뉴스 생성</>
                    )}
                  </button>
                  {lyrics && !isLoading && (
                    <button
                      className="btn btn-outline-slate-200 px-4 rounded-2xl border-slate-200 hover:bg-slate-50 transition-all shadow-sm text-blue-600"
                      title="보관함에 저장"
                      onClick={handleSave}
                    >
                      <Save size={24} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="col-xl-6">
              <div className="bg-white p-5 h-100 d-flex flex-column align-items-center justify-content-center text-center rounded-[40px] border border-slate-200 shadow-sm">
                {errorMessage && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-600 text-sm flex items-center gap-3">
                    <AlertCircle size={20} /> {errorMessage}
                  </div>
                )}

                {isLoading ? (
                  <div className="text-center py-20 animate-fade-in w-100">
                    <div className="mb-10">
                      <div className="flex justify-center items-end gap-2 mb-8 h-20">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="w-3 bg-blue-600 rounded-full animate-[bounce_1s_infinite]"
                            style={{ animationDelay: `${i * 0.1}s`, height: `${30 + Math.random() * 70}%` }}
                          />
                        ))}
                      </div>
                      <div className="bg-slate-50 w-48 h-48 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-100 border-t-blue-600 animate-spin shadow-sm">
                        <Sparkles size={60} className="text-blue-600 animate-pulse" />
                      </div>
                    </div>
                    <h4 className="fw-black text-blue-600 display-6 tracking-tighter mb-3">소리판 준비 중...</h4>
                    <p className="text-slate-500 fw-bold">AI 명창이 뉴스 사설을 구성지게 읊고 있소!</p>
                  </div>
                ) : !lyrics ? (
                  <div className="py-20 opacity-20">
                    <div className="bg-slate-50 w-40 h-40 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
                      <Music size={80} className="text-blue-600" />
                    </div>
                    <h4 className="fw-black text-slate-400">대기 중</h4>
                    <p className="small text-slate-400">버튼을 누르면 신명나는 소리가 시작됩니다!</p>
                  </div>
                ) : (
                  <div className="w-100 animate-fade-in">
                    <div className="mb-6 position-relative d-inline-block">
                      <div
                        className={`rounded-full border-[15px] border-slate-50 mx-auto d-flex align-items-center justify-content-center shadow-xl ${isPlaying ? 'spin-slow' : ''}`}
                        style={{ width: '300px', height: '300px', background: 'radial-gradient(circle, #f0f9ff 0%, #ffffff 70%)', border: isPlaying ? '15px solid #e0f2fe' : '15px solid #f1f5f9' }}
                      >
                        <div className="rounded-full bg-blue-600 flex items-center justify-center shadow-lg" style={{ width: '90px', height: '90px', border: '6px solid #fff' }}>
                          <Volume2 size={40} className="text-white" />
                        </div>
                      </div>
                      <div className="position-absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10" onClick={togglePlay}>
                        {isPlaying ? (
                          <Pause size={100} className="text-slate-900 fill-slate-900 opacity-80 hover:scale-110 transition-all" />
                        ) : (
                          <Play size={100} className="text-slate-900 fill-slate-900 opacity-80 hover:scale-110 transition-all translate-x-1" />
                        )}
                      </div>
                    </div>

                    <div className="mb-4 d-flex justify-content-center gap-2">
                      {playbackOffsetRef.current > 0 && !isPlaying && (
                        <div className="badge bg-blue-50 text-blue-600 px-3 py-2 border border-blue-100 rounded-full flex items-center gap-2 animate-pulse">
                          {Math.floor(playbackOffsetRef.current)}초 지점 중단
                        </div>
                      )}
                      {ttsBufferRef.current && (
                        <button onClick={downloadAudio} className="badge bg-blue-50 text-blue-600 px-3 py-2 border border-blue-100 rounded-full flex items-center gap-2 hover:bg-blue-100 transition-all border-0 cursor-pointer">
                          <Download size={14} /> 소리 내려받기
                        </button>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-5 mb-6 text-start border border-slate-100 custom-scrollbar shadow-inner" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      <pre className="text-slate-800 m-0" style={{ fontFamily: 'Pretendard', whiteSpace: 'pre-wrap', lineHeight: '2.0', fontSize: '1.1rem', fontWeight: '600' }}>
                        {lyrics}
                      </pre>
                    </div>

                    <div className="d-flex gap-3">
                      <button
                        className={`btn flex-grow-1 py-4 rounded-2xl fw-black fs-5 shadow-lg flex items-center justify-center gap-3 transition-all ${isPlaying ? 'btn-danger' : 'btn-primary'}`}
                        onClick={togglePlay}
                        style={!isPlaying ? { background: '#1a3a6b', border: 'none' } : {}}
                      >
                        {isPlaying ? <><Pause /> 일시 정지</> : (playbackOffsetRef.current > 0 ? <><Play /> 이어 듣기</> : <><Play /> 처음부터 재생</>)}
                      </button>
                      {playbackOffsetRef.current > 0 && (
                        <button className="btn btn-outline-slate-200 px-4 rounded-2xl border-slate-200 hover:bg-slate-50 transition-all text-slate-400" title="처음부터 다시" onClick={resetPlayback}>
                          <RotateCcw size={24} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .text-gradient-gukak {
          background: linear-gradient(to right, #93c5fd, #60a5fa, #3b82f6);
          background-size: 200% auto;
          animation: shine 4s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'Pretendard', sans-serif;
        }
        @keyframes shine { to { background-position: 200% center; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default AudioNews;
