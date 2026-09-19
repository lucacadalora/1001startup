'use strict';
/* Unit tests for the Lead Search engine, written against the Blibli run that
   produced the rules. Every case here is a mistake the pipeline actually made
   before the rule existed. Run: node scripts/leads-test.js */
const E = require('../lib/leads-engine.js');

let fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name
    + (ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`));
};

console.log('\n-- the (Current) gate --');
t('flat entry, current at target',
  E.parseProfile('# Didin Dimas\n## Experience\n### Head of Human Capital Blibli OMG - [Blibli](https://www.linkedin.com/company/blibli) (Current)\nAug 2024 - Present\n', 'Blibli').status,
  'current');

/* The bug that mattered: Juliarto's headline says "HRIS", he has a real Blibli
   history, and his CURRENT job is at L'Oreal. A sliding window counted him. */
t('current role at a DIFFERENT employer is rejected',
  E.parseProfile("# Juliarto\n## Experience\n### Total Rewards Director - [L'Oreal](https://www.linkedin.com/company/loreal) (Current)\nJan 2025 - Present\n### [Blibli](https://www.linkedin.com/company/blibli)\n#### AVP Compensation Benefit\n2019 - 2024\n", 'Blibli').status,
  'former');

const g = E.parseProfile('# Azizah\n## Experience\n### [Blibli.com](https://www.linkedin.com/company/blibli)\n#### Head of Business Process Transformation (Current)\nMar 2025 - Present\n#### VP of Return Management\n2020 - 2025\n', 'Blibli');
t('grouped entry detected as current', g.status, 'current');
t('grouped entry role parsed', g.role, 'Head of Business Process Transformation');

t('company never mentioned returns null',
  E.parseProfile('# Someone Else\n### Engineer - [Gojek](https://x) (Current)\n', 'Blibli'),
  null);

console.log('\n-- dummy and shared-mailbox rejection --');
t('jdoe is a dummy', E.isDummy('jdoe'), true);
t('firstlast is a dummy', E.isDummy('firstlast'), true);
t('john.smith is a dummy', E.isDummy('john.smith'), true);
t('lisa.widodo is not a dummy', E.isDummy('lisa.widodo'), false);
t('recruitment.x is a role box', E.ROLE_BOX.test('recruitment.blibliomnigroup'), true);
t('csirt is a role box', E.ROLE_BOX.test('csirt'), true);
t('lisa.widodo is not a role box', E.ROLE_BOX.test('lisa.widodo'), false);

console.log('\n-- format learning on the real Blibli corpus --');
const corpus = [
  ['lisa.widodo', 'Lisa Widodo'], ['agnes.cornelia', 'Agnes Cornelia'],
  ['irfan.maulana', 'Irfan Maulana'], ['argo.triwidodo', 'Argo Triwidodo'],
  ['anandita.humaira', 'Anandita Humaira'], ['eko.k.khannedy', 'Eko Kurniawan Khannedy'],
  ['andi.r.djunaedi', 'Andi Rustandi Djunaedi'], ['faza.putra', 'Faza Zulfika Permana Putra'],
  ['jdoe', 'John Doe'], ['recruitment', 'Recruitment Team'],
].map(([l, n]) => ({ email: l + '@gdn-commerce.com', name: n, sources: ['https://example/src'] }));

const pats = E.learnPatterns(corpus, []);
console.log('  learned:', pats.map((p) => `${p.pattern}:${p.observed}`).join('  '));
t('first.last is the winner', pats[0].pattern, 'first.last');
t('dummy and role box cast no vote (8 of 10 voted)',
  pats.reduce((a, p) => a + p.observed, 0), 8);
t('first.m.last is also observed', pats.some((p) => p.pattern === 'first.m.last' && p.observed === 2), true);

console.log('\n-- inference --');
const two = E.inferEmail('Meily Kristian', 'gdn-commerce.com', pats);
t('two-part name is inferred, not ambiguous', two.confidence, 'inferred');
t('two-part value', two.value, 'meily.kristian@gdn-commerce.com');

const three = E.inferEmail('Steven Kurniawan Tirto', 'gdn-commerce.com', pats);
t('three-part name is flagged ambiguous', three.confidence, 'ambiguous');
t('three-part offers the other convention', three.alternates.includes('steven.k.tirto@gdn-commerce.com'), true);
console.log('  three-part best:', three.value, '| alternates:', three.alternates.join(', '));

t('mononym collapses to first@', E.inferEmail('Indahwati', 'gdn-commerce.com', pats).value,
  'indahwati@gdn-commerce.com');
t('no domain means no guess', E.inferEmail('Someone Here', '', pats), null);



/* ── regressions found by the adversarial review (Aug 30 2026) ───────── */
console.log('\n-- employer matching must not swallow longer names --');
t('Grab does not match Grabfood',
  E.parseProfile('# X\n### Driver Partner - [Grabfood Indonesia](https://x) (Current)\n', 'Grab').status, 'former');
t('Ada does not match Adaro',
  E.parseProfile('# X\n### Analyst - [Adaro Energy](https://x) (Current)\n', 'Ada').status, 'former');
t('Paxel still matches Paxel Logistik Nusantara',
  E.parseProfile('# X\n### Founder - [Paxel Logistik Nusantara](https://x) (Current)\n', 'Paxel').status, 'current');
t('Blibli still matches Blibli.com',
  E.parseProfile('# X\n### Head of HC - [Blibli.com](https://x) (Current)\n', 'Blibli').status, 'current');
t('multi-word company matches in order',
  E.parseProfile('# X\n### CTO - [Kargo Technologies](https://x) (Current)\n', 'Kargo Technologies').status, 'current');

console.log('\n-- directory hosts can never become the mail domain --');
const NAC = require('../lib/leads-engine.js');
['rocketreach.co', 'leadiq.com', 'linkedin.com', 'kompas.com', 'crunchbase.com'].forEach(function (h) {
  t(h + ' is rejected as a company domain', /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|tiktok|wikipedia|wikimedia|crunchbase|tracxn|pitchbook|owler|zoominfo|rocketreach|leadiq|apollo|signalhire|aeroleads|lusha|glassdoor|indeed|jobstreet|kalibrr|glints|medium|substack|blogspot|wordpress|github|gitlab|techinasia|e27|dealstreetasia|kompas|detik|tempo|bisnis|kontan|katadata|cnbcindonesia|liputan6|tribunnews|jakartapost|reuters|bloomberg|forbes|google|bing|yahoo)\./i.test(h), true);
});

/* ── person lookup (Aug 30 2026) ─────────────────────────────────────
   "carikan email Ricky Hilmi Sudrajad" was expanded into CFO/procurement role
   queries because the pipeline had exactly one shape of brief. Detection must
   be deterministic — and must NOT eat sales briefs that mention email. */
console.log('\n-- person-brief detection --');
const P = E.parsePersonBrief;
t('carikan email <Name>', P('carikan email Ricky Hilmi Sudrajad'),
  { person: 'Ricky Hilmi Sudrajad', companyHint: '' });
t('lowercase name after a verb is title-cased', P('cari email budi santoso'),
  { person: 'Budi Santoso', companyHint: '' });
t('"di DOKU" tail becomes the company hint', P('carikan email Ricky Hilmi Sudrajad di DOKU'),
  { person: 'Ricky Hilmi Sudrajad', companyHint: 'DOKU' });
t('english form with "at"', P('find email of Budi Santoso at Kargo Technologies'),
  { person: 'Budi Santoso', companyHint: 'Kargo Technologies' });
t('no verb, capitalised name still works', P('email Budi Santoso'),
  { person: 'Budi Santoso', companyHint: '' });
t('honorific is stripped, not part of the name', P('carikan email pak Budi'),
  { person: 'Budi', companyHint: '' });
t('a sales brief that starts with "email" is NOT a person', P('email marketing tools for startups'), null);
t('a role is NOT a person', P('carikan email HR manager'), null);
t('a full sales brief is NOT a person', P('I sell an HRIS. I need whoever owns HR systems, the budget holder, and the IT gatekeeper.'), null);
t('a function word anywhere rejects person mode', P('carikan email tim finance DOKU'), null);
t('single lowercase word after a verb is a mailbox, not a mononym', P('carikan email support'), null);
t('too many words is a brief, not a name', P('carikan email untuk kebutuhan marketing perusahaan kami segera'), null);

console.log('\n-- name matching --');
t('degree suffixes do not break the match', E.nameMatches('Ricky Hilmi Sudrajad, S.Kom.', 'Ricky Hilmi Sudrajad'), true);
t('a missing token is a different person', E.nameMatches('Ricky Sudrajad', 'Ricky Hilmi Sudrajad'), false);
t('token order does not matter', E.nameMatches('Sudrajad, Ricky Hilmi', 'Ricky Hilmi Sudrajad'), true);

console.log('\n-- current employer extraction (for company-less person briefs) --');
t('flat shape: employer after the last dash',
  E.currentEmployersOf('# R\n## Experience\n### Head of Payment - [DOKU](https://x) (Current)\nJan 2024 - Present\n'),
  [{ employer: 'DOKU', role: 'Head of Payment' }]);
t('grouped shape: employer on ###, live role on ####',
  E.currentEmployersOf('# A\n## Experience\n### [Blibli.com](https://x)\n#### VP Engineering (Current)\nMar 2025 - Present\n#### Engineer\n2020 - 2025\n'),
  [{ employer: 'Blibli.com', role: 'VP Engineering' }]);
t('no live role means no employer', E.currentEmployersOf('# A\n### Analyst - [Adaro](https://x)\n2019 - 2023\n'), []);

/* ── shape evidence (Aug 30 2026) ────────────────────────────────────
   A DOKU person lookup found 21 real staff addresses, learned NOTHING from
   them (none belonged to the one person asked for), announced "no format could
   be learned — addresses will not be guessed", and then guessed one anyway
   from a hardcoded default. Shape reads the corpus; basis stops the console
   contradicting itself. */
console.log('\n-- structural shape of a local part --');
t('two dotted tokens are first.last', E.shapeOfLocal('anindya.maharani'), 'first.last');
t('leading initial is f.last', E.shapeOfLocal('a.maharani'), 'f.last');
t('middle initial is first.m.last', E.shapeOfLocal('eko.k.khannedy'), 'first.m.last');
t('three full tokens is first.middle.last', E.shapeOfLocal('andi.rustandi.djunaedi'), 'first.middle.last');
t('underscore form is recognised', E.shapeOfLocal('budi_santoso'), 'first_last');
t('a single token is NOT resolvable (first/flast/firstlast)', E.shapeOfLocal('marsya'), '');
t('digits disqualify a local part', E.shapeOfLocal('budi.santoso2'), '');

console.log('\n-- shape census over the real DOKU corpus --');
const doku = ['smb', 'anindya.maharani', 'ivan.boris', 'felix.frederic', 'amala.kristovia',
  'lupita.bothy', 'nico.abiawan', 'veranica.rachmani', 'marsya', 'yaka.ridho', 'dimas.haditya',
  'elysia', 'care', 'jdoe'].map((l) => ({ email: l + '@doku.com', sources: [] }));
const shapes = E.learnShapes(doku);
t('first.last wins on shape', shapes[0].pattern, 'first.last');
t('nine dotted pairs counted, mononyms and care@ and jdoe@ excluded', shapes[0].observed, 9);

console.log('\n-- basis: what the format rests on --');
t('name-pinned evidence is basis learned',
  E.inferEmail('Meily Kristian', 'gdn-commerce.com', pats).basis, 'learned');
t('shape-only evidence is basis shape',
  E.inferEmail('Ricky Hilmi Sudrajad', 'doku.com', [], shapes).basis, 'shape');
t('nothing at all is basis assumed',
  E.inferEmail('Ricky Hilmi Sudrajad', 'doku.com', [], []).basis, 'assumed');
t('shape still produces the right address',
  E.inferEmail('Ricky Hilmi Sudrajad', 'doku.com', [], shapes).value, 'ricky.sudrajad@doku.com');
t('a mononym is its own basis', E.inferEmail('Indahwati', 'doku.com', [], shapes).basis, 'mononym');

/* A discovered employer name goes back into a field that SPLITS ON COMMAS. */
console.log('\n-- legal-entity tail on a discovered employer --');
t('PT tail dropped', E.trimLegalTail('DOKU, PT NUSA SATU INTI ARTHA'), 'DOKU');
t('Tbk tail dropped', E.trimLegalTail('Bank Jago, Tbk'), 'Bank Jago');
t('Inc tail dropped', E.trimLegalTail('Kargo Technologies, Inc'), 'Kargo Technologies');
t('a non-legal tail is kept', E.trimLegalTail('Blibli, Tokopedia'), 'Blibli, Tokopedia');
t('no comma is untouched', E.trimLegalTail('Paxel'), 'Paxel');

/* ── name-first person briefs (Aug 31 2026) ──────────────────────────
   Run 24: "Search me ilham ali yafi, from reckitt, get me his email" put the
   email-word at the END of the sentence, so the email-first grammar never saw
   it — the brief fell to role expansion across the three stale companies still
   sitting in the form. Run 5 ("Try to search Luca professional email") was the
   same miss in different clothes. */
console.log('\n-- name-first person briefs --');
t('run 24: name first, employer in a "from" clause, request-tail at the end',
  P('Search me ilham ali yafi, from reckitt, get me his email'),
  { person: 'Ilham Ali Yafi', companyHint: 'reckitt' });
t('run 5: "try to search <Name> professional email"',
  P('Try to search Luca professional email'),
  { person: 'Luca', companyHint: '' });
t('"dari" clause carries the employer too', P('cari email budi santoso dari DOKU'),
  { person: 'Budi Santoso', companyHint: 'DOKU' });
t('an employer clause of function words is dropped, not searched',
  P('carikan email Budi di kantor'), { person: 'Budi', companyHint: '' });
t('a role hunt with a trailing email-word stays on the roles path',
  P('search design lead in blibli and its email'), null);
t('"get me leads at gojek" is not a person', P('get me leads at gojek'), null);
t('"search email blast vendors and get me their emails" is not a person',
  P('search email blast vendors and get me their emails'), null);

console.log('\n-- request-tail stripping --');
t('", get me his email" comes off',
  E.stripEmailTail('Search me ilham ali yafi, from reckitt, get me his email'),
  'Search me ilham ali yafi, from reckitt');
t('"professional email" comes off', E.stripEmailTail('Try to search Luca professional email'),
  'Try to search Luca');
t('a brief with no tail is untouched', E.stripEmailTail('who runs data at BRI'),
  'who runs data at BRI');

/* ── the planner's verbatim gate (Aug 31 2026) ───────────────────────
   The model may CLASSIFY a brief and it may QUOTE it; it may never compose.
   applyPlan is the pure gate between the model's reading and the pipeline. */
console.log('\n-- planner verbatim gate --');
const A = E.applyPlan;
t('a quoted person passes and is title-cased',
  A('Search me ilham ali yafi, from reckitt, get me his email',
    { mode: 'person', person: 'ilham ali yafi', companies: ['reckitt'], focus: '' }),
  { mode: 'person', person: 'Ilham Ali Yafi', companyHint: 'reckitt', companies: ['reckitt'], focus: '' });
t('a person the brief never spelled is REJECTED and degrades to roles',
  A('find me the DOKU HR contact person', { mode: 'person', person: 'Budi Santoso', companies: ['DOKU'], focus: 'HR' }).mode,
  'roles');
t('an invented company is discarded, the quoted one kept',
  A('i sell HRIS to blibli', { mode: 'roles', person: '', companies: ['Bloomberg Indonesia', 'blibli'], focus: 'HR systems' }).companies,
  ['blibli']);
t('focus survives as free steering text',
  A('search design lead in blibli and its email', { mode: 'roles', person: '', companies: ['blibli'], focus: 'design lead' }).focus,
  'design lead');
t('a null model answer is a null plan', A('anything', null), null);
t('a function word quoted as a person is still not a person',
  A('carikan email tim finance', { mode: 'person', person: 'tim finance', companies: [], focus: '' }).mode,
  'roles');

/* ── compound shared mailboxes (Aug 31 2026, the Reckitt run) ─────────
   consumercare_usa@ and consumerhealth_gb@ slip past ROLE_BOX (the role word
   is not in first position) and voted first_last as the domain's shape, six
   to four against the REAL staff addresses — so the run guessed ahmad_yafi@
   against its own evidence of windi.fitriyani@. */
console.log('\n-- compound shared mailboxes --');
t('consumercare_usa is a shared box', E.sharedMailbox('consumercare_usa'), true);
t('consumerhealth_gb is a shared box', E.sharedMailbox('consumerhealth_gb'), true);
t('cileungsi.recruitment is a shared box', E.sharedMailbox('cileungsi.recruitment'), true);
t('windi.fitriyani is a person', E.sharedMailbox('windi.fitriyani'), false);
t('rafal.oldakowski is a person', E.sharedMailbox('rafal.oldakowski'), false);
t('eko.k.khannedy is a person', E.sharedMailbox('eko.k.khannedy'), false);
const reckitt = ['consumercare_usa', 'consumerhealth_gb', 'mailtoconsumerhealth_gb',
  'consumercare_uk', 'consumercare_au', 'consumerrelations_nz', 'cileungsi.recruitment',
  'windi.fitriyani', 'ruchika.kaushik', 'rafal.oldakowski']
  .map((l) => ({ email: l + '@reckitt.com', sources: [] }));
const rshapes = E.learnShapes(reckitt);
t('the staff convention wins the Reckitt corpus', rshapes[0] && rshapes[0].pattern, 'first.last');
t('only the three real people voted', rshapes.reduce((a, s) => a + s.observed, 0), 3);

console.log(fail ? `\n${fail} FAILED\n` : '\nALL PASS\n');
process.exit(fail ? 1 : 0);
