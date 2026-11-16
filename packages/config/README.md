# @obgyn/config

Shared configuration for every workspace package.

| File | Used by |
|---|---|
| `tsconfig/base.json` | Everything (strict TypeScript) |
| `tsconfig/library.json` | Compiled libraries (`@obgyn/types`) |
| `tsconfig/react-library.json` | Source-only React libraries (`@obgyn/ui`) |
| `tsconfig/nextjs.json` | `apps/web` |
| `tsconfig/nest.json` | `apps/api` (decorators + CommonJS) |
| `tsconfig/node.json` | `apps/desktop` (Electron main process) |
| `eslint/base.js` | Flat ESLint config for all TypeScript packages |
