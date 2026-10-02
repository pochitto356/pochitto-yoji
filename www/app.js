'use strict';
// ================= 保存 =================
const KEY='py_v1';
const DEF={streak:0,lastDay:null,best:0,daily:{},seen:{},tut:false,sound:true,notif:true,notifTime:'08:00',firstDay:null,
  badges:{},stats:{perfect:0,practiceBest:0,archive:0,hints:0,correct:0},protectUsed:null};
let S=JSON.parse(JSON.stringify(DEF));
try{const s=localStorage.getItem(KEY);if(s){const o=JSON.parse(s);S=Object.assign(S,o);S.stats=Object.assign({},DEF.stats,o.stats||{});S.seen=o.seen||{};}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

// ================= 日付 =================
const EPOCH=new Date(2026,9,1); // 2026-10-01 = #1(ローカル日付)
const DAY=86400000;
const mid=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
function dayIndex(d=new Date()){return Math.round((mid(d)-mid(EPOCH))/DAY)+1;}
function dateFromN(n){const d=new Date(EPOCH);d.setDate(d.getDate()+n-1);return d;}
function dayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function keyFromN(n){return dayKey(dateFromN(n));}
const todayN=()=>dayIndex(new Date());
const yKey=()=>dayKey(new Date(Date.now()-DAY)),y2Key=()=>dayKey(new Date(Date.now()-2*DAY));

// ================= 乱数(決定的) =================
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function shuffle(a,r=Math.random){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

// ================= 問題の組み立て =================
const DAILY_LEVELS=[1,1,2,2,3];
const WORDS=new Set(YOJI.map(y=>y.w));
// 位置ごとの漢字プール(ダミーの候補用)
const POS_POOL=[0,1,2,3].map(p=>[...new Set(YOJI.map(y=>y.w[p]))]);
function makeQ(y,r){
  const chars=[...y.w];
  const pos=Math.floor(r()*4);
  const ans=chars[pos];
  const n=y.level===1?4:6;
  // ダミー: 同じ位置に入る漢字から選ぶ。入れても別の収録語にならないものだけ
  const cands=shuffle(POS_POOL[pos],r).filter(k=>{
    if(k===ans)return false;
    const t=chars.slice();t[pos]=k;return !WORDS.has(t.join(''));
  });
  const choices=shuffle([ans,...cands.slice(0,n-1)],r);
  return {id:y.id,pos,ans,choices};
}
// 各難易度のプールを決定的に並べ替え、1周するまで同じ語を出さない
function dailySet(n){
  const used={};
  return DAILY_LEVELS.map((lv,slot)=>{
    const pool=YOJI.filter(x=>x.level===lv).sort((a,b)=>a.id-b.id);
    const per=DAILY_LEVELS.filter(l=>l===lv).length; // その難易度が1日に何問か
    const k=(used[lv]=(used[lv]||0)+1)-1;
    const idx0=(n-1)*per+k;
    const cycle=Math.floor(idx0/pool.length),idx=idx0%pool.length;
    const order=shuffle(pool,rng(20261001+lv*1000+cycle));
    const y=order[idx];
    return makeQ(y,rng(n*97+slot*13+y.id));
  });
}
const Y=id=>YOJI.find(x=>x.id===id);

// ================= 効果音(Web Audio) =================
let AC=null;
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC;}
function tone(f,t0,dur,type='sine',vol=.18){const c=ac();if(!c||!S.sound)return;const o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,c.currentTime+t0);g.gain.linearRampToValueAtTime(vol,c.currentTime+t0+.01);
  g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+t0+dur);o.connect(g);g.connect(c.destination);o.start(c.currentTime+t0);o.stop(c.currentTime+t0+dur+.05);}
