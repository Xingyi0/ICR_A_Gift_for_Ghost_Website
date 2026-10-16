const DIRECTIONS=[1,1,-1,-1,-1,1,1,-1,-1,-1,-1,-1];
let answers={}, extras={}, quizStep=0, showingResults=false;
const root=document.getElementById('quizRoot');

function esc(x){return String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function navigate(){
  let id=location.hash.slice(1)||'home';
  if(!document.getElementById(id)?.classList.contains('page')) id='home';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',navigate);

function scrollQuizTop(){
  const el=root.querySelector('.quiz-heading,.result,.quiz')||root;
  const y=el.getBoundingClientRect().top+window.scrollY-20;
  window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
}

function multiSelect(section,j,idx,checked){
  let a=answers['s'+j]||[];
  if(checked){
    if(section.exclusive?.includes(idx)) a=[];
    else a=a.filter(x=>!section.exclusive?.includes(x));
    if(!a.includes(idx)) a.push(idx);
  } else a=a.filter(x=>x!==idx);
  answers['s'+j]=a;
  renderQuiz();
}

function scaleOptions(k,{icons=scaleIcons(),aria=t('scale_aria')}={}){
  const row=icons.map(opt=>`<label class="likert-choice likert-${opt.size} likert-${opt.tone}"><input type="radio" name="${k}" value="${opt.value}" ${answers[k]===opt.value?'checked':''}><span class="likert-dot" aria-hidden="true"></span><span class="sr-only">${esc(opt.label)}</span>${opt.caption?`<span class="likert-caption">${esc(opt.caption)}</span>`:''}</label>`).join('');
  return `<div class="likert" role="radiogroup" aria-label="${esc(aria)}"><div class="likert-scale">${row}</div></div>`;
}

function sectionComplete(s){
  if(s.type==='scale') return s.numbers.every(n=>{const a=answers['q'+n];return Number.isInteger(a)&&a>=0&&a<=4});
  if(s.type==='impact'||s.type==='single'){const a=answers['s'+quizStep];return Number.isInteger(a)&&a>=0}
  if(s.type==='multi') return (answers['s'+quizStep]||[]).length>0;
  return true;
}

function renderQuiz(){
  const QDATA=qdata();
  const total=QDATA.sections.length;
  if(quizStep>=total){ showingResults=true; return showResults(); }
  showingResults=false;
  let s=QDATA.sections[quizStep];
  const nLabel=String(quizStep+1).padStart(2,'0');
  const totalLabel=String(total).padStart(2,'0');
  let html=`<div class="quiz"><div class="quiz-progress"><span>${esc(t('quiz_progress',{n:nLabel,total:totalLabel}))}</span><span>${esc(t('quiz_complete',{p:Math.round(quizStep/total*100)}))}</span></div><div class="progress-track"><span style="width:${quizStep/total*100}%"></span></div><div class="quiz-section"><p class="quiz-heading">${esc(s.title)}</p><p class="quiz-note">${esc(s.prompt)}</p>`;

  if(s.type==='scale'){
    for(let n of s.numbers){
      let k='q'+n;
      html+=`<div class="question"><div class="question-title"><span class="question-index">Q${String(n).padStart(2,'0')}</span><span>${esc(QDATA.questions[n-1])}</span></div>${scaleOptions(k)}</div>`;
    }
  } else if(s.type==='impact'){
    let k='s'+quizStep;
    html+=scaleOptions(k,{icons:impactIcons(),aria:t('impact_aria')});
  } else if(s.type==='multi'){
    let a=answers['s'+quizStep]||[];
    s.options.forEach((option,i)=>html+=`<label class="multi-option"><input type="checkbox" data-opt="${i}" ${a.includes(i)?'checked':''}><span>${esc(option)}</span></label>`);
    if(s.other) html+=`<label class="field-label">${esc(t('other_label'))}<textarea id="freeText" rows="2" placeholder="${esc(t('other_ph'))}">${esc(extras[quizStep]||'')}</textarea></label>`;
    if(s.max) html+=`<p class="question-caption">${t('max_caption',{max:s.max,n:a.length})}</p>`;
  } else {
    let k='s'+quizStep;
    html+=s.options.map((option,i)=>`<label class="multi-option"><input type="radio" name="${k}" value="${i}" ${answers[k]===i?'checked':''}><span>${esc(option)}</span></label>`).join('');
  }

  html+=`</div><p class="validation" id="validation" role="status"></p><div class="button-row">${quizStep>0?`<button class="button button-outline" id="prev">${esc(t('prev'))}</button>`:''}<button class="button button-dark" id="next">${esc(quizStep===total-1?t('see_results'):t('next'))}</button></div><p class="privacy">${esc(t('privacy'))}</p></div>`;
  root.innerHTML=html;

  root.querySelectorAll('input[name^="q"]').forEach(el=>el.addEventListener('change',()=>{answers[el.name]=+el.value}));
  root.querySelectorAll('input[data-opt]').forEach(el=>el.addEventListener('change',()=>multiSelect(s,quizStep,+el.dataset.opt,el.checked)));
  if(s.type==='single'||s.type==='impact') root.querySelectorAll('input[type=radio]').forEach(el=>el.addEventListener('change',()=>answers[el.name]=+el.value));
  root.querySelector('#freeText')?.addEventListener('input',ev=>extras[quizStep]=ev.target.value);
  root.querySelector('#prev')?.addEventListener('click',()=>{quizStep--;renderQuiz();scrollQuizTop();});
  root.querySelector('#next').addEventListener('click',()=>{
    let a=answers['s'+quizStep]||[];
    if(s.max&&a.length>s.max){root.querySelector('#validation').textContent=t('val_max',{max:s.max,n:a.length-s.max});return}
    if(!sectionComplete(s)){
      root.querySelector('#validation').textContent=s.type==='scale'?t('val_scale'):s.type==='multi'?t('val_multi'):t('val_single');
      return;
    }
    quizStep++;
    renderQuiz();
    scrollQuizTop();
  });
}

function round1(n){return Math.round((n+Number.EPSILON)*10)/10}
function computeScore(nums){
  let values=nums.map(n=>{
    let a=answers['q'+n];
    if(!Number.isInteger(a)||a<0||a>4) return null;
    return DIRECTIONS[n-1]===1?a:4-a;
  }).filter(v=>v!==null);
  return {count:values.length,value:values.length===nums.length?round1(values.reduce((a,b)=>a+b,0)/values.length*25):null};
}

function renderResultBody(r,score){
  const paras=r.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('');
  const advice=r.advice.map(item=>`<li><strong>${esc(item.title)}</strong> ${esc(item.text)}</li>`).join('');
  const notes=(qdata().resultFootnotes||[]).map(n=>`<p class="result-footnote">${esc(n)}</p>`).join('');
  return `<p class="result-range">${esc(r.range)}｜${esc(r.label)}</p><div class="score">${score}<span> / 100</span></div><h3 class="result-headline">${esc(r.headline)}</h3>${paras}<h4>${esc(r.adviceTitle)}</h4><ul class="result-advice">${advice}</ul><p class="result-focus"><strong>${esc(t('focus_label'))}</strong>${esc(r.focus)}</p>${notes}`;
}

function showResults(){
  showingResults=true;
  const QDATA=qdata();
  let d=computeScore([1,2,3,4,5,6]), a=computeScore([7,8,9,10,11,12]);
  let score=d.value===null||a.value===null?null:round1((d.value+a.value)/2);
  let band=score===null?null:score<25?0:score<50?1:score<75?2:3;
  let r=band===null?null:QDATA.results[band];
  let identity=answers.s7;
  const labels=t('id_labels'), details=t('id_details');
  let label=Number.isInteger(identity)?labels[identity]:t('id_none');
  let detail=Number.isInteger(identity)?details[identity]:t('id_none_detail');
  let html=`<div class="quiz"><div class="result"><p class="result-eyebrow">${esc(t('result_eyebrow'))}</p>${r?renderResultBody(r,score):`<h3>${esc(t('insufficient_h3'))}</h3><p>${esc(t('insufficient_p'))}</p>`}<div class="metric"><span>${esc(t('metric_daily',{c:d.count}))}</span><strong>${d.value===null?esc(t('info_short')):d.value+'/100'}</strong></div><div class="metric"><span>${esc(t('metric_agent',{c:a.count}))}</span><strong>${a.value===null?esc(t('info_short')):a.value+'/100'}</strong></div><div class="metric"><span>${esc(t('metric_identity'))}</span><strong>${esc(label)}</strong></div><p class="muted">${esc(detail)}</p>${a.value===null&&d.value!==null?`<p class="placeholder-note">${esc(t('placeholder_note'))}</p>`:''}</div><div class="button-row"><button class="button button-outline" id="editQuiz">${esc(t('edit'))}</button><button class="button button-dark" id="restartQuiz">${esc(t('restart'))}</button><a href="#program" class="button button-outline">${esc(t('explore'))}</a></div></div>`;
  root.innerHTML=html;
  scrollQuizTop();
  root.querySelector('#editQuiz').addEventListener('click',()=>{showingResults=false;quizStep=7;renderQuiz();scrollQuizTop()});
  root.querySelector('#restartQuiz').addEventListener('click',()=>{answers={};extras={};quizStep=0;showingResults=false;renderQuiz();scrollQuizTop()});
}

function onLangChange(){
  if(showingResults || quizStep>=qdata().sections.length) showResults();
  else renderQuiz();
}

document.querySelectorAll('.lang-switch button').forEach(btn=>{
  btn.addEventListener('click',()=>setLang(btn.dataset.lang));
});

applyStaticI18n();
navigate();
renderQuiz();
