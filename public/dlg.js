/* dlg.js: پنجره‌ها (ورود، ثبت/ویرایش بلیت، نتیجهٔ دستی، کش‌اوت، تطبیق بازی، تلگرام، پشتیبان) */
const tok = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
const copy = (u) => (navigator.clipboard ? navigator.clipboard.writeText(u).then(() => toast('لینک کپی شد'), () => prompt('لینک:', u)) : prompt('لینک:', u));
const B = (id) => S.bets.find((b) => b.id == id) || S.trash.find((b) => b.id == id);
const visOpts = (v) => Object.entries(VIS).map(([k, t]) => `<option value="${k}"${v == k ? ' selected' : ''}>${t}</option>`).join('');
function setVis(b, v) { b.vis = v; if (v == 'private') delete b.share; else if (!b.share) b.share = tok(); }
function mountDialogs() {
  $('#dlg').innerHTML = `<dialog id="lg"><form id="lf"><h3 id="lt">ورود</h3><input id="un" placeholder="نام کاربری" autocomplete="username" required><input id="em" placeholder="ایمیل" autocomplete="email" hidden><input id="pw" type="password" placeholder="رمز (حداقل 8 کاراکتر)" autocomplete="current-password" required><input id="iv" placeholder="کد دعوت" hidden><div class="sm" style="color:var(--r)" id="le"></div><button class="btn p">ادامه</button><button type="button" class="lnk" id="sw">حساب ندارید؟ ثبت‌نام</button></form></dialog>
  <dialog id="ad"><form onsubmit="return false"><h3 id="adt">افزودن بلیت</h3><div class="seg2" id="admode"><button type="button" data-m="p" class="on">چسباندن متن</button><button type="button" data-m="f">فرم بازی‌به‌بازی</button><button type="button" data-m="m">خطی</button><button type="button" data-m="b">Bet Builder</button></div>
  <input id="nm" placeholder="نام بلیت (اختیاری)"><div class="row"><input id="tgs" placeholder="برچسب‌ها (با کاما: ریسکی، امن)"><select id="vs">${visOpts('private')}</select></div><input id="nt" placeholder="یادداشت (اختیاری)">
  <div id="mf" class="row" hidden><input id="sk" inputmode="decimal" placeholder="مبلغ (USDT)"><input id="od" inputmode="decimal" placeholder="ضریب کل (خالی = حاصل‌ضرب)"><input id="ch" inputmode="decimal" placeholder="کش‌اوت"></div>
  <div id="ff" hidden><div class="row"><input id="fh" placeholder="تیم میزبان"><input id="fa" placeholder="تیم میهمان"><input id="fo" inputmode="decimal" placeholder="ضریب"></div><div class="row"><select id="fc"></select><input id="fv" placeholder="مقدار"><button type="button" class="btn" id="fadd">+ شرط</button></div><div class="mut sm" id="fcur"></div><button type="button" class="btn" id="fleg">افزودن این بازی به بلیت</button><div class="sm" id="flist"></div></div>
  <textarea id="tx" rows="11"></textarea>
<div id="bb" hidden><textarea id="txb" rows="11" placeholder="متن Bet Builder را اینجا بچسبانید"></textarea><div class="sm mut">فرمت: شرایط هر بازی (چند خط)، سپس خط تیم‌ها (Home - Away)، و در نهایت * Odds / * Stake USDT / * Potential win USDT با مقادیر</div></div>
<div class="sm mut" id="hint"></div><div class="row"><button type="button" class="btn p" id="ok">ثبت بلیت</button><button type="button" class="btn" id="cl">بستن</button></div></form></dialog>
  <dialog id="ov"><form onsubmit="return false"><h3 id="ovt"></h3><div class="row"><input id="oh" inputmode="numeric" placeholder="گل میزبان"><input id="oa" inputmode="numeric" placeholder="گل میهمان"><input id="om" inputmode="numeric" placeholder="دقیقه (اختیاری)"></div><select id="os"><option value="live">در حال انجام</option><option value="fin">پایان‌یافته (نتیجهٔ 90 دقیقه)</option></select><select id="ow" hidden><option value="0">برندهٔ نهایی (برای شرط صعود)</option><option value="1">میزبان صعود کرد</option><option value="2">میهمان صعود کرد</option></select><div class="sm" style="color:var(--o)" id="ovh"></div><div class="row"><button type="button" class="btn p" id="ovs">ذخیره</button><button type="button" class="btn" id="ovc">حذف نتیجهٔ دستی</button><button type="button" class="btn" id="ovr">بازنشانی نتیجهٔ ذخیره‌شده</button><button type="button" class="lnk" id="ovx">بستن</button></div></form></dialog>
  <dialog id="co"><form onsubmit="return false"><h3 id="cot"></h3><input id="cov" inputmode="decimal" placeholder="پیشنهاد کش‌اوت سایت (USDT)"><div id="cor" class="sm" style="line-height:2"></div><button type="button" class="btn" id="cox">بستن</button></form></dialog>
  <dialog id="mp"><form onsubmit="return false"><h3 id="mt"></h3><div class="sm mut">بازی را از نتایج منابع انتخاب کنید تا برای همهٔ بلیت‌ها یادش بماند.</div><input id="mq" placeholder="جستجوی اسم تیم در منابع"><div id="ml"></div><button type="button" class="btn" id="mc">بستن</button></form></dialog>
  <dialog id="sg"><form onsubmit="return false"><h3>اعلان و ربات تلگرام</h3><div class="sm mut">توکن را از BotFather و Chat ID را از getUpdates بگیرید. زمان‌بند (cron) باید /api/notify را هر 1 تا 5 دقیقه صدا بزند (راهنما در README).</div><input id="tt" type="password" placeholder="توکن ربات"><input id="tc" placeholder="Chat ID">
  <label class="sm"><input type="checkbox" id="ton"> اعلان‌های خودکار فعال باشد</label><label class="sm"><input type="checkbox" id="tst"> شروع بازی</label><label class="sm"><input type="checkbox" id="tgl"> گل (با نام گل‌زن و دقیقه)</label><label class="sm"><input type="checkbox" id="ten"> پایان بازی</label>
  <select id="tsm"><option value="0">خلاصهٔ دوره‌ای: خاموش</option><option value="15">خلاصهٔ وضعیت هر 15 دقیقه</option><option value="30">هر 30 دقیقه</option><option value="60">هر ساعت</option></select><div class="sm mut" id="tlr"></div><div class="sm" style="color:var(--o)" id="tmsg"></div>
  <div class="row"><button type="button" class="btn p" id="tsv">ذخیره</button><button type="button" class="btn" id="tts">پیام آزمایشی</button><button type="button" class="btn" id="trn">اجرای آزمایشی اعلان‌ها</button><button type="button" class="btn" id="thk">فعال‌سازی دستورات ربات</button><button type="button" class="lnk" id="tcl">بستن</button></div></form></dialog>
  <dialog id="bk"><form onsubmit="return false"><h3>پشتیبان‌های روزانه</h3><div class="sm mut">سرور هر روز یک نسخهٔ پشتیبان می‌گیرد (14 روز). بلیت‌های موجود در پشتیبان که الان ندارید، اضافه می‌شوند.</div><select id="bkd"></select><div class="sm" id="bkm"></div><div class="row"><button type="button" class="btn p" id="bkg">بازیابی (ادغام)</button><button type="button" class="lnk" id="bkx">بستن</button></div></form></dialog>
  <input type="file" id="fi" accept="application/json,.json" hidden><div class="bulk" id="bulk" hidden></div>`;
  CT.forEach((c) => $('#fc').add(new Option(c[1], c[0])));
  bindDialogs();
}
/* ---- ورود ---- */
let SU = 0;
function showLogin() { const d = $('#lg'); if (!d.open) d.showModal(); }
/* ---- ویرایشگر بلیت ---- */
const ED = { edit: null, DL: [], CUR: [], EL: null, m: 'p' };
const tg = () => $('#tgs').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
function mkc(c, v) { v = v.trim(); if (!needV(c)) return c; if (!v) return null; if (c == 'S') return /^\d+-\d+$/.test(v) ? 'S' + v : null; if (!/^[+-]?[\d.]+$/.test(v)) return null; return c.startsWith('AH') ? c + (/^[+-]/.test(v) ? v : '+' + v) : c + v; }
const fl = () => ({ home: $('#fh').value.trim() || 'میزبان', away: $('#fa').value.trim() || 'میهمان' });
function flist() {
  $('#fcur').textContent = ED.CUR.length ? 'شرط‌ها (همه باید برقرار باشند): ' + ED.CUR.map((p) => Core.pt1(p, fl())).join(' + ') : '';
  $('#flist').innerHTML = ED.DL.map((l, i) => `${i + 1}. ${esc(l.home)} – ${esc(l.away)}: ${esc(Core.pickTxt(l.pick, l))} (${l.odds}) <a href="#" data-e="${i}">ویرایش</a> · <a href="#" data-r="${i}">حذف</a>`).join('<br>');
}
function edMode(m) {
  ED.m = m; $$('#admode button').forEach((b) => b.classList.toggle('on', b.dataset.m == m));
  $('#mf').hidden = m == 'p'; $('#ff').hidden = m != 'f'; $('#tx').hidden = m == 'f' || m == 'b'; $('#bb').hidden = m != 'b'; $('#admode').hidden = !!ED.edit;
  $('#nm').placeholder = m == 'p' ? 'نام بلیت (اختیاری؛ خالی = نام سایت شرط‌بندی)' : 'نام بلیت';
  $('#hint').textContent = ED.edit ? 'بازی را «ویرایش» یا «حذف» کنید یا بازی تازه اضافه کنید. برای محاسبهٔ خودکار ضریب از روی بازی‌ها، فیلد ضریب کل را خالی بگذارید.' : m == 'f' ? 'برای هر بازی: نام تیم‌ها، ضریب و یک یا چند شرط (ترکیبی) را بزنید، سپس «افزودن این بازی».' : m == 'm' ? 'هر خط: Home - Away | پیش‌بینی | ضریب (کدها: 1، X، 2، 1X، X2، O2.5، U3.5، BY، T3، S2-1، Q1، 1&O2.5 …)' : m == 'b' ? 'متن Bet Builder را بچسبانید. فرمت: شرایط هر بازی (چند خط)، سپس خط تیم‌ها (Home - Away)، و در نهایت * Odds / * Stake USDT / * Potential win USDT با مقادیر.' : 'متن بلیت را همان‌طور که از سایت کپی کرده‌اید بچسبانید؛ چند بلیت پشت‌سرهم هم قبول است.';
}
function edReset() { ED.DL = []; ED.CUR = []; ED.EL = null; ['nm', 'sk', 'od', 'ch', 'tx', 'fh', 'fa', 'fo', 'fv', 'tgs', 'nt'].forEach((k) => ($('#' + k).value = '')); $('#vs').value = (S.prof && S.prof.dvis) || 'private'; $('#adt').textContent = ED.edit ? 'ویرایش بلیت' : 'افزودن بلیت'; $('#ok').textContent = ED.edit ? 'ذخیره تغییرات' : 'ثبت بلیت'; flist(); }
function openEditor(b) {
  ED.edit = b || null; edReset(); edMode(b ? 'f' : 'p');
  if (b) { ED.DL = b.legs.slice(); $('#nm').value = b.name; $('#sk').value = b.stake; $('#od').value = b.odds; $('#ch').value = b.cash == null ? '' : b.cash; $('#tgs').value = (b.tags || []).join('، '); $('#nt').value = b.note || ''; $('#vs').value = b.vis || 'private'; edMode('f'); flist(); }
  $('#fc').onchange = () => ($('#fv').hidden = !needV($('#fc').value)); $('#fc').onchange(); $('#ad').showModal();
}
function mkBet(legs) { const odds = num($('#od').value) || +legs.reduce((p, l) => p * l.odds, 1).toFixed(2), stake = num($('#sk').value) || 1; return { name: $('#nm').value.trim() || 'multi ' + legs.length, stake, odds, win: +(stake * odds).toFixed(2), cash: $('#ch').value ? num($('#ch').value) : null, legs }; }
function edSave() {
  const H = (t) => { $('#hint').textContent = t; };
  if (ED.edit) {
    if (!ED.DL.length) return H('حداقل یک بازی باید در بلیت بماند.');
    const o = mkBet(ED.DL), b = ED.edit; Object.assign(b, { name: o.name, stake: o.stake, odds: o.odds, win: o.win, cash: o.cash, tags: tg(), note: $('#nt').value.trim(), legs: ED.DL }); setVis(b, $('#vs').value);
    $('#ad').close(); save(); render(); liveFetch().then(render); return;
  }
  let Rs;
  if (ED.m == 'f') { if (!ED.DL.length) return H('حداقل یک بازی به بلیت اضافه کنید.'); Rs = [mkBet(ED.DL)]; }
  else if (ED.m == 'm') { Rs = [parseManual($('#tx').value, { name: $('#nm').value.trim(), stake: $('#sk').value, odds: $('#od').value })]; if (Rs[0]) Rs[0].cash = $('#ch').value ? num($('#ch').value) : null; }
  else if (ED.m == 'b') { const bb = parseBetBuilder($('#txb').value.trim()); if (!bb) return H('فرمت Bet Builder معتبر نیست.'); Rs = [bb]; }
  else {
    const txt = $('#tx').value.trim();
    // Try Bet Builder parser first (doesn't use Active separators)
    const bb = parseBetBuilder(txt);
    if (bb) Rs = [bb];
    else Rs = txt.split(/^\s*Active\s*$/mi).map(parseBlock);
  }
  const ok = Rs.filter(Boolean); if (!ok.length) return H('هیچ بازی‌ای تشخیص داده نشد؛ قالب را بررسی کنید.');
  const wn = ok.map((b) => b._w).filter(Boolean); if (wn.length && !confirm('⚠ ' + wn.join('\n') + '\n\nبا همین حالت ثبت شود؟')) return;
  const nm = $('#nm').value.trim(), now = Date.now();
  ok.forEach((b, i) => { delete b._w; if (nm && ED.m == 'p') b.name = ok.length > 1 ? nm + ' ' + (i + 1) : nm; Object.assign(b, { id: rid(), created: now + i, tags: tg(), note: $('#nt').value.trim() }); setVis(b, $('#vs').value); S.bets.push(b); });
  $('#ad').close(); save(); render(); liveFetch().then(render); toast(ok.length + ' بلیت ثبت شد');
}
/* ---- نتیجهٔ دستی، کش‌اوت، تطبیق بازی ---- */
let OV = null;
function openOv(b, i) { const l = b.legs[i], o = l.ov || l.fin; OV = { l }; $('#ovt').textContent = l.home + ' – ' + l.away; $('#ovh').textContent = ''; $('#oh').value = o ? o.h : ''; $('#oa').value = o ? o.a : ''; $('#om').value = (l.ov && l.ov.m) || ''; $('#os').value = (l.ov && l.ov.f) || (!l.ov && l.fin) ? 'fin' : 'live'; $('#ow').hidden = !l.pick.includes('Q'); $('#ow').value = (o && o.w) || 0; $('#ov').showModal(); }
let CO = null;
function openCo(b) { CO = b; $('#cot').textContent = 'ماشین‌حساب کش‌اوت · ' + b.name; $('#cov').value = b.cash == null ? '' : b.cash; coCalc(); $('#co').showModal(); }
function coCalc() {
  const s = R.st.get(CO.id), pr = s.lost ? 0 : s.pr, win = CO.win * s.fa, o = num($('#cov').value), E = pr * win;
  $('#cor').innerHTML = `احتمال تقریبی برد: <b>${(pr * 100).toFixed(1)}%</b> (خوش‌بینانه؛ حاشیهٔ سایت لحاظ نشده)<br>برد در صورت نگه‌داشتن: <b>${nf(win)}</b> · ارزش مورد انتظار نگه‌داشتن: <b>${nf(E)}</b>` + (o > 0 ? `<br>پیشنهاد سایت: <b>${o}</b> · احتمال لازم برای ارزش نگه‌داشتن: <b>${win ? (o / win * 100).toFixed(1) : '—'}%</b><br><b style="color:var(--${o >= E ? 'g' : 'o'})">${o >= E ? 'کش‌اوت از ارزش مورد انتظارِ نگه‌داشتن بیشتر است' : 'نگه‌داشتن ارزش مورد انتظار بیشتری دارد'} (اختلاف ${nf(o - E)})</b><br><span class="mut">راهنمای تقریبی است، نه توصیهٔ مالی.</span>` : '<br><span class="mut">مبلغ پیشنهادی سایت را وارد کنید.</span>');
}
let MP = null;
function openMap(l) { MP = { l, R: [] }; $('#mt').textContent = l.home + ' – ' + l.away; $('#mq').value = ''; mlist(); $('#mp').showModal(); }
function mlist() {
  const k = Core.fold($('#mq').value).trim() || Core.fold(MP.l.home).split(' ')[0];
  MP.R = S.LV.filter((e) => Core.fold(e.home + ' ' + e.away).includes(k)).slice(0, 30);
  $('#ml').innerHTML = MP.R.length ? MP.R.map((e, i) => `<button type="button" class="btn" style="width:100%;margin:3px 0;text-align:start" data-i="${i}">${esc(e.home)} – ${esc(e.away)} <span class="mut sm">${Core.SN[e.s] || e.s} ${e.t ? fD(e.t) : ''}</span></button>`).join('') : '<div class="mut sm">موردی در منابع پیدا نشد؛ کلمهٔ دیگری بنویسید.</div>';
}
/* ---- ورود/خروجی JSON و پشتیبان ---- */
function importRecords(recs) {
  const have = new Set(allRecs().map((r) => r.id)), add = recs.filter((r) => r && r.id && Array.isArray(r.legs) && !have.has(r.id));
  if (!add.length) return toast('بلیت جدیدی برای افزودن نبود');
  if (!confirm(add.length + ' بلیت جدید از ' + recs.length + ' بلیتِ فایل افزوده شود؟ (تکراری‌ها نادیده گرفته می‌شوند)')) return;
  add.forEach((r) => (r.del ? S.trash : S.bets).push(r)); save(); render(); liveFetch().then(render); toast(add.length + ' بلیت افزوده شد');
}
function exportJson() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 2, exported: Date.now(), bets: S.bets, trash: S.trash }, null, 1)], { type: 'application/json' })); a.download = 'betslip-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); }
async function openBackup() { const sel = $('#bkd'); sel.innerHTML = ''; for (let i = 0; i < 14; i++) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); sel.add(new Option(d + (i ? '' : ' (امروز)'), d)); } $('#bkm').textContent = ''; $('#bk').showModal(); }
async function openTg() {
  try {
    const j = await api('/api/settings'); S.tg = j;
    $('#tc').value = j.chat || ''; $('#ton').checked = !!j.on; $('#tt').value = ''; $('#tt').placeholder = j.hasToken ? 'توکن ذخیره شده؛ برای تغییر، توکن جدید را وارد کنید' : 'توکن ربات';
    $('#tst').checked = j.st !== false; $('#tgl').checked = j.gl !== false; $('#ten').checked = j.en !== false; $('#tsm').value = String(j.sum == null ? 15 : j.sum); $('#tmsg').textContent = '';
    const r = j.lastRes; $('#tlr').textContent = r ? `آخرین اجرای زمان‌بند: ${Math.round((Date.now() - r.at) / 6e4)} دقیقه پیش` + (r.err ? ' · خطا: ' + r.err : ` · بازی‌ها: ${r.games} · پیام‌ها: ${r.sent}`) : 'زمان‌بند هنوز هیچ‌بار اجرا نشده؛ بدون آن اعلان خودکار ارسال نمی‌شود.';
    $('#sg').showModal();
  } catch (x) { toast('خطا: ' + x.message); }
}
function bindDialogs() {
  $('#sw').onclick = () => { SU = !SU; $('#lt').textContent = SU ? 'ثبت‌نام' : 'ورود'; $('#iv').hidden = !SU; $('#em').hidden = !SU; $('#sw').textContent = SU ? 'حساب دارید؟ ورود' : 'حساب ندارید؟ ثبت‌نام'; };
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); $('#le').textContent = '';
    try {
      const body = { action: SU ? 'signup' : 'login', user: $('#un').value, pass: $('#pw').value, invite: $('#iv').value };
      if (SU) body.email = $('#em').value;
      const j = await api('/api/auth', { method: 'POST', body });
      S.tok = j.token; S.me = j.user.username; S.userId = j.user.id; ls.s('tok', j.token); ls.s('me', j.user.username); ls.s('userId', j.user.id); $('#pw').value = ''; $('#em').value = ''; $('#lg').close(); await boot(); }
    catch (x) { $('#le').textContent = x.message; }
  };
  $$('#admode button').forEach((b) => (b.onclick = () => edMode(b.dataset.m)));
  $('#fadd').onclick = () => { const p = mkc($('#fc').value, $('#fv').value); if (!p) { $('#hint').textContent = 'مقدار شرط نامعتبر است.'; return; } ED.CUR.push(p); $('#fv').value = ''; flist(); };
  $('#fleg').onclick = () => {
    const o = num($('#fo').value), f = fl();
    if (!$('#fh').value.trim() || !$('#fa').value.trim() || !(o > 1) || !ED.CUR.length) { $('#hint').textContent = 'نام هر دو تیم، ضریب (بزرگ‌تر از 1) و حداقل یک شرط لازم است.'; return; }
    const nl = { home: f.home, away: f.away, pick: ED.CUR.join('&'), odds: o };
    if (ED.EL && ED.EL.home == f.home && ED.EL.away == f.away) ['ov', 'fin', 'map', 'lg'].forEach((k) => { if (ED.EL[k]) nl[k] = ED.EL[k]; });
    ED.EL = null; ED.DL.push(nl); ED.CUR = []; ['fh', 'fa', 'fo', 'fv'].forEach((k) => ($('#' + k).value = '')); flist();
  };
  $('#flist').addEventListener('click', (e) => { const a = e.target.closest('[data-r],[data-e]'); if (!a) return; e.preventDefault(); if (a.dataset.r != null) ED.DL.splice(+a.dataset.r, 1); else { const l = ED.DL.splice(+a.dataset.e, 1)[0]; ED.EL = l; $('#fh').value = l.home; $('#fa').value = l.away; $('#fo').value = l.odds; ED.CUR = l.pick.split('&'); } flist(); });
  $('#ok').onclick = edSave; $('#cl').onclick = () => $('#ad').close(); $('#ad').addEventListener('close', () => { ED.edit = null; });
  $('#ovs').onclick = () => {
    const l = OV.l, h = parseInt($('#oh').value), a = parseInt($('#oa').value); if (!(h >= 0 && a >= 0)) { $('#ovh').textContent = 'گل هر دو تیم را وارد کنید.'; return; }
    const w = +$('#ow').value || 0;
    if ($('#os').value == 'fin') { l.ov = { h, a, f: 1, w }; l.fin = { h, a, w, t: null, lg: l.lg || '' }; } else { l.ov = { h, a, f: 0, m: parseInt($('#om').value) || 0 }; delete l.fin; }
    $('#ov').close(); save(); render();
  };
  $('#ovc').onclick = () => { delete OV.l.ov; $('#ov').close(); save(); render(); }; $('#ovr').onclick = () => { delete OV.l.ov; delete OV.l.fin; $('#ov').close(); save(); render(); }; $('#ovx').onclick = () => $('#ov').close();
  $('#cov').oninput = coCalc; $('#cox').onclick = () => $('#co').close();
  $('#mq').oninput = mlist; $('#mc').onclick = () => $('#mp').close();
  $('#ml').onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const E = MP.R[b.dataset.i]; S.bets.forEach((x) => x.legs.forEach((l) => { if (l.home == MP.l.home && l.away == MP.l.away) l.map = { h: E.home, a: E.away }; })); save(); $('#mp').close(); render(); };
  $('#fi').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const j = JSON.parse(await f.text()); const recs = Array.isArray(j) ? j : (j.bets || []).concat((j.trash || []).map((t) => t)); if (!recs.length || recs.some((b) => !b || !Array.isArray(b.legs))) throw 0; importRecords(recs); } catch (x) { toast('فایل JSON معتبر نیست.'); } };
  $('#bkx').onclick = () => $('#bk').close();
  $('#bkg').onclick = async () => { $('#bkm').textContent = 'در حال دریافت…'; try { const j = await api('/api/data?backup=' + $('#bkd').value); if (!j.records.length) { $('#bkm').textContent = 'برای این روز پشتیبانی نیست.'; return; } $('#bk').close(); importRecords(j.records); } catch (x) { $('#bkm').textContent = x.message; } };
  const sbody = (test) => ({ token: $('#tt').value, chat: $('#tc').value, on: $('#ton').checked, st: $('#tst').checked, gl: $('#tgl').checked, en: $('#ten').checked, sum: +$('#tsm').value, test });
  const tsend = async (test) => { try { const j = await api('/api/settings', { method: 'PUT', body: sbody(test) }); S.tg = Object.assign(S.tg || {}, { on: $('#ton').checked, hasToken: true }); $('#tmsg').textContent = test ? j.msg : 'ذخیره شد.'; } catch (x) { $('#tmsg').textContent = x.message; } };
  $('#tsv').onclick = () => tsend(false); $('#tts').onclick = () => tsend(true); $('#tcl').onclick = () => $('#sg').close();
  $('#trn').onclick = async () => { $('#tmsg').textContent = 'در حال اجرا…'; try { await api('/api/settings', { method: 'PUT', body: sbody(false) }); const j = await api('/api/notify?me=1'); $('#tmsg').textContent = `رویداد منابع: ${j.events} · بازی‌های بلیت‌های فعال: ${j.games} (زنده ${j.live}، پیدا‌نشده ${j.missing}) · پیام ارسال‌شده: ${j.sent}`; } catch (x) { $('#tmsg').textContent = x.message; } };
  $('#thk').onclick = async () => { $('#tmsg').textContent = 'در حال فعال‌سازی…'; try { const j = await api('/api/settings', { method: 'PUT', body: Object.assign(sbody(false), { hook: true, base: location.origin + BASE }) }); $('#tmsg').textContent = j.msg; } catch (x) { $('#tmsg').textContent = x.message; } };
}
