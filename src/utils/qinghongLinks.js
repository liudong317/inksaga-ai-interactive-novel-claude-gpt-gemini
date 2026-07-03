const { shell } = require('electron');

const QINGHONG_LINKS = {
  home: 'https://www.qinghong.tech',
  signup: 'https://www.qinghong.tech/sign-up',
  docs: 'https://qinghongkeji.apifox.cn',
  pricing: 'https://www.qinghong.tech/pricing'
};

const UTM_SUFFIX = 'from=inksaga&utm_source=inksaga&utm_medium=desktop';

function withUtm(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${UTM_SUFFIX}`;
}

function openQinghongLink(key) {
  const url = QINGHONG_LINKS[key];
  if (url) shell.openExternal(withUtm(url));
}

function setupQinghongLinkDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qh-link]');
    if (!btn) return;
    e.preventDefault();
    openQinghongLink(btn.dataset.qhLink);
  });
}

module.exports = { QINGHONG_LINKS, withUtm, openQinghongLink, setupQinghongLinkDelegation };
