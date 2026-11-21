/* Humbly Walking with God® — site scripts
   ------------------------------------------------------------------
   SETTINGS — edit these two lines only.
   SHEET_ENDPOINT: paste your Google Apps Script web app URL here to send
   custom order requests to your Google Sheet. Leave it '' to use email.  */
const SHEET_ENDPOINT = '';
const SHOP_EMAIL = 'info@humblywalking.com';
/* ------------------------------------------------------------------ */

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Hero video: always loop ---------- */
  $$('video[data-loop]').forEach(v => {
    v.muted = true;
    v.addEventListener('ended', () => { v.currentTime = 0; v.play().catch(() => {}); });
    v.play && v.play().catch(() => {});
  });

  /* ---------- Product page: gallery, sizes, checkout ---------- */
  const product = $('[data-product]');
  if (product) {
    const mainImg = $('.gallery .main img', product);
    $$('.thumbs button', product).forEach(b => b.addEventListener('click', () => {
      mainImg.src = b.dataset.src;
      $$('.thumbs button', product).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));

    let size = null;
    const buy = $('[data-buy]', product), status = $('[data-status]', product), sizeLabel = $('[data-size-label]', product);
    $$('.sizes button', product).forEach(b => b.addEventListener('click', () => {
      size = b.textContent.trim();
      $$('.sizes button', product).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      sizeLabel.textContent = ' — ' + size;
      buy.firstChild.textContent = 'Add to Cart — ' + product.dataset.price + ' ';
      status.textContent = '';
    }));
    buy.addEventListener('click', () => {
      if (!size) { status.textContent = 'Please choose a size first.'; return; }
      const link = product.dataset.square;
      if (!link) { status.textContent = 'Checkout link coming soon.'; return; }
      openCheckout({ link, name: product.dataset.name, price: product.dataset.price, img: product.dataset.img, size });
    });
  }

  /* ---------- Checkout window + overlay ---------- */
  const overlay = $('#checkout');
  let ckWin = null, ckTimer = null, ckItem = null;
  function openCheckout(item) {
    ckItem = item;
    const w = Math.min(500, screen.availWidth - 40), h = Math.min(760, screen.availHeight - 60);
    const left = (window.screenX || 0) + Math.max(0, (window.outerWidth - w) / 2);
    const top = (window.screenY || 0) + Math.max(0, (window.outerHeight - h) / 2);
    ckWin = window.open(item.link, 'hwwg-checkout', `scrollbars=yes,width=${w},height=${h},left=${left},top=${top}`);
    if (!ckWin) { window.open(item.link, '_blank'); return; }   // pop-ups blocked → new tab
    ckWin.focus();
    $('[data-ck-img]', overlay).src = item.img;
    $('[data-ck-name]', overlay).textContent = item.name;
    $('[data-ck-meta]', overlay).textContent = 'Size ' + item.size + ' · ' + item.price;
    overlay.classList.add('open');
    $('[data-ck-reopen]', overlay).focus();
    clearInterval(ckTimer);
    ckTimer = setInterval(() => { if (ckWin.closed) { clearInterval(ckTimer); closeOverlay(); } }, 800);
  }
  function closeOverlay() { overlay && overlay.classList.remove('open'); clearInterval(ckTimer); }
  if (overlay) {
    $$('[data-ck-close]', overlay).forEach(b => b.addEventListener('click', closeOverlay));
    $('[data-ck-reopen]', overlay).addEventListener('click', () => ckItem && openCheckout(ckItem));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlay(); });
  }

  /* ---------- Contact form → email ---------- */
  const contact = $('#contact-form');
  if (contact) contact.addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(contact);
    const body = (f.get('message') || '') + '\n\n' + (f.get('first') || '') + ' ' + (f.get('last') || '') + ' — ' + f.get('email');
    location.href = 'mailto:' + SHOP_EMAIL + '?subject=' + encodeURIComponent(f.get('subject') || 'Website message') + '&body=' + encodeURIComponent(body);
    $('[data-status]', contact).textContent = 'Thank you! Your email app should open with your message ready to send.';
  });

  /* ---------- Newsletter → email ---------- */
  $$('.newsletter form').forEach(nf => nf.addEventListener('submit', e => {
    e.preventDefault();
    const email = new FormData(nf).get('email');
    location.href = 'mailto:' + SHOP_EMAIL + '?subject=' + encodeURIComponent('Newsletter Sign-Up') + '&body=' + encodeURIComponent('Please add me to the Humbly Walking with God® email list: ' + email);
    $('button', nf).firstChild.textContent = 'Subscribed ';
  }));

  /* ---------- Custom order form ---------- */
  const cf = $('#custom-form');
  if (cf) cf.addEventListener('submit', e => {
    e.preventDefault();
    const status = $('[data-status]', cf), btn = $('button[type=submit]', cf);
    if (!cf.reportValidity()) { status.textContent = 'Please fill in the required fields marked with *.'; return; }
    const qs = $$('.q', cf);
    for (const q of qs) {
      if (q.dataset.type === 'check' && !q.querySelector('input:checked')) {
        status.textContent = 'Please choose at least one option for: ' + q.dataset.label;
        q.querySelector('input').focus();
        return;
      }
    }
    const answers = {}; let files = [];
    qs.forEach(q => {
      const label = q.dataset.label, t = q.dataset.type;
      if (t === 'file') { files = [...q.querySelector('input').files]; return; }
      if (t === 'radio' || t === 'check') answers[label] = $$('input:checked', q).map(i => i.value).join(', ');
      else answers[label] = q.querySelector('input,textarea').value.trim();
    });

    if (SHEET_ENDPOINT) {
      if (files.reduce((n, x) => n + x.size, 0) > 20 * 1024 * 1024) { status.textContent = 'Your design files are over 20 MB in total. Please upload smaller files, or email them to ' + SHOP_EMAIL + '.'; return; }
      btn.disabled = true; status.textContent = 'Sending your request…';
      const read = x => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: x.name, type: x.type || 'application/octet-stream', data: String(r.result).split(',')[1] }); r.onerror = rej; r.readAsDataURL(x); });
      Promise.all(files.map(read))
        .then(up => fetch(SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ answers, files: up }) }))
        .then(() => { cf.reset(); btn.disabled = false; status.textContent = 'Thank you! Your custom order request was sent. We will be in touch soon.'; })
        .catch(() => { btn.disabled = false; status.textContent = 'Something went wrong sending your request. Please try again, or email ' + SHOP_EMAIL + '.'; });
      return;
    }
    const lines = Object.keys(answers).map(k => k + '\n' + (answers[k] || '—'));
    if (files.length) lines.push('Design files (attached to this email):\n' + files.map(x => x.name).join(', '));
    const who = ((answers['First Name'] || '') + ' ' + (answers['Last Name'] || '')).trim();
    location.href = 'mailto:' + SHOP_EMAIL + '?subject=' + encodeURIComponent('Custom Order Request — ' + who) + '&body=' + encodeURIComponent(lines.join('\n\n'));
    status.textContent = 'Thank you! Your email app should open with your order details filled in.' + (files.length ? ' Please attach your design files, then send it to finish your request.' : ' Send it to finish your request.');
  });
})();
