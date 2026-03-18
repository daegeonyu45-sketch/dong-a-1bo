
import React, { useState, useEffect } from 'react';
import { generateImage } from '../services/gemini';
import { storage as dbStorage, type SavedImage } from '../services/db';
import { Image as ImageIcon, Loader2, Zap, LayoutDashboard, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';

interface Props {
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
}

const AIIllustrator: React.FC<Props> = ({ isMockMode, setIsMockMode }) => {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showQuotaPrompt, setShowQuotaPrompt] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);

  useEffect(() => {
    loadSavedImages();
  }, []);

  const loadSavedImages = async () => {
    const images = await dbStorage.getAllImages();
    setSavedImages(images);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setIsSaved(false);
    setErrorMsg("");
    setShowQuotaPrompt(false);
    try {
      const brandedPrompt = `${prompt}. ultra realistic surrealism, photorealistic 3D editorial art, premium branding key visual, cinematic lighting, no random text, no watermark, and if a real brand like Tesla or 동아일보 is explicitly requested, use only the official brand mark accurately instead of an invented logo.`;
      const imgUrl = await generateImage(brandedPrompt, isMockMode);
      setImage(imgUrl);
    } catch (e: unknown) {
      console.error("이미지 생성 오류:", e);
      if (e instanceof Error && e.message === "QUOTA_EXCEEDED") {
        setErrorMsg("API 할당량이 부족합니다.");
        setShowQuotaPrompt(true);
      } else {
        setErrorMsg("이미지 생성 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchToDemo = () => {
    setIsMockMode(true);
    setErrorMsg("");
    setShowQuotaPrompt(false);
    setTimeout(() => handleGenerate(), 100);
  };

  const handleSaveToDashboard = async () => {
    if (!image) return;
    try {
      const newImage: SavedImage = {
        id: Date.now(),
        prompt: prompt,
        url: image,
        date: new Date().toLocaleString(),
      };
      await dbStorage.saveImage(newImage);
      await loadSavedImages();
      setIsSaved(true);
      showToast("이미지가 저장되었습니다");
    } catch {
      showToast("저장 중 오류가 발생했습니다");
    }
  };

  const handleDeleteImage = async (id: number) => {
    try {
      await dbStorage.deleteImage(id);
      await loadSavedImages();
      showToast("이미지가 삭제되었습니다");
    } catch {
      showToast("삭제 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="h-100 p-2 text-white animate-fade-in">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-fade-in">
          {toast}
        </div>
      )}
      <div className="mb-5">
        <h2 className="fw-black mb-1 tracking-tighter">🎨 AI 일러스트레이터</h2>
        <p className="text-slate-500 text-sm m-0">기사 보충용 초현실주의 실사 3D & 아트 브랜딩 이미지를 생성합니다.</p>
      </div>

      <div className="glass-card p-5 mb-5 rounded-3xl border-0 shadow-2xl bg-slate-900/90">
        <label className="text-slate-500 text-[10px] font-black mb-3 block uppercase tracking-widest">일러스트 프롬프트</label>
        <div className="input-group">
          <input 
            type="text" 
            className="form-control !bg-slate-950 border-slate-800 text-white py-3 px-4 rounded-s-xl" 
            placeholder="예) AI 반도체 경쟁을 초현실주의 실사 3D 에디토리얼 이미지로 표현"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button className="btn btn-primary px-5 fw-bold rounded-e-xl" onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "이미지 생성"}
          </button>
        </div>
      </div>

      <div className="d-flex justify-content-center align-items-center bg-slate-950/50 rounded-4 border border-slate-800 p-5 min-h-[500px] shadow-inner relative overflow-hidden">
        {loading ? (
          <div className="text-center">
            <Loader2 className="animate-spin mb-3 text-blue-500" size={48} />
            <p className="fw-black tracking-widest text-slate-500">생성 중...</p>
          </div>
        ) : errorMsg ? (
          <div className="text-center p-5 max-w-md animate-fade-in">
            <AlertCircle size={48} className="mx-auto mb-4 text-orange-500" />
            <h5 className="font-black text-orange-400 mb-2">{errorMsg}</h5>
            {showQuotaPrompt && (
              <>
                <p className="text-slate-500 text-sm mb-5 leading-relaxed">무료 API 할당량이 초과되었습니다.<br/>데모 모드에서는 준비된 샘플 이미지를 사용할 수 있습니다.</p>
                <button onClick={switchToDemo} className="btn btn-amber-500 w-100 py-3 rounded-2xl font-black bg-amber-600 text-white border-0 shadow-lg flex items-center justify-center gap-2">
                  <Zap size={18} /> 데모 모드로 계속하기
                </button>
              </>
            )}
          </div>
        ) : image ? (
          <div className="text-center w-100 animate-scale-up">
            <img src={image} alt="Generated" className="img-fluid rounded-4 shadow-2xl mb-4 max-h-[500px] border border-slate-800" />
            <div className="d-flex justify-content-center gap-3">
              <button className={`btn ${isSaved ? 'btn-success' : 'btn-outline-light'} px-5 py-3 rounded-2xl fw-black flex items-center gap-2`} onClick={handleSaveToDashboard} disabled={isSaved}>
                {isSaved ? <CheckCircle size={20} /> : <LayoutDashboard size={20} />} {isSaved ? "저장 완료" : "갤러리에 저장"}
              </button>
              <a href={image} download="ai-news-img.png" className="btn btn-outline-slate-700 px-5 py-3 rounded-2xl fw-black flex items-center gap-2 no-underline text-white">다운로드</a>
            </div>
          </div>
        ) : (
          <div className="text-center opacity-20">
            <ImageIcon size={80} className="mb-3 mx-auto" />
            <p className="fw-black">프롬프트를 입력하세요</p>
          </div>
        )}
      </div>

      {savedImages.length > 0 && (
        <div className="mt-10">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="fw-black mb-1 tracking-tighter">🖼️ 이미지 갤러리</h3>
              <p className="text-slate-500 text-sm m-0">최근 저장된 10개의 일러스트레이션입니다.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {savedImages.map((img) => (
              <div key={img.id} className="group relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900 hover:border-blue-500 transition-all">
                <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                  <p className="text-[10px] text-slate-300 line-clamp-3 leading-tight">{img.prompt}</p>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => setImage(img.url)} 
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300"
                    >
                      크게 보기
                    </button>
                    <button 
                      onClick={() => handleDeleteImage(img.id)} 
                      className="text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIIllustrator;
