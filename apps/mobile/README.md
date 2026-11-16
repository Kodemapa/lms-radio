# @obgyn/mobile

React Native via Expo SDK 54 with a **dev client** (Expo Go can't load our native
modules). `expo-screen-capture` enables capture blocking app-wide.

```bash
pnpm --filter @obgyn/mobile prebuild   # generate android/ and ios/
pnpm --filter @obgyn/mobile android    # or: ios
```

Bundle ids are placeholders (`com.example.obgynelms`). The starter code for native
capture blocking that CLAUDE.md mentions (`reference/`) isn't in the repo yet.
