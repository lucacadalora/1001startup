'use strict';
/* Public company contacts: what may be printed on a company page or served by
 * the company-graph API. data/company-contacts.json (scripts/company-contacts.py)
 * keeps everything its page scrape found, with the page each value came from;
 * this filter decides what is published. scripts/build-company-graph.py applies
 * the same rules in clean_contact(); change both together.
 *
 *   email   a mailbox shape with a real top-level domain. Scrape debris such as
 *           "ic-round-info@2x.png" (an image file name) or "u003ecare@…" (an
 *           escaped ">") is dropped or repaired.
 *   phone   Indonesian landlines (0 + area code 2-7), the 0800/0804 toll and
 *           premium lines, and 3-7 digit hotlines starting with 1 (14045,
 *           1500xxx). Mobile numbers (08…, +628…) are not published: on a
 *           contact page they are as often one salesperson's own phone as the
 *           company's line, and the page cannot tell which. Foreign numbers
 *           are not published either.
 *   url     careers pages, websites and LinkedIn company pages: http(s) only. */

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/;
const FILE_TLD = /\.(png|jpe?g|gif|webp|svg|ico|css|js|json|pdf)$/;

function email(v) {
  let s = String(v || '').trim().toLowerCase().replace(/^mailto:/, '');
  s = s.replace(/^(u003[ce]|&gt;|&lt;|>|<)+/, '');
  return EMAIL.test(s) && !FILE_TLD.test(s) ? s : null;
}

/* returns { value: national display form, tel: +62… dial form } or null */
function phone(v) {
  let s = String(v || '');
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  s = s.replace(/[\s ]/g, '').replace(/^\/+/, '').replace(/^\+{2,}/, '+');
  s = s.replace(/[()\-.]/g, '');
  if (!/^\+?\d{3,15}$/.test(s)) return null;
  if (/^1\d{2,6}$/.test(s)) return { value: s, tel: s };
  let nat;
  if (s.startsWith('+62')) nat = '0' + s.slice(3);
  else if (s.startsWith('+')) return null;
  else if (s.startsWith('62') && s.length >= 10) nat = '0' + s.slice(2);
  else if (s.startsWith('0')) nat = s;
  else return null;
  if (nat.startsWith('0800') || nat.startsWith('0804')) return { value: nat, tel: '+62' + nat.slice(1) };
  if (!/^0[2-7]\d{6,10}$/.test(nat)) return null;
  return { value: nat, tel: '+62' + nat.slice(1) };
}

function url(v) {
  const s = String(v || '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : null;
}

const KIND = {
  email_role: 'email', email: 'email',
  phone_business: 'phone', phone: 'phone', hotline: 'phone', fax: 'phone',
  careers_url: 'url', website: 'url', linkedin_company: 'url',
};

function cleanContact(x) {
  const kind = x && KIND[x.type];
  if (!kind) return null;
  if (kind === 'email') { const v = email(x.value); return v ? { ...x, value: v } : null; }
  if (kind === 'phone') { const p = phone(x.value); return p ? { ...x, value: p.value, tel: p.tel } : null; }
  const v = url(x.value);
  return v ? { ...x, value: v } : null;
}

/* the contacts for one company card: cleaned, de-duplicated, page types only */
function publicContacts(list, types = ['email_role', 'phone_business', 'careers_url']) {
  const seen = new Set();
  const out = [];
  for (const x of list || []) {
    if (!types.includes(x.type)) continue;
    const c = cleanContact(x);
    if (!c || seen.has(c.type + '|' + c.value)) continue;
    seen.add(c.type + '|' + c.value);
    out.push(c);
  }
  return out;
}

module.exports = { cleanContact, publicContacts };
