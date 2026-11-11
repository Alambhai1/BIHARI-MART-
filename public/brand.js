
(function(){
if(document.querySelector('.bm-global-header'))return;
const h=document.createElement('header');
h.className='bm-global-header';
h.innerHTML='<div class="bm-brand-top"><a href="/"><img class="bm-brand-logo" src="/logo.svg" alt="BIHARI MART INDIA PVT. LTD."></a><div class="bm-brand-tag">Global Business • Digital Services • Better Tomorrow<br>Connect • Trade • Grow Worldwide</div></div><nav class="bm-brand-nav"><a href="/digital-seva.html">Digital Seva</a><a href="/education.html">Education</a><a href="/index-before-travel-button.html">Index Before Travel Button</a><a href="/index-before-travel.html">Index Before Travel</a><a href="/index-before-vehicle-expansion.html">Index Before Vehicle Expansion</a><a href="/">Home</a><a href="/travel.html">Travel</a></nav>';
document.body.insertBefore(h,document.body.firstChild);
const f=document.createElement('footer');
f.className='bm-brand-footer';
f.innerHTML='<strong>BIHARI MART INDIA PVT. LTD.</strong><p>One Platform – Multiple Services</p><p>© '+new Date().getFullYear()+' BIHARI MART. All Rights Reserved.</p>';
document.body.appendChild(f);
})();
