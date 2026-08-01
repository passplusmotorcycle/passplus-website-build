import './styles.css';
import { dict } from './i18n.js';

const WHATSAPP = 'https://wa.me/85263662640';
const PHONE = 'tel:+85263662640';
const EMAIL = 'mailto:passplusmotorcyclehk@gmail.com';
const TD_ZH =
  'https://www.td.gov.hk/tc/public_services/licences_and_permits/driving_test/driving_test_of_noncommercial_vehicles/index.html';
const TD_EN =
  'https://www.td.gov.hk/en/public_services/licences_and_permits/driving_test/driving_test_of_noncommercial_vehicles/index.html';

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
}

function t(lang, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), dict[lang]);
}

function applyI18n(lang) {
  const d = dict[lang];

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const value = t(lang, key);
    if (typeof value === 'string') el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    const value = t(lang, key);
    if (typeof value === 'string') el.innerHTML = value;
  });

  document.querySelectorAll('[data-lang-toggle]').forEach((langBtn) => {
    langBtn.textContent = d.switchTo;
  });

  renderServices(lang);
  renderWhy(lang);
  renderAudience(lang);
  renderProcess(lang);
  renderFaqs(lang);

  const td = document.querySelector('[data-td-link]');
  if (td) td.href = lang === 'zh' ? TD_ZH : TD_EN;

  document.title =
    lang === 'zh'
      ? document.body.dataset.titleZh || 'PassPlus Motorcycle HK'
      : document.body.dataset.titleEn || 'PassPlus Motorcycle HK';
}

function renderServices(lang) {
  const root = document.querySelector('[data-services]');
  if (!root) return;
  const items = dict[lang].services.items;
  root.innerHTML = items
    .map(
      (item) => `
      <article class="service-row reveal">
        <div>
          <h3>${item.name}</h3>
          ${item.note ? `<p class="service-note">${item.note}</p>` : ''}
        </div>
        <div class="service-price">${item.price}</div>
        <p class="service-desc">${item.desc}</p>
      </article>
    `
    )
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

  // Ensure below-fold content never stays invisible if observer misses it.
  window.setTimeout(() => {
    document.querySelectorAll('.reveal:not(.is-in)').forEach((n) => n.classList.add('is-in'));
  }, 1200);
}

function wireChrome() {
  document.querySelectorAll('[data-whatsapp]').forEach((el) => {
    el.href = WHATSAPP;
    el.target = '_blank';
    el.rel = 'noopener noreferrer';
  });
  document.querySelectorAll('[data-phone]').forEach((el) => {
    el.href = PHONE;
  });
  document.querySelectorAll('[data-email]').forEach((el) => {
    el.href = EMAIL;
  });

  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.querySelectorAll('[data-lang-toggle]').forEach((langBtn) => {
    langBtn.addEventListener('click', () => {
      const next = getLang() === 'zh' ? 'en' : 'zh';
      setLang(next);
    });
  });

  const menuBtn = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-mobile-panel]');
  menuBtn?.addEventListener('click', () => {
    const open = panel?.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  panel?.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      panel.classList.remove('is-open');
      menuBtn?.setAttribute('aria-expanded', 'false');
    });
  });
}

wireChrome();
setLang(getLang());
