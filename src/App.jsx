import React, { useState, useEffect } from 'react';
import './App.css';
import AdminView from './components/AdminView';
import PublicView from './components/PublicView';
import WordCloudScreen from './components/WordCloudScreen';

function App() {
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setRoute(path);
  };

  // Fullscreen results — no app chrome
  if (route.startsWith('/results')) {
    return <WordCloudScreen />;
  }

  return (
    <div className="app-container">
      {route.startsWith('/admin') ? (
        <AdminView onNavigate={navigate} />
      ) : (
        <PublicView onNavigate={navigate} />
      )}
      
      <footer style={{ marginTop: 'auto', paddingTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Built with Antigravity • {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;
