/* Progressive enhancement: the SVG, default readout and full table are SSR. */
(() => {
  'use strict';
  document.querySelectorAll('[data-import-chart]').forEach(chart => {
    const bars = Array.from(chart.querySelectorAll('[data-month-index]'));
    const select = chart.querySelector('[data-month-select]');
    const month = chart.querySelector('[data-readout-month]');
    const total = chart.querySelector('[data-readout-total]');
    const parts = chart.querySelectorAll('[data-readout-part]');
    let active = Number(select.value);
    function show(index) {
      const bar = bars[index];
      if (!bar) return;
      active = index;
      bars.forEach((item, i) => {
        item.classList.toggle('is-selected', i === index);
        item.setAttribute('aria-pressed', String(i === index));
        item.setAttribute('tabindex', i === index ? '0' : '-1');
      });
      select.value = String(index);
      month.textContent = bar.dataset.monthLabel;
      total.textContent = bar.dataset.total;
      const values = JSON.parse(bar.dataset.parts);
      parts.forEach((item, i) => { item.textContent = values[i]; });
    }
    bars.forEach((bar, index) => {
      bar.setAttribute('role', 'button');
      // Pointer movement avoids changing the selection when scrolling moves bars
      // beneath a stationary mouse after a keyboard or month-picker action.
      bar.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' && active !== index) show(index);
      });
      bar.addEventListener('click', () => show(index));
      bar.addEventListener('focus', () => { if (active !== index) show(index); });
      bar.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(index + 1, bars.length - 1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(index - 1, 0);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = bars.length - 1;
        else if (event.key === 'Enter' || event.key === ' ') next = index;
        else return;
        event.preventDefault();
        show(next);
        bars[next].focus({ preventScroll: true });
        bars[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
    select.addEventListener('change', () => {
      show(Number(select.value));
      bars[active].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    show(active);
    chart.querySelector('.monthly-controls').hidden = false;
  });
})();
