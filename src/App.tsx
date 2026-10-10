import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { HashRouter as Router, Navigate, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from './Layout';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Studio = lazy(() => import('./pages/Studio').then((module) => ({ default: module.Studio })));
const Catalogue = lazy(() => import('./pages/Works/Catalogue').then((module) => ({ default: module.Catalogue })));
const ProjectDetail = lazy(() => import('./pages/Works/ProjectDetail').then((module) => ({ default: module.ProjectDetail })));

function RoutePage({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <Suspense fallback={<div role="status" className="pt-40 pb-24 px-6 min-h-[100dvh] text-gray-600 dark:text-gray-400">{t('project.loading')}</div>}>{children}</Suspense>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<RoutePage><Home /></RoutePage>} />
          <Route path="studio" element={<RoutePage><Studio /></RoutePage>} />
          <Route path="works" element={<RoutePage><Catalogue /></RoutePage>} />
          <Route path="works/maps" element={<Navigate to="/works?type=bedrock" replace />} />
          <Route path="works/mods" element={<Navigate to="/works?type=mods" replace />} />
          <Route path="works/tools" element={<Navigate to="/works?type=tools" replace />} />
          <Route path="works/:slug" element={<RoutePage><ProjectDetail /></RoutePage>} />
          <Route path="contact" element={<Navigate to="/studio#contact" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
