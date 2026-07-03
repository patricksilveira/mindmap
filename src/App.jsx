import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'editor'
  const [activeMapId, setActiveMapId] = useState(null);
  const [theme, setTheme] = useState(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('mindmap-theme');
    if (savedTheme) return savedTheme;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mindmap-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleOpenMap = (mapId) => {
    setActiveMapId(mapId);
    setCurrentView('editor');
  };

  const handleBackToDashboard = () => {
    setActiveMapId(null);
    setCurrentView('dashboard');
  };

  return (
    <div className="app-container">
      {currentView === 'dashboard' ? (
        <Dashboard 
          onOpenMap={handleOpenMap} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      ) : (
        <Editor 
          mapId={activeMapId} 
          onBack={handleBackToDashboard} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      )}
    </div>
  );
}

export default App;
