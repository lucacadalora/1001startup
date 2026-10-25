#!/usr/bin/env node
'use strict';
/* Tests for lib/leadagent1001.js (the lead agent inside Ask 1001), offline: a fake
 * Firecrawl answers every call, the database is in memory, the switch file is
 * a temp file. Checks the switch, the free preview, the paid fallback and its
 * day cap, saving, reveal (once per person), name matching, the CSV, and the
 * engine wiring (lead tools offered only with `leads`, emails kept only when a
 * lead tool returned them). No network, no credits. Exits 1 on any failure.
 *
 *   node scripts/leadagent1001-test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const createLeads = require('../lib/leadagent1001');
const createAsk = require('../lib/ask1001');

let fails = 0;
let passes = 0;
function ok(cond, what) {
  if (cond) { passes++; console.log('  ok  ', what); } else { fails++; console.log('  FAIL', what); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'leadagent1001-'));
const FLAG = path.join(tmp, 'leadagent.live');
process.env.LEADAGENT_FILE_1001 = FLAG;
process.env.FIRECRAWL_API_KEY = 'fc-test';

/* the fake: apolloMode 'ok' | 'terms' | 'empty'; every request is recorded */
const seen = [];
let apolloMode = 'ok';
function reply(o, status = 200) { return { ok: status < 400, status, json: async () => o }; }
async function fakeFetch(url, opts = {}) {
  if (/credit-usage/.test(url)) return reply({ success: true, data: { remainingCredits: 80, planCredits: 1000, billingPeriodEnd: '2026-11-22T21:23:46Z' } });
  const body = JSON.parse(opts.body);
  seen.push(body);
  const c0 = body.alexandria[0];
  if (c0.provider === 'apollo' && c0.capability === 'people/search') {
    if (apolloMode === 'terms') return reply({ success: false, code: 'THIRD_PARTY_DATA_TERMS_REQUIRED', error: 'An organization admin must accept the apollo provider\'s terms' }, 403);
    const people = apolloMode === 'empty' ? [] : [
      { id: 'ap1', first_name: 'Sari', last_name: 'W***', title: 'Head of Partnerships', organization: { name: 'Xendit', primary_domain: 'xendit.co' }, has_email: true },
      { id: 'ap2', first_name: 'Budi', last_name: 'S***', title: 'Partnerships Manager', organization: { name: 'Xendit' }, has_email: false },
    ];
    return reply({ success: true, data: { alexandria: [{ provider: 'apollo', capability: 'people/search', creditsCost: 0, data: { people } }], creditsCost: 0 } });
  }
  if (c0.provider === 'fullenrich' && c0.capability === 'people/search') {
    const n = c0.options.limit;
    const people = Array.from({ length: n }, (_, i) => ({
      id: 'fe' + i, full_name: 'Dewi Lestari ' + i, first_name: 'Dewi', last_name: 'Lestari ' + i, headline: 'BD',
      location: { city: 'Jakarta', country: 'Indonesia' }, social_profiles: { professional_network: { url: 'https://www.linkedin.com/in/dewi' + i } },
      employment: { current: { title: 'Business Development Lead', company: { name: 'Xendit', domain: 'xendit.co' } } },
    }));
    return reply({ success: true, data: { alexandria: [{ provider: 'fullenrich', capability: 'people/search', creditsCost: 5 * n, data: { people, metadata: { total: 11 } } }], creditsCost: 5 * n } });
  }
  /* reveals: one item per call */
  const items = body.alexandria.map((c) => {
    if (c.provider === 'apollo') {
      return { provider: 'apollo', capability: 'people/match', creditsCost: 30, data: { person: { id: c.options.id, name: 'Sari Wulandari', last_name: 'Wulandari', email: 'sari@xendit.co', email_status: 'verified', linkedin_url: 'https://www.linkedin.com/in/sari' } } };
    }
    return { provider: 'fullenrich', capability: 'contacts/work-email', creditsCost: 30, data: { results: [{ contact_info: { most_probable_work_email: { email: 'dewi@xendit.co', status: 'DELIVERABLE' } } }] } };
  });
  return reply({ success: true, data: { alexandria: items, creditsCost: items.reduce((s, x) => s + x.creditsCost, 0) } });
}

