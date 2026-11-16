import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Page imports
import Landing from './pages/Landing';
import Search from './pages/app/Search';
import Import from './pages/app/Import';
import History from './pages/app/History';
import Settings from './pages/app/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/search" element={<Search />} />
        <Route path="/app/import" element={<Import />} />
        <Route path="/app/history" element={<History />} />
        <Route path="/app/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
