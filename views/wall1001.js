'use strict';
/**
 * 1001startup.id — the login wall's styles and search-engine note (slice 2,
 * Luca 18 Oct 2026: "make them blurred and popup signing just like
 * instagram/meta"). lib/account1001.js puts these in the <head> of a page;
 * public/js/wall1001.js does the counting and builds the card.
 *
 * The blur is a backdrop filter on html::after, so it costs one layer however
 * long the page is (/startups is 1.4 MB of table), and it is there from the
 * first paint when the reader's time is already used up. The card is appended
 * to <html>, outside <body>, so no stacking context a page sets on its body
 * can hide it; <body> itself goes inert while the wall is up.
 */

const css = `<style id="w1001-css">
html.w1001-on{overflow:hidden!important}
html.w1001-on::after{content:"";position:fixed;inset:0;z-index:2147482990;background:rgba(255,255,255,.38);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px)}
#w1001{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
#w1001 .w1001-c{position:relative;width:100%;max-width:440px;margin:auto;background:#fff;color:#000;border:1px solid #000;box-shadow:0 24px 70px rgba(0,0,0,.2);font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;text-align:left;outline:none}
#w1001 .w1001-c::before{content:"";display:block;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
#w1001 .w1001-in{padding:22px 26px 20px}
#w1001 .w1001-k{margin:0;display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73}
#w1001 .w1001-k i{width:6px;height:6px;background:#E8734B;display:inline-block}
#w1001 h2{margin:12px 0 0;padding:0;font:500 27px/1.12 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.025em;color:#000;text-wrap:balance}
#w1001 .w1001-s{margin:8px 0 0;font-size:15px;line-height:1.55;color:#52525B}
#w1001 iframe{display:block;width:100%;height:190px;margin:16px 0 0;border:0;background:#fff;color-scheme:light}
#w1001 .w1001-n{margin:14px 0 0;padding:12px 0 0;border-top:1px solid #E7E7E7;font-size:12.5px;line-height:1.55;color:#6B6B73}
#w1001 .w1001-t{margin:10px 0 0;font:400 11px/1.4 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#B3261E}
@media(max-width:560px){#w1001{padding:0}#w1001 .w1001-c{max-width:none;margin:auto 0 0;border-width:1px 0 0;box-shadow:0 -14px 44px rgba(0,0,0,.18)}#w1001 .w1001-in{padding:18px 18px calc(16px + env(safe-area-inset-bottom,0px))}#w1001 h2{font-size:23px}}
@media(prefers-reduced-motion:no-preference){#w1001 .w1001-c{animation:w1001in .3s cubic-bezier(.2,.8,.2,1)}}
@keyframes w1001in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
</style>`;

/* While the wall is switched on, every walled page says so to search engines
   (Google's markup for registration and paywalled content): the HTML Google
   fetches is the full page, the same as a first-time reader gets, and this
   keeps the card from being read as hiding content from people. */
const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage",'
  + '"isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,'
  + '"cssSelector":".w1001-gate"}}</script>';

module.exports = { css, ld };
