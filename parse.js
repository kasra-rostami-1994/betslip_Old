/* parse.js: خواندن متن بلیت سایت شرط‌بندی + فهرست نوع شرط‌ها */
const {fold}=Core;
const num=s=>parseFloat(String(s).replace(/,/g,''));
function toPick(sel,h){const s=sel.trim(),m=s.match(/^(over|under)\s+([\d.]+)$/i);
 if(m)return m[1][0].toUpperCase()+m[2];if(/^draw$/i.test(s))return'X';
 const p=s.split(/ or /i);if(p.length==2)return/^draw$/i.test(p[0].trim())?'X2':'1X';
 return fold(s).trim()==fold(h).trim()?'1':'2'}
function parseBlock(t){
 const L=t.split('\n').map(s=>s.trim().replace(/^[*•]\s*/,'')).filter(s=>s&&!/^\(\s*\d+\s*[:\-]\s*\d+\s*\)$/.test(s)),legs=[];
 L.forEach((s,i)=>{if(i>=3&&/^(1x2|double chance|asian total)$/i.test(L[i-1].replace(/\s*\(\s*\d+\s*[:\-]\s*\d+\s*\)$/,''))&&/^\d+(\.\d+)?(\(\d+:\d+\))?$/.test(L[i-2])&&s.includes(' - ')){
  const k=s.indexOf(' - '),home=s.slice(0,k).trim(),away=s.slice(k+3).trim();
  legs.push({home,away,pick:toPick(L[i-3],home),odds:parseFloat(L[i-2])})}});
 if(!legs.length)return null;
 const w=L.findIndex(s=>/^Potential win/i.test(s)),n=w>=0?L.slice(w+1).filter(s=>/^[\d.,]+$/.test(s)).map(num):[];
 const c=L.findIndex(s=>/^Cash out$/i.test(s)),cv=c>=0?num(L[c+1]):NaN;
 const odds=n[0]||+legs.reduce((p,l)=>p*l.odds,1).toFixed(2),stake=n[1]||1;
 const mn=L.find(s=>/^multi\s+\d+/i.test(s)),ex=mn?+mn.match(/\d+/)[0]:0,pd=legs.reduce((p,l)=>p*l.odds,1),W=[];
 if(ex&&ex!=legs.length)W.push('در متن '+ex+' بازی نوشته شده ولی '+legs.length+' بازی تشخیص داده شد.');
 if(n[0]&&Math.abs(pd-n[0])/n[0]>.04)W.push('ضریب کل ('+n[0]+') با حاصل‌ضرب ضرایب بازی‌ها ('+pd.toFixed(2)+') نمی‌خواند؛ شاید بازی‌ای جا افتاده باشد.');
 return{name:mn||'multi '+legs.length,stake,odds,win:n[2]||+(stake*odds).toFixed(2),cash:isNaN(cv)?null:cv,legs,_w:W.join('\n')}}

const CT=[['1','برد میزبان'],['2','برد میهمان'],['X','مساوی'],['1X','میزبان یا مساوی'],['X2','مساوی یا میهمان'],['12','بدون مساوی'],['O','مجموع گل بالای … (مقدار: 2.5)'],['U','مجموع گل زیر … (مقدار: 3.5)'],['HO','گل میزبان بالای …'],['HU','گل میزبان زیر …'],['AO','گل میهمان بالای …'],['AU','گل میهمان زیر …'],['Q1','صعود میزبان (کل بازی، با وقت اضافه و پنالتی)'],['Q2','صعود میهمان (کل بازی)'],['BY','هر دو تیم گل می‌زنند'],['BN','حداقل یک تیم گل نمی‌زند'],['T','تعداد دقیق کل گل … (مقدار: 3)'],['S','نتیجهٔ دقیق … (مقدار: 2-1)'],['AH1','هندیکپ میزبان … (مقدار: -1.5)'],['AH2','هندیکپ میهمان … (مقدار: +0.5)']];
const needV=c=>!['1','2','X','1X','X2','12','BY','BN','Q1','Q2'].includes(c);

function parseManual(t,f){
 const legs=t.split('\n').map(s=>s.split('|').map(x=>x.trim())).filter(a=>a.length==3&&a[0].includes(' - ')).map(a=>{const k=a[0].indexOf(' - ');return{home:a[0].slice(0,k).trim(),away:a[0].slice(k+3).trim(),pick:a[1].toUpperCase(),odds:num(a[2])}}).filter(l=>l.odds>1);
 if(!legs.length)return null;
 const odds=num(f.odds)||+legs.reduce((p,l)=>p*l.odds,1).toFixed(2),stake=num(f.stake)||1;
 return{name:f.name||'multi '+legs.length,stake,odds,win:+(stake*odds).toFixed(2),cash:null,legs}}
