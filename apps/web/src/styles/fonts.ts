// Fontes empacotadas no build (ADR-14, RNF-01): só o subconjunto latin, nenhuma requisição externa.
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/instrument-sans/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import newsreaderLatin from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url';

// O pacote da Newsreader traz todos os subconjuntos; registro só o latin (mesmo unicode-range do pacote).
const newsreader = new FontFace('Newsreader Variable', `url(${newsreaderLatin}) format('woff2-variations')`, {
  style: 'normal',
  weight: '200 800',
  display: 'swap',
  unicodeRange:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
});

newsreader.load().then((face) => document.fonts.add(face));
