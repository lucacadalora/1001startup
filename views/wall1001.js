'use strict';
/**
 * 1001startup.id — the free-account card's styles. Until 23 Oct 2026 this was
 * a login wall (blur + sign-in card, no close button); Luca, 23 Oct 2026: "we
 * need to delete the 2 minute forced login, just make the popup maybe what
 * feature inside of it". lib/account1001.js puts these in the <head> of a page;
 * public/js/wall1001.js does the counting and builds the card.
 *
 * The card sits at the bottom left (the builder tab owns the bottom right) and
 * covers nothing else: no blur, the page stays readable and clickable. Phones
 * get a bottom sheet. It is appended to <html>, outside <body>, so no stacking
 * context a page sets on its body can hide it. It steps aside while the Follow
 * sign-in popup (html.f1001-on) or the builder card (#b1.is-open) is open.
 */

const css = `<style id="w1001-css">
#w1001{position:fixed;z-index:2147482900;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(400px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;overscroll-behavior:contain;background:#fff;color:#000;border:1px solid #000;box-shadow:0 18px 50px rgba(0,0,0,.18);font:500 15px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;text-align:left}
#w1001::before{content:"";display:block;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
html.f1001-on #w1001,html:has(#b1.is-open) #w1001{display:none}
#w1001 .w1001-in{padding:16px 18px 16px}
#w1001 .w1001-k{margin:0;padding-right:40px;display:flex;align-items:center;gap:8px;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73}
#w1001 .w1001-k i{width:6px;height:6px;background:#E8734B;display:inline-block}
#w1001 .w1001-x{position:absolute;top:12px;right:12px;width:34px;height:34px;margin:0;padding:0;border:1px solid #E7E7E7;background:#fff;color:#000;font:400 16px/1 'IBM Plex Mono',monospace;cursor:pointer;border-radius:0}
#w1001 .w1001-x:hover{border-color:#000}
#w1001 h2{margin:10px 0 0;padding:0;font:500 21px/1.18 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.02em;color:#000;text-wrap:balance}
#w1001 ul{list-style:none;margin:12px 0 0;padding:0;border-top:1px solid #E7E7E7}
#w1001 li{display:grid;grid-template-columns:76px 1fr;gap:10px;padding:9px 0;border-bottom:1px solid #E7E7E7;font-size:14px;line-height:1.45;color:#3F3F46}
#w1001 li b{font:400 11px/1.9 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#000}
#w1001 .w1001-a{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:14px 0 0}
#w1001 .w1001-go{margin:0;padding:11px 16px;border:1px solid #000;background:#000;color:#fff;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;border-radius:0}
#w1001 .w1001-go:hover{background:#27272A}
#w1001 .w1001-no{margin:0;padding:6px 0;border:0;background:none;color:#52525B;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
#w1001 .w1001-no:hover{color:#000}
#w1001 button:focus-visible{outline:2px solid #E8734B;outline-offset:2px}
#w1001 .w1001-s{margin:6px 0 0;font-size:14px;line-height:1.5;color:#52525B}
#w1001 iframe{display:block;width:100%;height:190px;margin:12px 0 0;border:0;background:#fff;color-scheme:light}
#w1001 .w1001-n{margin:12px 0 0;font-size:12.5px;line-height:1.5;color:#6B6B73}
#w1001 .w1001-t{margin:8px 0 0;font:400 11px/1.4 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#B3261E}
@media(max-width:560px){#w1001{left:0;right:0;bottom:0;width:auto;max-height:85vh;border-width:1px 0 0;box-shadow:0 -14px 44px rgba(0,0,0,.18)}#w1001 .w1001-in{padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px))}#w1001 h2{font-size:19px}}
@media(prefers-reduced-motion:no-preference){#w1001{animation:w1001in .3s cubic-bezier(.2,.8,.2,1)}}
@keyframes w1001in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
</style>`;

module.exports = { css };
