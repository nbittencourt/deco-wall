import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// ESLint flat + typescript-eslint + react-hooks (ADR-10). Prettier cuida da formatação.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'tests/fixtures/imagens/**', 'tests/fixtures/paredes/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    // Scripts de Node (scripts/*.mjs): globais do runtime, sem depender do pacote `globals`.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', URL: 'readonly', console: 'readonly' },
    },
  },
  prettier,
);
