import './styles.css';
import { initAnalytics, track } from './analytics.js';
import { dict } from './i18n.js';
import { formatHkd, packageSaving, pricing } from './pricing.js';

const PHONE = `tel:${pricing.phoneTel}`;
const EMAIL = `mailto:${pricing.email}`;
const TD_ZH =
  'https://www.td.gov.hk/tc/public_services/licences_and_permits/driving_test/driving_test_of_noncommercial_vehicles/index.html';
const TD_EN =
  'https://www.td.gov.hk/en/public_services/licences_and_permits/driving_test/driving_test_of_noncommercial_vehicles/index.html';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
let lastEstimate = null;

function getLang() {
  const saved = localStorage.getItem('pp-lang');
  if (saved === 'zh' || saved === 'en') return saved;
  return 'zh';
}

function setLang(lang) {
  localStorage.setItem('pp-lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.documentElement.dataset.lang = lang;
  applyI18n(lang);
  syncWhatsAppLinks();
}

function t(lang, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), dict[lang]);
}

function fill(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) =>
    values[key] == null ? '' : String(values[key])
  );
}

function priceById(priceId) {
  if (priceId === 'free') return 0;
  return pricing[priceId] ?? 0;
}

function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const stored = JSON.parse(sessionStorage.getItem('pp-attribution') || '{}');
  const next = { ...stored };
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) next[key] = value;
  });
  if (!next.landing) next.landing = `${window.location.pathname}${window.location.search}`;
  sessionStorage.setItem('pp-attribution', JSON.stringify(next));
  return next;
}

function sourceLabel() {
  const attr = captureAttribution();
  const parts = [attr.utm_source, attr.utm_medium, attr.utm_campaign, attr.utm_content].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'direct';
}

function applyI18n(lang) {
  const d = dict[lang];
  const vars = {
    fee: '',
    upgrade: formatHkd(pricing.mockUpgrade),
    saving: formatHkd(packageSaving()),
    price: '',
    instructor: pricing.packageIncludes.instructor,
    self: pricing.packageIncludes.self,
  };

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = t(lang, key);
    if (typeof value !== 'string') return;

    if (key === 'calculator.academyIsland') {
      el.textContent = fill(value, { fee: formatHkd(pricing.academies[0].fee) });
      return;
    }
    if (key === 'calculator.academyKwunTong') {
      el.textContent = fill(value, { fee: formatHkd(pricing.academies[1].fee) });
      return;
    }
    if (key === 'calculator.academyShaTin') {
      el.textContent = fill(value, { fee: formatHkd(pricing.academies[2].fee) });
      return;
    }
    if (key === 'calculator.packageIncludes' || key === 'calculator.mockUpgradeNote') {
      el.textContent = fill(value, vars);
      return;
    }
    if (key === 'calculator.packageSaving') {
      el.textContent = fill(value, { saving: formatHkd(packageSaving()) });
      return;
    }
    if (key === 'calculator.instructorPrice') {
      el.textContent = fill(value, { price: formatHkd(pricing.instructorLesson) });
      return;
    }
    if (key === 'calculator.selfPrice') {
      el.textContent = fill(value, { price: formatHkd(pricing.selfPractice) });
      return;
    }
    if (key === 'calculator.mockPrice') {
      el.textContent = fill(value, { price: formatHkd(pricing.mockTest) });
      return;
    }

    el.textContent = fill(value, vars);
  });

  document.querySelectorAll('[data-lang-toggle]').forEach((langBtn) => {
    langBtn.textContent = d.switchTo;
    langBtn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換至中文');
  });

  document.querySelectorAll('[data-menu-toggle]').forEach((btn) => {
    btn.textContent = d.menu;
    btn.setAttribute('aria-label', d.menu);
  });

  document.querySelectorAll('.skip-link').forEach((el) => {
    el.textContent = d.skip;
  });

  renderServices(lang);
  renderWhy(lang);
  renderAudience(lang);
  renderProcess(lang);
  renderFaqs(lang);
  hydrateStaticPrices();
  renderCalculator(lang);

  const td = document.querySelector('[data-td-link]');
  if (td) td.href = lang === 'zh' ? TD_ZH : TD_EN;

  document.title =
    lang === 'zh'
      ? document.body.dataset.titleZh || 'PassPlus Motorcycle HK'
      : document.body.dataset.titleEn || 'PassPlus Motorcycle HK';
}

function hydrateStaticPrices() {
  const academy = document.getElementById('academy');
  if (academy) {
    pricing.academies.forEach((item, index) => {
      if (academy.options[index]) academy.options[index].value = String(item.fee);
    });
  }

  document.querySelectorAll('[data-price]').forEach((el) => {
    const key = el.getAttribute('data-price');
    const value = key === 'corePackage' ? pricing.corePackage : priceById(key);
    el.textContent = formatHkd(value);
  });
}

