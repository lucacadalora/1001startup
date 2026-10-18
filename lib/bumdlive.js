'use strict';
/* The /bumd switch (regional state companies and joint operations, Luca 18 Oct 2026): the page,
   its menu item and the link block in each /bumn card show only while data/bumd.live exists
   (BUMD_PREVIEW=1 on a test port). Its own module so views/nav1001.js can read it without
   requiring the page. */
const { liveFlag } = require('./flaglive');

module.exports = { bumdLive: liveFlag('bumd.live', 'BUMD_PREVIEW') };
