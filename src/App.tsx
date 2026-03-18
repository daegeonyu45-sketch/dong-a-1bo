import React, { useState } from 'react';
import NetflixIntro from '../components/NetflixIntro';
import ReporterLayout from '../components/ReporterLayout';
import ViewerLayout from '../components/ViewerLayout';

const App: React.FC = () => {
  const [mode, setMode] = useState<'reporter' | 'viewer' | null>(null);

  if (!mode) {
    return <NetflixIntro onSelectMode={setMode} />;
  }

  const handleExit = () => setMode(null);

  return (
    <div className="min-h-screen bg-[#f4f1ec]">
      {mode === 'reporter' ? (
        <ReporterLayout 
          onExit={handleExit} 
        />
      ) : (
        <ViewerLayout 
          onExit={handleExit} 
        />
      )}
    </div>
  );
};

export default App;
