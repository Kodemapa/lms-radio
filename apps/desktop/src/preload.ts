import { contextBridge } from 'electron';

// Lets the web app know it is running inside the protected desktop shell.
contextBridge.exposeInMainWorld('elmsDesktop', {
  isDesktop: true,
  platform: process.platform,
});
