import { useEffect, useState } from 'react';
import { MenuView } from '../features/menu/MenuView';
import { ModeView } from '../features/mode/ModeView';
import { createContainer } from './container';

const container = createContainer();

function useRoute(): string {
  const read = () => window.location.hash.slice(1) || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const f = () => setRoute(read());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

function MenuRoute() {
  const [vm] = useState(() => container.createMenuViewModel());
  return <MenuView vm={vm} />;
}
function ModeRoute() {
  const [vm] = useState(() => container.createModeViewModel());
  return <ModeView vm={vm} />;
}

export function App() {
  const route = useRoute();
  if (route === '/') return <MenuRoute />;
  if (route === '/mode') return <ModeRoute />;
  return (
    <main className="screen"><div className="scene" aria-hidden="true" />
      <section className="panel menu"><h1 className="panel-title">Page à venir</h1>
        <p className="hint">{route}</p><a className="btn" href="#/">Retour au menu</a></section></main>
  );
}
