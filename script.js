(function () {
  document.querySelectorAll('.btn').forEach((btn) => {
    if (!btn.querySelector('.chev')) {
      const s = document.createElement('span');
      s.className = 'chev';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = '›';
      btn.appendChild(s);
    }
  });
})();
