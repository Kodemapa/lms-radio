import base from '@obgyn/config/eslint/base.js';

export default [
  ...base,
  {
    rules: {
      // Nest DI needs runtime class references for emitDecoratorMetadata;
      // `import type` on an injected class silently breaks injection.
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
