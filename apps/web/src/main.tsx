import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts';
import './styles/theme.css';
import { App } from './ui/telas/App';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root não encontrado em index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
