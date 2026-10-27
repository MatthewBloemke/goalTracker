// Temporary local visual check of the real home page and navigation; no API calls.
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === 'next/link') return ({ href, ...props }) => React.createElement('a', { href, ...props });
  if (name === 'next/navigation') return { usePathname: () => '/', useRouter: () => ({ push() {} }) };
  if (name === '@/components/providers/SupabaseProvider') return { useSupabase: () => ({ user: { id: 'preview' }, supabase: { auth: { signOut: async () => ({}) } } }) };
  if (name.startsWith('@mui/material-nextjs/')) return { AppRouterCacheProvider: ({ children }) => children };
  if (name.startsWith('@/')) name = path.resolve('src', name.slice(2));
  return originalLoad.call(this, name, parent, ...rest);
};
for (const extension of ['.tsx', '.ts']) Module._extensions[extension] = (entry, filename) => {
  let source = readFileSync(filename, 'utf8');
  if (filename.endsWith('MuiProvider.tsx')) source += '\nexport { createPortalMuiTheme };';
  entry._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
};
const { NavShell } = require('../src/components/ui/NavShell.tsx');
const { default: PortalHomePage } = require('../src/app/page.tsx');
const { createPortalMuiTheme } = require('../src/components/providers/MuiProvider.tsx');
const { getPortalTheme } = require('../src/lib/portal-themes.ts');
const { ThemeProvider, CssBaseline } = require('@mui/material');
const h = React.createElement;
(async () => {
  const css = (await require('postcss')([require('@tailwindcss/postcss')({ base: process.cwd() })]).process(readFileSync('src/app/globals.css', 'utf8'), { from: path.resolve('src/app/globals.css') })).css;
  createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:3187');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (url.pathname !== '/preview') {
      const [width, height] = url.searchParams.has('small') ? [320, 480] : url.searchParams.has('desktop') ? [1100, 750] : [390, 650];
      res.end(`<html><head><meta charset="utf-8"><title>Local home preview</title></head><body style="margin:0;background:#ddd;font:14px Arial"><p style="padding:12px">Local preview · <a href="/">Phone</a> · <a href="/?small">Small phone</a> · <a href="/?desktop">Desktop</a> · <a href="/?dark">Dark theme</a></p><iframe title="Home preview" style="display:block;border:0;margin:auto;width:${width}px;height:${height}px" src="/preview?${url.searchParams.toString()}"></iframe></body></html>`);
      return;
    }
    const theme = createPortalMuiTheme(getPortalTheme(url.searchParams.has('dark') ? 'midnight' : 'sunset'));
    const body = renderToString(h(ThemeProvider, { theme }, h(CssBaseline), h(NavShell, null, h(PortalHomePage))));
    res.end(`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>:root{--font-sans:Arial}</style></head><body>${body}</body></html>`);
  }).listen(3187, '127.0.0.1', () => console.log('Local home preview: http://127.0.0.1:3187'));
})();