function renderServices(lang) {
  const root = document.querySelector('[data-services]');
  if (!root) return;
  const items = dict[lang].services.items;
  root.innerHTML = items
    .map((item) => {
      const note = item.note
        ? `<p class="service-note">${fill(item.note, { upgrade: formatHkd(pricing.mockUpgrade) })}</p>`
        : '';
      return `
      <article class="service-row reveal">
        <div>
          <h3>${item.name}</h3>
          ${note}
        </div>
        <div class="service-price">${formatHkd(priceById(item.priceId))}</div>
        <p class="service-desc">${item.desc}</p>
      </article>
    `;
    })
    .join('');
  observeReveals();
}

function renderWhy(lang) {
  const root = document.querySelector('[data-why]');
  if (!root) return;
  root.innerHTML = dict[lang].why.points
    .map(
      (p) => `
      <article class="why-item reveal">
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
      </article>
    `
    )
    .join('');
  observeReveals();
}

function renderAudience(lang) {
  const root = document.querySelector('[data-audience]');
  if (!root) return;
  root.innerHTML = dict[lang].audience.items.map((item) => `<li class="reveal">${item}</li>`).join('');
  observeReveals();
}

function renderProcess(lang) {
  const root = document.querySelector('[data-flow]');
  if (!root) return;
  root.innerHTML = dict[lang].processPage.steps
    .map(
      (step) => `
      <article class="flow-step reveal ${step.highlight ? 'is-highlight' : ''}">
        <div class="flow-num" aria-hidden="true">${step.num}</div>
        <div class="flow-body">
          <h3>${step.title}</h3>
          <p>${step.desc}</p>
        </div>
      </article>
    `
    )
    .join('');
  observeReveals();
}

function renderFaqs(lang) {
  const root = document.querySelector('[data-faqs]');
  if (!root) return;
  root.innerHTML = dict[lang].processPage.faqs
    .map(
      (faq) => `
      <article class="faq-item reveal">
        <h3>${faq.q}</h3>
        <p>${faq.a}</p>
      </article>
    `
    )
    .join('');
  observeReveals();
}

function numberValue(field, max) {
  const value = Number.parseInt(field?.value || '0', 10);
  return Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), max);
}

function getEstimate(lang = getLang()) {
  const root = document.querySelector('[data-calculator]');
  const form = root?.querySelector('[data-calculator-form]');
  if (!root || !form) return null;

  const stage = form.elements.stage.value;
  const trainingMode = form.elements.trainingMode.value;
  const academyGroup = root.querySelector('[data-academy-group]');
  const packageOptions = root.querySelector('[data-package-options]');
  const customOptions = root.querySelector('[data-custom-options]');

  const academyCost = stage === 'beginner' ? numberValue(form.elements.academy, 10000) : 0;
  const learnerCost = form.elements.learnerLicence.checked ? pricing.learnerLicence : 0;
  const roadTestFormCost = form.elements.roadTestForm.checked ? pricing.roadTestForm : 0;
  const agencyCost = form.elements.agencyService?.checked ? pricing.agencyService : 0;

  if (academyGroup) academyGroup.hidden = stage !== 'beginner';
  if (packageOptions) packageOptions.hidden = trainingMode !== 'package';
  if (customOptions) customOptions.hidden = trainingMode !== 'custom';

  let trainingCost = 0;
  let upgradeCost = 0;
  let trainingLabel = dict[lang].calculator.packageBreakdown;
  let trainingShort = dict[lang].calculator.trainingPackageShort;

  if (trainingMode === 'package') {
    const upgrades = numberValue(form.elements.mockUpgrades, pricing.packageIncludes.instructor);
    trainingCost = pricing.corePackage;
    upgradeCost = upgrades * pricing.mockUpgrade;
  } else {
    const instructorLessons = numberValue(form.elements.instructorLessons, 20);
    const selfLessons = numberValue(form.elements.selfLessons, 20);
    const mockLessons = numberValue(form.elements.mockLessons, 10);
    const examRental = form.elements.examRental.checked ? pricing.examRental : 0;
    trainingCost =
      instructorLessons * pricing.instructorLesson +
      selfLessons * pricing.selfPractice +
      mockLessons * pricing.mockTest +
      examRental;
    trainingLabel = dict[lang].calculator.customBreakdown;
    trainingShort = dict[lang].calculator.trainingCustomShort;
  }

  const rows = [];
  if (academyCost) rows.push([dict[lang].calculator.academyBreakdown, academyCost]);
  if (learnerCost) rows.push([dict[lang].calculator.learnerBreakdown, learnerCost]);
  if (roadTestFormCost) rows.push([dict[lang].calculator.roadTestFormBreakdown, roadTestFormCost]);
  if (agencyCost) rows.push([dict[lang].calculator.agencyBreakdown, agencyCost]);
  rows.push([trainingLabel, trainingCost]);
  if (upgradeCost) rows.push([dict[lang].calculator.upgradeBreakdown, upgradeCost]);

  const total =
    academyCost + learnerCost + roadTestFormCost + agencyCost + trainingCost + upgradeCost;
  const stageShort =
    stage === 'beginner'
      ? dict[lang].calculator.stageBeginnerShort
      : dict[lang].calculator.stagePassedShort;

  return { total, rows, stageShort, trainingShort };
}