(async () => {
  const db = new Database(':memory:');
  const alerts = [];
  const L = createLeads({ db, root: tmp, fetchImpl: fakeFetch, dayCap: 100, alert: (t) => alerts.push(t) });

  console.log('\nswitch');
  ok(!L.allowed(2), 'no data/leadagent.live: nobody');
  fs.writeFileSync(FLAG, '# Luca\n2\n');
  await new Promise((r) => setTimeout(r, 10));
  const L2 = createLeads({ db, root: tmp, fetchImpl: fakeFetch, dayCap: 100, alert: (t) => alerts.push(t) });
  ok(L2.allowed(2) && !L2.allowed(3) && !L2.allowed('2'), 'leadagent.live lists 2: only account 2');

  console.log('\nfind: the free preview');
  let r = await L2.find(2, { domain: 'https://www.xendit.co/en', company: 'Xendit', companyId: 'xendit', titles: ['partnerships'] });
  ok(r.ok && r.people.length === 2 && r.credits_used === 0, 'two people, no credits');
  ok(seen[0].alexandria[0].options.q_organization_domains_list[0] === 'xendit.co' && seen[0].alexandria[0].options.person_locations[0] === 'Indonesia', 'domain normalised, Indonesia by default');
  ok(r.people[0].ref === 'p1' && r.people[0].name === 'Sari W***' && r.people[0].email === 'can be revealed' && r.masked, 'masked surname kept, ref given, email flag');
  ok(L2.list(2).length === 2 && L2.list(2)[0].company_id === 'xendit', 'saved with the census id');
  const n0 = seen.length;
  r = await L2.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['partnerships'] });
  ok(L2.list(2).length === 2 && seen.length === n0 && r.credits_used === 0 && /nothing spent/.test(r.note), 'the same search again: from the list, no call');
  r = await L2.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['partnerships', 'bd'] });
  ok(L2.list(2).length === 2 && seen.length === n0 + 1, 'other role words: searched again, people not saved twice');

  console.log('\nfind: the paid fallback and the day cap');
  apolloMode = 'terms';
  r = await L2.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['bd'], limit: 8 });
  ok(r.ok && r.people.length === 5 && r.credits_used === 25, 'preview refused: paid search, 5 people at most, 25 credits');
  ok(r.people[0].name === 'Dewi Lestari 0' && r.people[0].linkedin === 'on the leads list', 'full name, LinkedIn kept for the list only');
  ok(L2.usedToday() === 25, 'credits counted for the day');
  apolloMode = 'empty';
  r = await L2.find(2, { company: 'Some Firm', titles: ['cto'], location: 'any' });
  const last = seen[seen.length - 1].alexandria[0];
  ok(last.options.current_company_names && !last.options.person_locations, 'no domain: by company name; location any = everywhere');

  console.log('\nreveal');
  const before = seen.length;
  r = await L2.reveal(2, { refs: ['p1'] });
  ok(r.ok && r.people[0].email === 'sari@xendit.co' && r.people[0].name === 'Sari Wulandari' && r.credits_used === 30, 'preview person: full name + email, 30 credits');
  r = await L2.reveal(2, { names: ['Sari W***'], company: 'Xendit' });
  ok(r.ok && r.people[0].email === 'sari@xendit.co' && r.credits_used === 0 && seen.length === before + 1, 'asked again by name: from the list, no call, no credits');
  r = await L2.reveal(2, { names: ['Dewi Lestari 0', 'Dewi Lestari 1', 'Dewi Lestari 2', 'Dewi Lestari 3'], company: 'xendit' });
  ok(r.ok && r.people.length === 3 && r.not_done && r.not_done.length === 1, 'at most 3 a call, the rest named');
  ok(L2.usedToday() <= 100, `day cap holds (${L2.usedToday()} of 100)`);
  ok(r.people.filter((p) => /not revealed: today/.test(p.note || '')).length >= 1, 'past the cap: not revealed, said so');
  ok(alerts.length === 1 && /80 people-search credits left/.test(alerts[0]), 'low balance alert sent once');
  console.log('\nreveal timeout');
  const db3 = new Database(':memory:');
  let slow = true;
  const L3 = createLeads({ db: db3, root: tmp, dayCap: 100, revealMs: 50, fetchImpl: async (url, o) => {
    if (/credit-usage/.test(url)) return reply({ success: true, data: { remainingCredits: 900 } });
    if (slow && /work-email/.test(o.body)) {
      return new Promise((res, rej) => o.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
    }
    return fakeFetch(url, o);
  } });
  apolloMode = 'terms';
  await L3.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['x'], limit: 1 });
  const u0 = L3.usedToday();
  r = await L3.reveal(2, { refs: ['p1'] });
  ok(!r.ok && /not looked up again/.test(r.error) && L3.usedToday() === u0 + 30, 'timeout: counted as charged (30), told not to retry');
  slow = false;
  const n1 = seen.length;
  r = await L3.reveal(2, { refs: ['p1'] });
  ok(r.ok && /did not finish/.test(r.people[0].note) && seen.length === n1, 'asked again within 15 min: held, no second charge');
  r = await L2.reveal(2, { names: ['Nobody Here'] });
  ok(!r.ok && /find_people first/.test(r.error), 'unknown name: find first');
  r = await L2.reveal(3, { refs: ['p1'] });
  ok(!r.ok, 'another account cannot reveal account 2\'s people');

  console.log('\nExa first, census founders, profile emails');
  process.env.EXA_API_KEY = 'exa-test';
  const exaSeen = [];
  const job = (title, co, to = null) => ({ title, dates: { from: '2024-01-01', to }, company: { name: co } });
  const prof = (slug, name, jobs, text = '') => ({ url: `https://id.linkedin.com/in/${slug}`, title: name, text: `# ${name}\n\n${text}`,
    entities: [{ type: 'person', properties: { name, firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join(' '), location: 'Jakarta, Indonesia', workHistory: jobs } }] });
  const exaFetch = async (url, o) => {
    if (/api\.exa\.ai/.test(url)) {
      exaSeen.push(JSON.parse(o.body));
      return reply({ costDollars: { total: 0.007 }, results: [
        prof('moses-lo', 'Moses Lo', [job('CEO & Co-Founder', 'Xendit')]),
        prof('ana-x', 'Ana Putri', [job('Head of Partnerships', 'Xendit Group')], 'Send your CV -ana.putri@xendit.co or ana@gmail.com'),
        prof('ana-x-2', 'Ana Putri', [job('Partnerships', 'Xendit')]),
        prof('old-x', 'Budi Lama', [job('Partnerships', 'Xendit', '2023-01-01'), job('BD', 'ByteDance')]),
        prof('other', 'Tommy Bong', [job('Head of Payments', 'ByteDance Indonesia')]),
        { url: 'https://linkedin.com/in/text-only', title: 'Rina Sari', text: '# Rina Sari\n\n## Experience\n\n### [Xendit](https://www.linkedin.com/company/xendit)\n\n#### Partnerships Lead (Current)\n\nJan 2025 - Present' },
      ] });
    }
    return fakeFetch(url, o);
  };
  const db4 = new Database(':memory:');
  const L4 = createLeads({ db: db4, root: tmp, dayCap: 100, exaDayMax: 1, fetchImpl: exaFetch });
  /* Moses was found and revealed before, through the paid search: same LinkedIn profile */
  db4.prepare(`INSERT INTO lead_people (user_id, src, ext_id, full_name, first_name, last_name, title, company, linkedin, email, email_status, revealed_at)
    VALUES (2, 'f', 'fe-moses', 'Moses Lo', 'Moses', 'Lo', 'CEO', 'Xendit', 'https://www.linkedin.com/in/moses-lo', 'moses@xendit.co', 'DELIVERABLE', datetime('now'))`).run();
  /* Rina too, under another profile than the one the search will bring */
  db4.prepare(`INSERT INTO lead_people (user_id, src, ext_id, full_name, first_name, last_name, title, company, company_id, email, email_status, revealed_at)
    VALUES (2, 'f', 'fe-rina', 'Rina Sari', 'Rina', 'Sari', 'Partnerships', 'Xendit', 'xendit', 'rina@xendit.co', 'DELIVERABLE', datetime('now'))`).run();
  const fs0 = seen.length;
  r = await L4.find(2, { domain: 'https://www.xendit.co', company: 'Xendit', companyId: 'xendit', titles: ['CEO', 'partnerships'], founders: ['Moses Lo', 'Tessa Wijaya', 'Hendry'], aliases: ['PT Sinar Digital Terdepan'] });
  const names = r.people.map((p) => p.name).join(', ');
  ok(r.ok && seen.length === fs0 && exaSeen.length === 1 && /xendit\.co/.test(exaSeen[0].query) && exaSeen[0].category === 'people', 'Exa asked first, nothing else called');
  ok(names === 'Moses Lo, Ana Putri, Rina Sari', `only current jobs at the company kept (${names})`);
  ok(r.people[1].email === 'ana.putri@xendit.co' && /profile/.test(r.people[1].email_status), 'an email published on the profile is kept (no stray dash); gmail is not');
  ok(r.people[0].email === 'moses@xendit.co' && L4.list(2).filter((x) => x.full_name === 'Moses Lo').length === 1, 'a profile found before is the same person: one row, its paid email kept');
  ok(L4.list(2).filter((x) => x.full_name === 'Ana Putri').length === 1, 'two profiles with one name in a search: one person');
  const rina = r.people.find((x) => x.name === 'Rina Sari');
  ok(rina && rina.email === 'rina@xendit.co' && L4.list(2).filter((x) => x.full_name === 'Rina Sari').length === 1, 'same name at the same company, another profile: one person, paid email kept');
  ok(r.founders_on_record && r.founders_on_record.map((p) => p.name).join() === 'Tessa Wijaya,Hendry', 'founders on record added, the one the search found not twice');
  ok(r.credits_used === 0 && L4.usedToday() === 0, 'no Firecrawl credits spent');
  const rh = await L4.reveal(2, { names: ['Hendry'], company: 'Xendit' });
  ok(rh.ok && /only one name/.test(rh.people[0].note), 'single-name founder: no lookup, nothing charged');
  const ra = await L4.reveal(2, { names: ['Ana Putri'], company: 'Xendit' });
  ok(ra.ok && ra.credits_used === 0 && /own profile/.test(ra.people[0].note), 'a profile email needs no paid reveal');
  r = await L4.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['engineering'] });
  ok(exaSeen.length === 1, 'Exa day limit reached: not called again');
  r = await L4.find(2, { domain: 'xendit.co', company: 'Xendit', titles: ['partnerships', 'CEO'], founders: ['Moses Lo', 'Tessa Wijaya', 'Hendry'] });
  ok(r.note && /nothing spent/.test(r.note) && r.founders_on_record && r.founders_on_record.length === 2, 'repeat search from the list still brings the founders');
  delete process.env.EXA_API_KEY;

  console.log('\nCSV');
  db.prepare("UPDATE lead_people SET title = '=HYPERLINK(\"x\")' WHERE id = 2").run();
  const csv = L2.csv(2);
  ok(csv.split('\r\n')[0].startsWith('name,title,company,domain,email'), 'header');
  ok(csv.includes('"\'=HYPERLINK(""x"")"'), 'a formula-looking cell is quoted and defused');
  ok(csv.includes('sari@xendit.co'), 'revealed email in the CSV');

  console.log('\nengine wiring');
  const ask = createAsk({ root: path.join(__dirname, '..'), keyFile: '', model: '' });
  const sp = ask._t.systemPrompt({ asof: 'x', today: 'y', pageLang: 'en', n: { startups: 1, bumn: 1, subs: 1, dcs: 1, closed: 1 }, scope: 'people', leads: true });
  ok(/lead agent is on/.test(sp) && /find_people/.test(sp) && !/coming soon/.test(sp), 'lead prompt replaces the coming-soon rule');
  const sp0 = ask._t.systemPrompt({ asof: 'x', today: 'y', pageLang: 'en', n: { startups: 1, bumn: 1, subs: 1, dcs: 1, closed: 1 }, scope: '' });
  ok(/coming soon/.test(sp0) && !/find_people/.test(sp0), 'reader prompt unchanged');
  ok(!ask._t.TOOL_DEFS.some((t) => t.function.name === 'find_people'), 'lead tools are not in the reader tool list');
  const keep = new Set(['sari@xendit.co']);
  const c = ask._t.cleanAnswer('Sari: sari@xendit.co, guess: budi@xendit.co. See [your leads](/me/leads).', keep);
  ok(c.includes('sari@xendit.co') && !c.includes('budi@xendit.co') && c.includes('](/me/leads)'), 'answer keeps returned emails only, links the list');
  const c0 = ask._t.cleanAnswer('mail sari@xendit.co [x](/me/leads)');
  ok(!c0.includes('@') && !c0.includes('](/me/leads)'), 'reader answer: no email, no leads link');
  ok(/^Finding people at Xendit: partnerships/.test(ask._t.label('find_people', { company: 'Xendit', titles: ['partnerships'] }, 'en')), 'step label');

  console.log('\nengine run against a local mock of the chat API');
  const http = require('http');
  const bodies = [];
  const gw = http.createServer((req, res) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const j = JSON.parse(b);
      bodies.push(j);
      const toolTurn = !j.messages.some((m) => m.role === 'tool');
      const msg = toolTurn && j.tools.some((t) => t.function.name === 'get_contact')
        ? { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_contact', arguments: '{"refs":["p1"]}' } }] }
        : { role: 'assistant', content: 'Sari: sari@xendit.co (guess: budi@xendit.co). All on your [leads list](/me/leads).' };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: msg, finish_reason: msg.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  await new Promise((r) => gw.listen(0, '127.0.0.1', r));
  const keyFile = path.join(tmp, 'k');
  fs.writeFileSync(keyFile, 'test-key');
  const ask2 = createAsk({ root: path.join(__dirname, '..'), keyFile, model: 'test-model', url: `http://127.0.0.1:${gw.address().port}/v1/chat/completions` });
  const steps = [];
  const leadsFor2 = { find: (a) => L2.find(2, a), reveal: (a) => L2.reveal(2, a) };
  const run1 = await ask2.run({ q: 'email for Sari at Xendit', lang: 'en', scope: 'people', leads: leadsFor2, onStep: (s) => steps.push(s.tool) });
  ok(bodies[0].tools.some((t) => t.function.name === 'find_people') && bodies[0].tools.some((t) => t.function.name === 'get_contact'), 'with leads: both lead tools offered');
  ok(run1.ok && steps.join() === 'get_contact', 'the model\'s get_contact call ran');
  ok(run1.ok && run1.answer.includes('sari@xendit.co') && !run1.answer.includes('budi@xendit.co') && run1.answer.includes('](/me/leads)'), 'answer: the revealed email stays, a guessed one goes');
  bodies.length = 0;
  const run2 = await ask2.run({ q: 'email for Sari at Xendit', lang: 'en', scope: 'people' });
  ok(!bodies[0].tools.some((t) => t.function.name === 'find_people') && !/lead agent is on/.test(bodies[0].messages[0].content), 'without leads: no lead tools, no lead prompt, people scope ignored');
  ok(run2.ok && !run2.answer.includes('@') && !run2.answer.includes('](/me/leads)'), 'without leads: no email, no leads link');
  gw.close();

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