const sfx={
  tap(){tone(880,0,.05,'triangle',.08);},
  ok(){tone(660,0,.12,'sine');tone(990,.1,.2,'sine');},
  ng(){tone(180,0,.18,'square',.08);},
  perfect(){[523,659,784,1047].forEach((f,i)=>tone(f,i*.09,.25,'triangle',.15));},
  badge(){[784,1047,1319].forEach((f,i)=>tone(f,i*.08,.3,'sine',.12));},
  reveal(){tone(330,0,.3,'sine',.1);}
};

// ================= 画面ユーティリティ =================
const $=id=>document.getElementById(id);
let show=function(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));$(id).classList.add('on');window.scrollTo(0,0);};
let toastT;function toast(t,ms=1600){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),ms);}
function modal(title,body,ok,cancel,okLabel='OK'){
  $('ovTitle').textContent=title;$('ovBody').textContent=body;$('ov').classList.add('on');
  $('ovOk').textContent=okLabel;$('ovCancel').style.display=cancel?'block':'none';
  $('ovOk').onclick=()=>{$('ov').classList.remove('on');ok&&ok();};
  $('ovCancel').onclick=()=>{$('ov').classList.remove('on');cancel&&cancel();};
}
window.modal=modal;
const LV=['','定番','中級','上級'];
function resHTML(y,mark){
  return `<div class="res"><span class="k" style="letter-spacing:.06em">${y.w}</span><span class="w">${mark?mark+' ':''}<ruby>${y.r}</ruby><br>${y.m}</span></div>`;
}

// ================= バッジ =================
const seenN=()=>Object.keys(S.seen).length;
const BADGES=[
  {id:'first',ic:'🌱',name:'はじめの一歩',desc:'今日の5問を初めて解いた',test:()=>Object.keys(S.daily).length>=1},
  {id:'perfect1',ic:'💮',name:'満点!',desc:'5問すべて🟩',test:()=>S.stats.perfect>=1},
  {id:'perfect5',ic:'🎯',name:'百発百中',desc:'5問すべて🟩 を5回',test:()=>S.stats.perfect>=5},
  {id:'streak3',ic:'🔥',name:'三日坊主…じゃない',desc:'3日連続',test:()=>S.streak>=3},
  {id:'streak7',ic:'🏮',name:'一週間',desc:'7日連続',test:()=>S.streak>=7},
  {id:'streak30',ic:'🎋',name:'初志貫徹',desc:'30日連続',test:()=>S.streak>=30},
  {id:'zukan30',ic:'📗',name:'図鑑30語',desc:'図鑑に30語集めた',test:()=>seenN()>=30},
  {id:'zukan100',ic:'📘',name:'図鑑100語',desc:'図鑑に100語集めた',test:()=>seenN()>=100},
  {id:'zukanAll',ic:'📚',name:'博覧強記',desc:'図鑑をすべて埋めた',test:()=>seenN()>=YOJI.length},
  {id:'archive5',ic:'📅',name:'温故知新',desc:'過去問を5日分解いた',test:()=>S.stats.archive>=5},
  {id:'practice10',ic:'✏️',name:'切磋琢磨',desc:'練習で10問連続正解',test:()=>S.stats.practiceBest>=10},
  {id:'practice30',ic:'🏆',name:'一騎当千',desc:'練習で30問連続正解',test:()=>S.stats.practiceBest>=30},
];
function checkBadges(){
  const got=[];
  BADGES.forEach(b=>{if(!S.badges[b.id]&&b.test()){S.badges[b.id]=dayKey();got.push(b);}});
  if(got.length){save();sfx.badge();got.forEach((b,i)=>setTimeout(()=>toast(`🏅 バッジ獲得: ${b.name}`,2200),600+i*2300));}
}
function renderBadges(){
  const n=Object.keys(S.badges).length;$('badCount').textContent=`${n} / ${BADGES.length}`;
  $('badgeList').innerHTML=BADGES.map(b=>`<div class="badge ${S.badges[b.id]?'':'lock'}"><div class="ic">${b.ic}</div><div><b>${b.name}</b><small>${b.desc}${S.badges[b.id]?'<br>'+S.badges[b.id]:''}</small></div></div>`).join('');
  show('badges');
}

