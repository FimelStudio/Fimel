import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { WorkLayout } from './WorkLayout';
import { MaterialCard } from '../../components/cards/MaterialCard';
import { useWorksData } from '../../hooks/useWorksData';

export const Mods: React.FC = () => {
  const { isDark, basePath } = useOutletContext<{ isDark: boolean; basePath: string }>();
  const { modsEntries } = useWorksData();
  
  return (
    <WorkLayout page="mods" isDark={isDark} basePath={basePath}>
      <div className="space-y-16">
        {modsEntries.map((work, idx) => (
          <MaterialCard key={work.title} work={work} idx={idx} basePath={basePath} />
        ))}
      </div>
    </WorkLayout>
  );
};