function renderCalculator(lang = getLang()) {
  const root = document.querySelector('[data-calculator]');
  if (!root) return;

  const estimate = getEstimate(lang);
  if (!estimate) return;
  lastEstimate = estimate;

  root.querySelector('[data-estimate-total]').textContent = formatHkd(estimate.total);
  root.querySelector('[data-estimate-breakdown]').innerHTML = estimate.rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${formatHkd(value)}</dd></div>`)
    .join('');

  const stickyTotal = document.querySelector('[data-sticky-total]');
  if (stickyTotal) stickyTotal.textContent = formatHkd(estimate.total);

  syncWhatsAppLinks();
}

function buildWhatsAppUrl(placement = 'general') {
  const lang = getLang();
  const source = sourceLabel();
  let message = fill(dict[lang].whatsappPrefill.general, { source, placement });

  if ((placement === 'calculator' || placement === 'sticky') && lastEstimate) {
    message = fill(dict[lang].whatsappPrefill.calculator, {
      source,
      stage: lastEstimate.stageShort,
      training: lastEstimate.trainingShort,
      total: formatHkd(lastEstimate.total),
      breakdown: lastEstimate.rows.map(([label, value]) => `- ${label}: ${formatHkd(value)}`).join('\n'),
    });
  }

  return `https://wa.me/${pricing.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function syncWhatsAppLinks() {
  document.querySelectorAll('[data-whatsapp]').forEach((el) => {
    const placement = el.getAttribute('data-whatsapp') || 'general';
    el.href = buildWhatsAppUrl(placement === '' ? 'general' : placement);
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
    if (!el.dataset.trackBound) {
      el.dataset.trackBound = '1';
      el.addEventListener('click', () => {
        track('whatsapp_click', {
          placement: el.getAttribute('data-whatsapp') || 'general',
          language: getLang(),
          source: sourceLabel(),
          estimate_total: lastEstimate?.total ?? undefined,
        });
      });
    }
  });
}

function wireCalculator() {
  const form = document.querySelector('[data-calculator-form]');
  if (!form) return;

  let interacted = false;
  const update = () => {
    renderCalculator(getLang());
    if (interacted && lastEstimate) {
      track('calculator_update', {
        language: getLang(),
        total: lastEstimate.total,
        stage: lastEstimate.stageShort,
        training: lastEstimate.trainingShort,
      });
    }
  };
  form.addEventListener('change', () => {
    interacted = true;
    update();
  });
  form.addEventListener('input', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'number') {
      const min = Number(event.target.min || 0);
      const max = Number(event.target.max || 20);
      const value = Number.parseInt(event.target.value || '0', 10);
      if (Number.isFinite(value)) event.target.value = String(Math.min(Math.max(value, min), max));
    }
    interacted = true;
    update();
  });
}

function observeReveals() {
  const nodes = document.querySelectorAll('.reveal:not(.is-in)');
  if (!nodes.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
  );
  nodes.forEach((n) => io.observe(n));

  window.setTimeout(() => {
    document.querySelectorAll('.reveal:not(.is-in)').forEach((n) => n.classList.add('is-in'));
  }, 1200);
}

function wireChrome() {
  captureAttribution();

  document.querySelectorAll('[data-phone]').forEach((el) => {
    el.href = PHONE;
  });
  document.querySelectorAll('[data-email]').forEach((el) => {
    el.href = EMAIL;
  });

  document.body.classList.add('has-sticky-space');

  const header = document.querySelector('.site-header');
  const sticky = document.querySelector('[data-sticky-cta]');
  const onScroll = () => {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
    if (sticky) sticky.classList.toggle('is-visible', window.scrollY > 420);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('[data-lang-toggle]').forEach((langBtn) => {
    langBtn.addEventListener('click', () => {
      const next = getLang() === 'zh' ? 'en' : 'zh';
      setLang(next);
      track('language_switch', { language: next });
    });
  });

  initAnalytics();

  const menuBtn = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-mobile-panel]');
  const closeMenu = () => {
    panel?.classList.remove('is-open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  };

  menuBtn?.addEventListener('click', () => {
    const open = panel?.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  panel?.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', (event) => {
    if (!panel?.classList.contains('is-open')) return;
    if (panel.contains(event.target) || menuBtn?.contains(event.target)) return;
    closeMenu();
  });
}

wireChrome();
wireCalculator();
setLang(getLang());
