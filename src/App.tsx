import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './Layout';
import { Home } from './pages/Home';
import { Studio } from './pages/Studio';
import { Maps } from './pages/Works/Maps';
import { Mods } from './pages/Works/Mods';
import { Tools } from './pages/Works/Tools';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="studio" element={<Studio />} />
          <Route path="works/maps" element={<Maps />} />
          <Route path="works/mods" element={<Mods />} />
          <Route path="works/tools" element={<Tools />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