// ================= 図鑑 =================
let zLv=1;
function renderZukan(){
  const n=seenN();$('zCount').textContent=`${n} / ${YOJI.length}`;$('zBar').style.width=(n/YOJI.length*100)+'%';
  $('zTabs').innerHTML=[1,2,3].map(l=>{const t=YOJI.filter(y=>y.level===l),g=t.filter(y=>S.seen[y.id]).length;
    return `<button class="${l===zLv?'on':''}" data-l="${l}">${LV[l]} ${g}/${t.length}</button>`;}).join('');
  $('zTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{sfx.tap();zLv=+b.dataset.l;renderZukan();});
  $('zList').innerHTML=YOJI.filter(y=>y.level===zLv).map(y=>S.seen[y.id]
    ?`<div class="zi" data-id="${y.id}"><b>${y.w}</b><small>${y.r}</small></div>`
    :`<div class="zi lock"><b>？？？？</b><small>まだ出会っていない</small></div>`).join('');
  $('zList').querySelectorAll('.zi[data-id]').forEach(e=>e.onclick=()=>{const y=Y(+e.dataset.id);modal(y.w,`${y.r}\n\n${y.m}`);});
  show('zukan');
}

// ================= ホーム =================
function renderHome(){
  const today=dayKey();
  if(S.lastDay&&S.lastDay!==today&&S.lastDay!==yKey()){
    if(S.streak>0&&S.lastDay===y2Key()&&S.protectUsed!==today){
      const st=S.streak;
      Native.rewarded('🔥 連続記録が途切れそう!',`昨日は解いていません。動画を見ると、${st}日連続の記録を守れます。`,
        ()=>{S.lastDay=yKey();S.protectUsed=today;save();toast('連続記録を守りました');renderHome();},
        ()=>{S.streak=0;save();renderHome();});
      return;
    }
    S.streak=0;save();
  }
  $('hStreak').textContent=S.streak;$('hZukan').textContent=seenN();
  $('hBadges').textContent=Object.keys(S.badges).length;$('hCount').textContent=YOJI.length;
  const done=S.daily[today];
  $('bDaily').textContent=done?'今日の結果を見る ✓':`今日の5問  #${todayN()}`;
  show('home');
}

// ================= ゲーム =================
let G=null;
// mode: 'daily' | 'archive' | 'practice' | 'tut' | 'view'
function startDaily(){
  const today=dayKey();
  if(S.daily[today]){showDailyResult(S.daily[today]);return;}
  if(!S.tut){startTutorial();return;}
  G={mode:'daily',n:todayN(),list:dailySet(todayN()),i:0,marks:[]};loadQ();
}
function startArchive(n){
  const k=keyFromN(n);
  if(S.daily[k]){showDailyResult(S.daily[k]);return;}
  G={mode:'archive',n,list:dailySet(n),i:0,marks:[]};loadQ();
}
function practiceList(){return shuffle(YOJI).map(y=>makeQ(y,Math.random));}
function startPractice(){
  G={mode:'practice',list:practiceList(),i:0,marks:[],lives:3,score:0,wrongs:[],continued:false};loadQ();
}
function startTutorial(){
  modal('はじめまして!','四字熟語の □ に入る漢字を、下の候補から選ぶゲームです。\nまず1問、いっしょにやってみましょう。',
    ()=>{const y=YOJI.find(x=>x.w==='一石二鳥');G={mode:'tut',list:[{id:y.id,pos:3,ans:'鳥',choices:['馬','鳥','魚','虫']}],i:0,marks:[]};loadQ();},null,'やってみる');
}
function tiles(q,state){
  const y=Y(q.id);
  return [...y.w].map((k,i)=>i===q.pos
    ?`<div class="yt ${state||'blank'}" id="ytB">${state?k:'？'}</div>`
    :`<div class="yt">${k}</div>`).join('');
}
function loadQ(){
  const q=G.list[G.i],y=Y(q.id);
  G.tries=0;G.hint=0;G.mean=false;G.answered=false;
  $('yoji').innerHTML=tiles(q);
  $('yread').textContent='';
  const m=$('ymean');m.className='ymean';m.innerHTML='';
  const msg=$('pMsg');msg.className='msg';
  if(G.mode==='tut'){msg.className='msg tut';msg.textContent='「一つの石で二羽の…」 □ に入る漢字をタップ!';}
  else msg.innerHTML=`□ に入る漢字は？<span class="lvtag">${LV[y.level]}</span>`;
  $('pProg').textContent=G.mode==='tut'?'れんしゅう問題':G.mode==='practice'?`練習  ${G.score} 問連続`:`${G.mode==='archive'?'過去問':'今日の5問'}  ${G.i+1} / 5`;
  $('pLives').textContent=G.mode==='practice'?'❤'.repeat(G.lives)+'♡'.repeat(3-G.lives):(G.mode==='tut'?'':'#'+G.n);
  const ch=$('choices');ch.innerHTML='';ch.className='choices'+(q.choices.length===4?' c4':'');
  q.choices.forEach(k=>{const b=document.createElement('button');b.className='ch';b.textContent=k;b.onclick=()=>{sfx.tap();answer(k,b);};ch.appendChild(b);});
  $('tried').innerHTML='';
  $('hintRow').style.display=G.mode==='tut'?'none':'';
  $('bMean').disabled=false;$('bHint').disabled=false;
  $('bNext').style.display='none';
  show('play');
}
function answer(k,btn){
  if(G.answered)return;
  const q=G.list[G.i];G.tries++;
  if(k===q.ans){
    G.answered=true;btn.classList.add('right');sfx.ok();
    $('yoji').innerHTML=tiles(q,'ok');
    const mark=(G.tries===1&&G.hint===0&&!G.mean)?'🟩':'🟨';
    finishQ(mark,true);
  }else{
    sfx.ng();btn.classList.add('wrong');
    const b=$('ytB');b.classList.add('ng');setTimeout(()=>b&&b.classList.remove('ng'),350);
    if(G.mode==='practice'){
      G.lives--;$('pLives').textContent='❤'.repeat(Math.max(0,G.lives))+'♡'.repeat(3-Math.max(0,G.lives));G.wrongs.push(q.id);
      if(G.lives<=0){reveal(q);G.answered=true;showAnswerInfo(q);setTimeout(()=>practiceOver(),1200);return;}
      $('pMsg').textContent='ちがう… 残り ❤'+G.lives;
    }else if(G.mode==='tut'){
      $('pMsg').textContent='おしい! 「一つの石で二羽の"とり"を落とす」';
    }else{
      if(G.tries>=2){reveal(q);G.answered=true;finishQ('🟥',false);return;}
      $('pMsg').textContent='おしい! もう一度';
    }
  }
}
function reveal(q){sfx.reveal();$('yoji').innerHTML=tiles(q,'rev');
  document.querySelectorAll('.ch').forEach(b=>{if(b.textContent===q.ans)b.classList.add('right');});}
function showAnswerInfo(q){
  const y=Y(q.id);
  $('yread').textContent=y.r;
  const m=$('ymean');m.className='ymean on';m.innerHTML=`<b>${y.w}</b>　${y.m}`;
  $('hintRow').style.display='none';
}
function finishQ(mark,ok){
  const q=G.list[G.i];
  if(ok&&G.mode!=='tut'){if(!S.seen[q.id])S.seen[q.id]=dayKey();S.stats.correct++;save();}
  showAnswerInfo(q);
  $('pMsg').className='msg';$('pMsg').textContent=ok?(mark==='🟩'?'正解!':'正解'):'残念…';
  if(G.mode==='tut'){$('bNext').style.display='';$('bNext').textContent='今日の5問へ ▶';return;}
  if(G.mode==='practice'){G.score++;$('bNext').style.display='';$('bNext').textContent='次へ ▶';return;}
  G.marks.push(mark);$('bNext').style.display='';$('bNext').textContent=G.i<4?'次へ ▶':'結果を見る ▶';
}
function next(){
  sfx.tap();
  if(G.mode==='tut'){S.tut=true;save();toast('準備OK! 今日の5問へ');startDaily();return;}
  if(G.mode==='practice'){
    G.i++;if(G.i>=G.list.length){G.list=practiceList();G.i=0;}
    if(G.score>0&&G.score%8===0&&adsUnlocked())Native.interstitial(()=>loadQ());else loadQ();
    return;
  }
  if(G.i<4){G.i++;loadQ();}else dailyDone();
}
// ヒント: 意味(1問1回まで無料) / 2つ消す(動画)
function meaningHint(){
  const q=G.list[G.i],y=Y(q.id);
  const doIt=()=>{G.mean=true;S.stats.hints++;save();const m=$('ymean');m.className='ymean on';m.innerHTML=`意味: ${y.m}`;$('bMean').disabled=true;};
  if(G.mode==='practice')Native.rewarded('意味を見る','動画を見ると、この四字熟語の意味がわかります。',doIt,()=>{});
  else doIt();
}
function removeTwo(){
  const q=G.list[G.i];
  Native.rewarded('ヒント','動画を見ると、まちがいの候補を2つ消せます。',()=>{
    G.hint++;S.stats.hints++;save();
    const cand=[...document.querySelectorAll('.ch')].filter(b=>b.textContent!==q.ans&&!b.classList.contains('off')&&!b.classList.contains('wrong'));
    shuffle(cand).slice(0,2).forEach(b=>b.classList.add('off'));
    if(!Native.isPremium())$('bHint').disabled=true;toast('候補を2つ消しました');
  },()=>{});
}
function dailyDone(){
  const k=keyFromN(G.n),today=dayKey();
  if(G.mode==='daily'){S.streak=(S.lastDay===yKey())?S.streak+1:(S.lastDay===today?S.streak:1);S.lastDay=today;}
  else S.stats.archive++;
  const perfect=G.marks.every(m=>m==='🟩');if(perfect)S.stats.perfect++;
  const rec={n:G.n,marks:G.marks,ids:G.list.map(q=>q.id),streak:S.streak,mode:G.mode};
  S.daily[k]=rec;save();showDailyResult(rec,true);checkBadges();
}
function showDailyResult(rec,fresh=false){
  const isToday=rec.n===todayN();
  $('rTitle').textContent=(isToday?'今日の5問':'過去問 '+keyFromN(rec.n))+' #'+rec.n;
  const g=rec.marks.filter(m=>m==='🟩').length;
  $('rBig').textContent=g===5?'満点!':g>=4?'お見事':g>=3?'いい感じ':g>=1?'まずまず':'次はきっと';
  $('rTiles').textContent=rec.marks.join('');
  $('rStreakCard').style.display=isToday?'':'none';$('rStreak').textContent=S.streak;
  $('rList').innerHTML=rec.ids.map((id,i)=>resHTML(Y(id),rec.marks[i])).join('');
  const st=$('stamp');st.className='stamp';
  show('result');
  if(fresh&&g===5){setTimeout(()=>{st.className='stamp on';sfx.perfect();},250);}
  G={mode:'view',rec};
}
function practiceOver(){
  if(!G.continued){
    Native.rewarded('コンティニュー?','動画を見ると ❤ を1つ回復して続けられます。',()=>{G.continued=true;G.lives=1;G.i++;if(G.i>=G.list.length){G.list=practiceList();G.i=0;}loadQ();},()=>practiceEnd());
  }else practiceEnd();
}
function practiceEnd(){
  if(G.score>S.best)S.best=G.score;
  if(G.score>S.stats.practiceBest)S.stats.practiceBest=G.score;save();
  $('prScore').textContent=G.score;$('prBest').textContent=S.best;
  const ids=[...new Set(G.wrongs)];
  $('prList').innerHTML=ids.map(id=>resHTML(Y(id))).join('')||'<div style="color:var(--sub);font-size:13px">なし</div>';
  show('presult');checkBadges();
}
function share(){
  const rec=G&&G.rec;if(!rec)return;
  const text=`ぽちっと四字熟語 #${rec.n} ${rec.marks.join('')}${rec.mode==='daily'?` 🔥${rec.streak}日目`:''}\n□に入る漢字、わかる？`;
  Native.share(text);
}

// ================= 過去問カレンダー =================
let calY,calM;
function openArchive(){const d=new Date();calY=d.getFullYear();calM=d.getMonth();renderCal();show('archive');}
function renderCal(){
  const first=new Date(calY,calM,1),last=new Date(calY,calM+1,0);
  $('calTitle').textContent=`${calY}年${calM+1}月`;
  const minM=new Date(EPOCH.getFullYear(),EPOCH.getMonth(),1),now=new Date();
  $('calPrev').disabled=first<=minM;$('calNext').disabled=(calY>now.getFullYear())||(calY===now.getFullYear()&&calM>=now.getMonth());
  const cal=$('cal');cal.innerHTML=['日','月','火','水','木','金','土'].map(d=>`<div class="dow">${d}</div>`).join('');
  for(let i=0;i<first.getDay();i++){const e=document.createElement('div');e.className='day off';cal.appendChild(e);}
  const tN=todayN();
  for(let d=1;d<=last.getDate();d++){
    const dt=new Date(calY,calM,d),n=dayIndex(dt),k=dayKey(dt),rec=S.daily[k];
    const e=document.createElement('div');e.className='day';e.innerHTML=`<span>${d}</span>`;
    if(n<1||n>tN){e.classList.add('na');}
    else{
      if(n===tN)e.classList.add('today');
      if(rec){e.classList.add('done');e.innerHTML+=`<div class="m">${rec.marks.map(m=>`<i class="${m==='🟩'?'g':m==='🟨'?'y':'r'}"></i>`).join('')}</div>`;}
      e.onclick=()=>{sfx.tap();n===tN?startDaily():startArchive(n);};
    }
    cal.appendChild(e);
  }
}

// ================= 設定 =================
const OTHER_APPS=[
  {n:'ぽちっと漢字',d:'まんなかの漢字を当てる毎日3問',id:'6811293101'},
  {n:'ぽちっと反射神経',d:'反応速度で反射神経年齢を測定',id:'6818035906'},
  {n:'押すな！ボタン',d:'押してはいけないボタンを避けるバカゲー',id:'6793996412'},
];
function renderSettings(){
  $('swSound').classList.toggle('on',S.sound);$('swNotif').classList.toggle('on',S.notif);$('notifTime').value=S.notifTime;
  $('otherApps').innerHTML=OTHER_APPS.map(a=>`<a class="res" style="text-decoration:none;color:inherit" href="https://apps.apple.com/jp/app/id${a.id}" target="_blank" rel="noopener"><span>${a.n}</span><span class="w">${a.d} ›</span></a>`).join('');
}

// ================= イベント =================
$('bDaily').onclick=()=>{sfx.tap();startDaily();};
$('bPractice').onclick=()=>{sfx.tap();startPractice();};
$('bArchive').onclick=()=>{sfx.tap();openArchive();};
$('bBadges').onclick=()=>{sfx.tap();renderBadges();};
$('bZukan').onclick=()=>{sfx.tap();renderZukan();};
$('hBadgeBox').onclick=renderBadges;$('hZukanBox').onclick=renderZukan;
$('bHow').onclick=()=>modal('遊び方','四字熟語の1文字が □ になっています。下の候補から正しい漢字を選んでください。\n\n・毎日5問（定番2・中級2・上級1）。みんな同じ問題です\n・1回目で正解なら🟩、2回目かヒントを使ったら🟨、2回まちがえたら🟥\n・「意味を見る」は今日の5問なら何度でも無料\n・正解した四字熟語は図鑑に集まります\n・練習モードは❤3つでどこまで続くか挑戦');
$('bSettings').onclick=()=>{sfx.tap();renderSettings();show('settings');};
$('bQuit').onclick=()=>modal('やめますか?',G&&G.mode==='practice'?'練習の記録は保存されません。':'途中の回答は保存されません(最初からになります)。',()=>renderHome(),()=>{});
$('bNext').onclick=next;$('bHint').onclick=()=>{sfx.tap();removeTwo();};$('bMean').onclick=()=>{sfx.tap();meaningHint();};
$('bResHome').onclick=renderHome;$('bResPractice').onclick=startPractice;$('bResArchive').onclick=openArchive;$('bShare').onclick=share;
$('bPResHome').onclick=renderHome;$('bPHome').onclick=renderHome;$('bPAgain').onclick=startPractice;
$('bArcHome').onclick=renderHome;$('calPrev').onclick=()=>{calM--;if(calM<0){calM=11;calY--;}renderCal();};$('calNext').onclick=()=>{calM++;if(calM>11){calM=0;calY++;}renderCal();};
$('bBadHome').onclick=renderHome;$('bSetHome').onclick=renderHome;$('bZukHome').onclick=renderHome;
$('bTutAgain').onclick=()=>{S.tut=false;save();startTutorial();};
$('bReset').onclick=()=>modal('記録をリセット','連続記録・図鑑・バッジ・履歴を消します。よろしいですか?',()=>{const keep={sound:S.sound,notif:S.notif,notifTime:S.notifTime};S=Object.assign(JSON.parse(JSON.stringify(DEF)),keep);S.firstDay=dayKey();save();toast('リセットしました');renderHome();},()=>{});
$('swSound').onclick=()=>{S.sound=!S.sound;save();renderSettings();sfx.tap();};
$('swNotif').onclick=()=>{S.notif=!S.notif;save();renderSettings();Native.scheduleDaily(S.notifTime,S.notif);};
$('notifTime').onchange=e=>{S.notifTime=e.target.value;save();toast('通知時刻: '+S.notifTime);Native.scheduleDaily(S.notifTime,S.notif);};
$('bBuy').onclick=()=>{sfx.tap();Native.buyPremium();};
$('bRestore').onclick=()=>{sfx.tap();Native.restore();};

// ================= 広告・課金 =================
// インタースティシャルは初回起動から3日目以降、練習モードの区切りでのみ(最初の体験を守る)
function adsUnlocked(){
  if(Native.isPremium()||!S.firstDay)return false;
  return (mid(new Date())-mid(new Date(S.firstDay)))/DAY>=2;
}
window.onPremiumChanged=v=>{applyPremium();if(v)modal('ありがとうございます','広告なし+ヒント無制限になりました。');};
function applyPremium(){
  const p=Native.isPremium();
  document.body.classList.toggle('has-banner',!p&&Native.isApp);
  const b=$('bBuy');if(b){b.disabled=p;b.textContent=p?'購入済み':'購入';}
  const n=$('buyNote');if(n)n.textContent=p?'購入済み。広告は表示されません':'¥300 買い切り';
}
function updateBanner(){Native.banner(!Native.isPremium()&&$('home').classList.contains('on'));}
const _show=show;show=id=>{_show(id);updateBanner();};

if(!S.firstDay){S.firstDay=dayKey();save();}
applyPremium();
renderHome();
Native.init().then(()=>{applyPremium();updateBanner();Native.scheduleDaily(S.notifTime,S.notif);});
