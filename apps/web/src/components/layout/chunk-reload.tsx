/**
 * A page asked for a script file the server no longer has: after a new deploy
 * (production, in tabs opened before it) or a dev-server restart. Reload once
 * to pick up the current files instead of showing "Application error".
 *
 * An inline script in <head>, so it is listening before the app's own scripts
 * load (the failure can happen while the page is still starting). At most one
 * reload per 30 s, so a file that is really missing can't cause a loop.
 */
export function ChunkReloadScript() {
  const code =
    `(function(){var K='gifs:chunk-reload-at';` +
    `function bad(e){if(!e||typeof e!=='object')return false;` +
    `return e.name==='ChunkLoadError'||/Loading (CSS )?chunk .* failed/i.test(String(e.message||''));}` +
    `function go(e){if(!bad(e))return;try{var t=+(sessionStorage.getItem(K)||0);` +
    `if(Date.now()-t<30000)return;sessionStorage.setItem(K,String(Date.now()));}catch(_){}` +
    `location.reload();}` +
    `addEventListener('error',function(ev){go(ev.error);});` +
    `addEventListener('unhandledrejection',function(ev){go(ev.reason);});})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
