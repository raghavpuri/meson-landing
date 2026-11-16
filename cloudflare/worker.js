// Cloudflare Worker for mesonlabs.ai
//
// Serves the landing page at "/" from GitHub Pages and everything else from
// the demo app on Render, so the product itself lives at mesonlabs.ai/yc
// (and /login, /orders, /api/… underneath it) with no subdomain.
//
// Route: mesonlabs.ai/*   (the mesonlabs.ai DNS records must be Proxied)
// Render env: NEXTAUTH_URL=https://mesonlabs.ai

const APP_ORIGIN = "https://meson-demo.onrender.com";
const LANDING_PATHS = new Set(["/", "/index.html"]);

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Landing page → GitHub Pages (same-zone subrequest goes straight to the
    // origin behind the proxy; it does not re-enter this Worker).
    if (LANDING_PATHS.has(url.pathname)) {
      return fetch(request);
    }

    // Entry link from the YC application.
    if (url.pathname === "/yc" || url.pathname === "/yc/") {
      return Response.redirect(`${url.origin}/login`, 302);
    }

    // Everything else → the app.
    const upstream = new URL(url.pathname + url.search, APP_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    headers.delete("cf-connecting-ip");

    const init = {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    };
    const res = await fetch(upstream, init);

    // Keep the visitor on mesonlabs.ai if the app redirects to its own host.
    const out = new Headers(res.headers);
    const loc = out.get("location");
    if (loc && loc.startsWith(APP_ORIGIN)) out.set("location", url.origin + loc.slice(APP_ORIGIN.length));
    out.delete("content-security-policy");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
  },
};
