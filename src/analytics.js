import { siteConfig } from './site.js';

const CONSENT_KEY = 'pp-analytics-consent';
let gtagLoaded = false;

export function getConsent() {
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === 'accepted' || value === 'declined') return value;
  return null;
}

export function setConsent(value) {
  localStorage.setItem(CONSENT_KEY, value);
}

function canTrack() {
  return getConsent() === 'accepted' && Boolean(siteConfig.gaMeasurementId);
}

function loadGtag() {
  if (gtagLoaded || !siteConfig.gaMeasurementId) return;
  gtagLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', siteConfig.gaMeasurementId, {
    anonymize_ip: true,
    send_page_view: true,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(siteConfig.gaMeasurementId)}`;
  document.head.appendChild(script);
}

export function track(eventName, params = {}) {
  if (!canTrack() || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

export function initAnalytics({ onConsentChange } = {}) {
  const banner = document.querySelector('[data-consent-banner]');
  const acceptBtn = document.querySelector('[data-consent-accept]');
  const declineBtn = document.querySelector('[data-consent-decline]');
  const existing = getConsent();

  const apply = (value, { fromUser = false } = {}) => {
    setConsent(value);
    if (banner) banner.hidden = true;
    if (value === 'accepted') loadGtag();
    if (fromUser && typeof onConsentChange === 'function') onConsentChange(value);
  };

  if (existing === 'accepted') {
    loadGtag();
    if (banner) banner.hidden = true;
  } else if (existing === 'declined') {
    if (banner) banner.hidden = true;
  } else if (banner && siteConfig.gaMeasurementId) {
    banner.hidden = false;
  } else if (banner) {
    banner.hidden = true;
  }

  acceptBtn?.addEventListener('click', () => apply('accepted', { fromUser: true }));
  declineBtn?.addEventListener('click', () => apply('declined', { fromUser: true }));
}
