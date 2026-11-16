# @obgyn/desktop

Electron shell around the web app with `setContentProtection(true)`, so screenshots
and screen recordings of the window come out black on macOS and Windows 10 2004+.

```bash
pnpm --filter @obgyn/web dev        # in one terminal
pnpm --filter @obgyn/desktop start  # opens the window (ELMS_WEB_URL overrides the URL)
pnpm --filter @obgyn/desktop dist   # build installers into release/
```

`appId` is a placeholder (`com.example.obgynelms`); set the real one before signing.
Linux has no capture blocking, so only the watermark protects content there.
