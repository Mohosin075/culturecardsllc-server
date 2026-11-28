import { Response } from 'express'
import { StatusCodes } from 'http-status-codes'

/**
 * A small page that sends the user from a browser (Stripe Checkout, Stripe
 * onboarding) straight back into the mobile app. Stripe only accepts http(s)
 * return URLs, so it lands here first and this page opens the app's
 * `culturecards://…` link, with a button in case the browser asks first.
 */
export const renderAppBounce = (
  res: Response,
  opts: { heading: string; body: string; deepLink: string; button?: string },
): void => {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
  res.status(StatusCodes.OK).send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ARIES</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; background: #11111A; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    padding: 24px; text-align: center;
  }
  .card { max-width: 420px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  p { color: rgba(255,255,255,.65); font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
  a {
    display: inline-block; background: #8B9BFF; color: #0F0B1E; text-decoration: none;
    padding: 14px 28px; border-radius: 16px; font-weight: 700; font-size: 14px;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>${esc(opts.heading)}</h1>
    <p>${esc(opts.body)}</p>
    <a href="${esc(opts.deepLink)}">${esc(opts.button || 'Return to ARIES')}</a>
  </div>
  <script>setTimeout(function () { window.location.replace(${JSON.stringify(opts.deepLink)}) }, 400)</script>
</body>
</html>`)
}
