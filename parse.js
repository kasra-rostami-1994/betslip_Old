/* parse.js: خواندن متن بلیت سایت شرط‌بندی + فهرست نوع شرط‌ها */
const {fold}=Core;
const num=s=>parseFloat(String(s).replace(/,/g,''));
function toPick(sel,h){const s=sel.trim(),m=s.match(/^(over|under)\s+([\d.]+)$/i);
 if(m)return m[1][0].toUpperCase()+m[2];if(/^draw$/i.test(s))return'X';
 const p=s.split(/ or /i);if(p.length==2)return/^draw$/i.test(p[0].trim())?'X2':'1X';
 return fold(s).trim()==fold(h).trim()?'1':'2'}

// ---- Bet Builder parser ----
// Detects format with multiple conditions per match, team line, then * Odds/* Stake/* Potential win at end
// Values come AFTER all headers, not immediately after each header
function parseBetBuilder(t){
  const L=t.split('\n').map(s=>s.trim()).filter(s=>s);
  // Check for Bet Builder signature
  const hasBuilderHeader = L.some(s=>/^\*\s*Odds/i.test(s)) && L.some(s=>/^\*\s*Stake/i.test(s)) && L.some(s=>/^\*\s*Potential win/i.test(s));
  if(!hasBuilderHeader) return null;

  // Find header indices
  const oddsIdx = L.findIndex(s=>/^\*\s*Odds/i.test(s));
  const stakeIdx = L.findIndex(s=>/^\*\s*Stake/i.test(s));
  const winIdx = L.findIndex(s=>/^\*\s*Potential win/i.test(s));
  const headerEnd = Math.max(oddsIdx, stakeIdx, winIdx);

  // Values are the lines AFTER all headers that start with * and a number
  const valueLines = L.slice(headerEnd + 1).filter(s=>/^\*\s*[\d.,]/.test(s));
  let odds=1, stake=1, win=null;
  if(valueLines.length >= 1) odds = num(valueLines[0].match(/^\*\s*([\d.,]+)/)?.[1] || 1);
  if(valueLines.length >= 2) stake = num(valueLines[1].match(/^\*\s*([\d.,]+)/)?.[1] || 1);
  if(valueLines.length >= 3) win = num(valueLines[2].match(/^\*\s*([\d.,]+)/)?.[1] || null);
  if(!win) win = +(stake*odds).toFixed(2);

  // Parse match blocks - everything before the summary headers
  const contentLines = L.slice(0, headerEnd);

  // Group lines by match (separated by empty lines in original, but we filtered them)
  // We need to reconstruct: conditions... then team line (contains " - "), repeat
  const matches=[], currentConds=[];
  for(const line of contentLines){
    if(line.includes(' - ') && !/^\*/.test(line) && !/over|under|double chance|each team|total |handicap|asian|draw|1x2/i.test(line)){
      // This looks like a team line (home - away)
      if(currentConds.length>0){
        matches.push({conds:[...currentConds], teamLine:line});
        currentConds.length=0;
      }else{
        // Team line without conditions - might be simple format
        matches.push({conds:[], teamLine:line});
      }
    }else if(!/^\*/.test(line)){
      // Condition line
      currentConds.push(line);
    }
  }
  // Handle last match if no trailing team line
  if(currentConds.length>0){
    matches.push({conds:[...currentConds], teamLine:null});
  }

  if(!matches.length) return null;

  // Build legs - each match becomes one leg with combined conditions
  const legs = matches.map(m=>{
    const k = m.teamLine ? m.teamLine.indexOf(' - ') : -1;
    const home = k>0 ? m.teamLine.slice(0,k).trim() : 'Unknown';
    const away = k>0 ? m.teamLine.slice(k+3).trim() : 'Unknown';
    // Combine conditions into pick string
    const pick = m.conds.length ? m.conds.join(' | ') : 'Bet Builder';
    return {home, away, pick, odds: 1.0}; // odds=1 placeholder, will be adjusted
  });

  // Distribute total odds across legs (geometric mean)
  if(legs.length>0 && odds>1){
    const legOdds = +Math.pow(odds, 1/legs.length).toFixed(2);
    legs.forEach(l=>l.odds=legOdds);
  }

  const W = [];
  if(legs.length>0 && odds>1){
    const pd = +legs.reduce((p,l)=>p*l.odds,1).toFixed(2);
    if(Math.abs(pd-odds)/odds > 0.04){
      W.push(`توزیع تقریبی ضریب: هر بازی ${legs[0].odds} (ضریب کل ${pd} vs اصلی ${odds})`);
    }
  }

  return {
    name: 'Bet Builder ' + legs.length,
    stake, odds, win, cash: null, legs, _w: W.join('\n')
  };
}

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
