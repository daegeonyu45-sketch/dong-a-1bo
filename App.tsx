
import React, { useState } from 'react';
import NetflixIntro from './components/NetflixIntro';
import ReporterLayout from './components/ReporterLayout';
import ViewerLayout from './components/ViewerLayout';

const App: React.FC = () => {
  const [mode, setMode] = useState<'intro' | 'reporter' | 'viewer'>('intro');
  const [isMockMode, setIsMockMode] = useState(false);

  if (mode === 'intro') {
    return <NetflixIntro onSelectMode={(m) => setMode(m)} />;
  }

  if (mode === 'reporter') {
    return (
      <ReporterLayout 
        onExit={() => setMode('intro')} 
        isMockMode={isMockMode} 
        setIsMockMode={setIsMockMode} 
      />
    );
  }

  if (mode === 'viewer') {
    return (
      <ViewerLayout 
        onExit={() => setMode('intro')} 
        isMockMode={isMockMode} 
        setIsMockMode={setIsMockMode} 
      />
    );
  }

  return null;
};

export default App;
