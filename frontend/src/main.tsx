import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/familjen-grotesk/latin-400.css';
import '@fontsource/familjen-grotesk/latin-500.css';
import '@fontsource/familjen-grotesk/latin-600.css';
import '@fontsource/syne/latin-700.css';
import '@fontsource/syne/latin-800.css';
import './styles/tokens.css';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
