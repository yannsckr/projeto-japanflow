import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'qa-report', 'qa-results'],
  },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],

    files: ['**/*.{ts,tsx}'],

    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },

    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      // Mantemos os problemas reais de hooks visíveis.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Em componentes shadcn/contextos/hooks compartilhados isso gera muito ruído.
      'react-refresh/only-export-components': 'off',

      // O projeto ainda possui integrações dinâmicas e payloads externos.
      // Vamos tipar isso gradualmente, sem travar o CI agora.
      '@typescript-eslint/no-explicit-any': 'off',

      // Já está tratado pelo TypeScript/uso atual do projeto.
      '@typescript-eslint/no-unused-vars': 'off',

      // Permite catches intencionalmente silenciosos como:
      // catch {}
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  }
);
