# Novaris AI Progressive Web App

## Overview

Novaris AI is an ASP.NET Core MVC application that can be installed as a Progressive Web App (PWA). The PWA implementation makes the application shell available offline while keeping live chat and Ollama interactions network-only.

This distinction is intentional: an offline browser can still open the Novaris AI shell and receive an honest offline message, but it cannot generate a model response without the ASP.NET Core server and Ollama being available.

## PWA assets

All installable-app assets are served from `NovarisAI.Web/wwwroot`.

| Asset | Purpose |
| --- | --- |
| `manifest.webmanifest` | Defines the installable app name, colors, launch behavior, and icons. |
| `service-worker.js` | Controls static-asset caching, offline navigation fallback, and update activation. |
| `offline.html` | Provides a self-contained fallback page when a navigation cannot reach Novaris AI. |
| `icons/icon-192.png` | Standard 192×192 install icon. |
| `icons/icon-512.png` | Standard 512×512 install icon. |
| `icons/icon-192-maskable.png` | Maskable 192×192 install icon. |
| `icons/icon-512-maskable.png` | Maskable 512×512 install icon. |

The icon files are deterministic resizes of the existing Novaris compass mark in `wwwroot/favicon.png`.

## Manifest configuration

`wwwroot/manifest.webmanifest` configures Novaris AI as a standalone application:

```json
{
  "name": "Novaris AI",
  "short_name": "Novaris",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0d1220",
  "theme_color": "#0d1220"
}
```

The manifest also lists both standard and maskable PNG icons. The Razor layout links the manifest, Apple touch icon, and dynamic browser theme-color metadata:

```html
<meta name="theme-color" content="#f6f7f9" data-theme-color />
<link rel="manifest" href="~/manifest.webmanifest" />
<link rel="apple-touch-icon" href="~/icons/icon-192.png" />
```

The client updates `theme-color` whenever the user switches among Light, Dark, and Blue themes.

## Service-worker registration

`Scripts/site.ts` registers the root-scoped worker after the document is ready:

```typescript
navigator.serviceWorker.register("/service-worker.js", {
    scope: "/",
    updateViaCache: "none"
});
```

Registration is progressive enhancement. If the browser does not support service workers, or registration fails, the normal MVC application continues to work.

`updateViaCache: "none"` ensures the browser checks the network for worker updates instead of relying on a cached worker script.

## Cache strategy

The worker uses a versioned cache named `novaris-shell-v1`. It precaches the minimum safe application shell:

- The root page request and `offline.html`.
- The manifest, favicon, install icons, site CSS, compiled TypeScript, and DOM module.

### Static assets

Same-origin CSS, JavaScript, icon, favicon, and manifest requests use a cache-first strategy. If an asset is absent from the cache, it is fetched from the network and stored only after a successful response.

The static-asset lookup ignores query strings, allowing ASP.NET Core's versioned CSS and JavaScript URLs to use the precached resource safely.

### Navigation requests

HTML navigations use network-first behavior. The worker does not cache dynamic MVC pages or conversation views. If the server is unavailable, it returns `offline.html` from the cache instead.

This avoids storing conversation content or other dynamic data in Cache Storage.

### Chat and API requests

The worker passes through all non-GET requests and every cross-origin request. This includes:

- Chat form posts.
- Streaming chat responses from `Home/Stream`.
- Markdown-rendering posts.
- Any future authenticated or user-specific request.

These responses are never cached or replayed by the PWA.

## Update behavior

The worker does not call `skipWaiting()` automatically. A new version remains waiting until the user explicitly chooses **Update now** from the in-app update message.

Before activating an update, the client checks whether the chat form has `aria-busy="true"`. If a request is active, the update is not activated, preventing a streamed response from being interrupted. After the request completes, the user can choose the update again.

When activation is requested, the client sends a `SKIP_WAITING` message to the waiting worker. Once the new worker controls the page, the page reloads once to load the updated shell.

During activation, the worker removes only obsolete cache names starting with `novaris-` and claims its clients. It does not remove caches it does not own.

## Worker cache headers

`Program.cs` adds a response hook for `/service-worker.js`:

```csharp
context.Response.Headers.CacheControl = "no-cache";
```

This allows the browser to revalidate the worker reliably while `MapStaticAssets` continues to optimize ordinary static files.

## Offline experience

`offline.html` has no external dependencies. It tells the user that the application shell is available but chat requires both Novaris AI and Ollama, and provides a button to retry the navigation.

The existing Highlight.js CDN script is not needed by the offline fallback. It remains network-dependent for live syntax highlighting; if syntax highlighting becomes required in the offline shell, host it under `wwwroot` and add it to the worker's app-shell list.

## Verification checklist

Run the following checks after changing PWA assets:

```powershell
cd NovarisAI.Web
npm run build:client

cd ..
dotnet build NovarisAI.sln --no-restore
```

Validate the worker and manifest syntax:

```powershell
node --check NovarisAI.Web\wwwroot\service-worker.js
node --check NovarisAI.Web\wwwroot\js\site.js
Get-Content NovarisAI.Web\wwwroot\manifest.webmanifest -Raw | ConvertFrom-Json
```

In a browser, open DevTools **Application** panel and verify:

1. The manifest has the Novaris name, standalone display mode, and four valid icons.
2. The service worker has the `/` scope and is active.
3. The `novaris-shell-v1` cache contains only application-shell resources.
4. Offline navigation shows the Novaris offline page.
5. A chat post is not cached and reports an understandable connection error while offline.
6. Changing `cacheName` to a later version causes a new worker to wait and shows the update prompt.

Finally, run a Lighthouse PWA audit against a production-like HTTPS deployment. `localhost` is acceptable for local service-worker development, but non-localhost deployments require HTTPS.

## Local runtime troubleshooting

If the local application listens successfully but browser requests end prematurely, check the application output and Windows Event Viewer before diagnosing the PWA. In one development environment, an existing ASP.NET Core Data Protection key could not be decrypted and its error logger lacked Event Log permissions; that failure occurs before the PWA assets can be returned.

Do not delete Data Protection keys or change application data as part of PWA troubleshooting. Resolve the key-store identity and logging permissions separately, then repeat the browser verification steps.
