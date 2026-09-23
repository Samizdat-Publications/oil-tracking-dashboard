import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// React ignores a lowercase on* prop without a word, which is how the V5 state
// picker shipped dead (onchange from the converter). A one-rule local plugin,
// rather than eslint-plugin-react for one check.
const reactEvents = {
  rules: {
    'camel-case-events': {
      meta: { type: 'problem', docs: { description: 'React event props are camelCase' } },
      create: ctx => ({
        JSXAttribute(node) {
          const name = node.name && node.name.name
          if (typeof name === 'string' && /^on[a-z]+$/.test(name))
            ctx.report({ node, message: `${name} is ignored by React; did you mean on${name[2].toUpperCase()}${name.slice(3)}?` })
        },
      }),
    },
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // The ported JS modules. Plain JS gets no type check, so this is the only
    // thing that catches an undefined name or a dead import in them.
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-events': reactEvents },
    rules: {
      'react-events/camel-case-events': 'error',
      // step functions keep one signature (dt, P, t) whether or not they use t
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
])
