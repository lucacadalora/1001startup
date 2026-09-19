'use strict';
/* Render the /model page's TeX formulas to self-contained SVG (MathJax v3,
 * fontCache local, fills inherit currentColor) and bundle them — together with
 * the live numbers they quote and the pre-rendered decision-flow SVG — into
 * data/model-tex.json, which views/model1001.js serves.
 *
 * Numbers (D, T, USD, N, nulls, N_eff, top-5 share) are computed from
 * public/data/census.json at render time, so: re-run this AFTER build-census.js
 * whenever census-raw.json changes:  node scripts/build-model-tex.js
 * (build-census.js chains this automatically.)
 *
 * Every figure on the page is hand-authored SVG inside views/model1001.js, so
 * equations are the only thing that needs a build step. */
const fs = require('fs');
const path = require('path');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const census = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'census.json'), 'utf8'));
const m = census.method;
const T = census.totals;

/* live numbers quoted inside the formulas */
const g = census.companies.map((c) => c.est_gva_idr_bn).filter(Boolean);
const D = g.reduce((s, x) => s + x, 0);
const nWith = g.length;
const nAll = census.companies.length;
const nNull = nAll - nWith;
const neff = (D * D) / g.reduce((s, x) => s + x * x, 0);
const top5 = g.slice().sort((a, b) => b - a).slice(0, 5).reduce((s, x) => s + x, 0);
const kappa = m.indirect_multiplier;
const fx = m.fx_idr_per_usd;
const dT = (D / 1000).toFixed(1);
const tT = ((D * kappa) / 1000).toFixed(1);
const usdB = ((D * kappa) / fx).toFixed(1);
const usdDirB = (D / fx).toFixed(1);
const fxFmt = fx.toLocaleString('en-US').replace(',', '{,}');
const nums = {
  d_t: dT, t_t: tT, usd_b: usdB, usd_dir_b: usdDirB,
  n_all: nAll, n_with: nWith, n_null: nNull,
  neff: neff.toFixed(1), top5_pct: ((top5 / D) * 100).toFixed(1),
  jobs: T.jobs, kappa, fx, generated: census.generated,
};

const FORMULAS = {
  estimator: { d: true, tex: String.raw`\widehat{G}^{\,\mathrm{dir}}_{i} \;=\; \begin{cases} h_i \cdot a_{s(i)} & \text{if } h_i \text{ is known} \\[4pt] \varnothing & \text{otherwise } \textit{(never imputed from funding or valuation)} \end{cases}` },
  rawcell: { d: true, tex: String.raw`g_k \;=\; \frac{V_k}{L_k} \qquad\qquad \begin{aligned}&V_k := \text{PDRB ADHB 2023, sector } k \\ &L_k := \text{Sakernas Aug 2023 employment, sector } k\end{aligned}` },
  anchor: { d: true, tex: String.raw`a_s \;=\; \min\!\Bigl(\, \delta_s \bigl[\, w_s\, g_{k(s)} + (1-w_s)\,\bar{g} \,\bigr],\;\; g_{M\!N} \Bigr), \qquad \delta_s \in [\,0.70,\; 0.85\,]` },
  aggregation: { d: true, tex: String.raw`D \;=\; \sum_{i=1}^{N} h_i\, a_{s(i)} \;=\; \text{IDR } ${dT}\,\text{T/yr} \qquad\qquad T \;=\; \kappa D \;=\; ${tT}\,\text{T/yr}, \quad \kappa = ${kappa}` },
  fx: { d: true, tex: String.raw`X_{\mathrm{USD}} \;=\; \frac{X_{\mathrm{IDR}}}{e}, \qquad e = ${fxFmt} \;\; \mathrm{IDR}/\mathrm{USD} \;\; \text{(${census.generated.slice(0, 10)})}` },
  multonce: { d: true, tex: String.raw`T \;=\; \kappa \sum_i \widehat{G}_i \;\;\neq\;\; \sum_i \bigl( \widehat{G}_i + \mathrm{ind}_i \bigr) \quad \text{summed naively:} \quad \mathrm{ind}_i \cap \widehat{G}^{\,\mathrm{dir}}_{j} \neq \varnothing` },
  error: { d: true, tex: String.raw`G^{\,\mathrm{true}}_{i} \;=\; \widehat{G}_i \cdot \varepsilon_i, \qquad \varepsilon_i \in \bigl[\tfrac{1}{5},\, 3\bigr] \;\text{typ.}, \qquad \bigl|\varepsilon_i - 1\bigr| \geq 0.5 \;\text{assumed}` },
  concentration: { d: true, tex: String.raw`\frac{\sigma_D}{D} \;\approx\; \frac{\sigma_\varepsilon}{\sqrt{N_{\mathrm{eff}}}}\,, \qquad N_{\mathrm{eff}} \;=\; \frac{\bigl(\sum_i \widehat{G}_i\bigr)^{2}}{\sum_i \widehat{G}_i^{\,2}} \;=\; ${neff.toFixed(1)} \;\;\text{(vs } N = ${nWith}\text{)}` },
  gates: { d: true, tex: String.raw`h_i\, a_{s(i)} \;\le\; \tau_i \cdot \mathrm{GMV}_i \quad \text{(marketplaces)} \qquad\qquad \widehat{G}_i \;\approx\; \mathrm{payroll}_i + \mathrm{dep}_i \quad \text{(pre-revenue)}` },
  chain: { d: true, tex: String.raw`D = ${dT}\,\mathrm{T} \;\xrightarrow{\;\times\, \kappa\;}\; T = ${tT}\,\mathrm{T} \;\xrightarrow{\;\div\, e\;}\; \mathrm{US\$}\,${usdB}\,\mathrm{B/yr}` },
  i_hi: { d: false, tex: String.raw`h_i` },
  i_as: { d: false, tex: String.raw`a_{s(i)}` },
  i_kappa: { d: false, tex: String.raw`\kappa = ${kappa}` },
  i_null: { d: false, tex: String.raw`\varnothing` },
};

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const svgs = {};
for (const [name, f] of Object.entries(FORMULAS)) {
  const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'local' }) });
  const node = doc.convert(f.tex, { display: f.d, em: 16, ex: 7.52, containerWidth: 1200 });
  let s = adaptor.innerHTML(node);
  /* namespace glyph ids so every formula can coexist in one document */
  s = s.replace(/id="MJX-/g, `id="${name}-MJX-`).replace(/(xlink:)?href="#MJX-/g, `$1href="#${name}-MJX-`);
  svgs[name] = s;
}

fs.writeFileSync(path.join(__dirname, '..', 'data', 'model-tex.json'), JSON.stringify({ nums, svgs }));
console.log(`model-tex.json: ${Object.keys(svgs).length} formulas, D=${dT}T T=${tT}T N_eff=${neff.toFixed(1)}`);
