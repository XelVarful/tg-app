'use strict';
const $ = selector => document.querySelector(selector);
const sections = {listening:{name:'Listening',color:'#b1a0d4'},reading:{name:'Reading',color:'#8fadc5'},writing:{name:'Writing',color:'#ccad82'},speaking:{name:'Speaking',color:'#b5d39a'}};
const icons = {left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m10 6 6 6-6 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',tasks:'<rect x="4" y="3" width="16" height="18" rx="4"/><path d="m8 11 3 3 5-5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4M17 3v4M3 10h18M8 14h1M15 14h1M8 17h1"/>',progress:'<path d="M5 19v-5M12 19V9M19 19V4"/>'};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const dateKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromKey = key => new Date(`${key}T12:00:00`);
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(fromKey(value))===value;
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='band-ielts-v1';
function normalize(data){return {...data,tasks:data.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&Object.hasOwn(sections,t.section)&&validDate(t.date)).map(t=>({...t,done:!!t.done,note:typeof t.note==='string'?t.note:'',completedAt:validDate(t.completedAt)?t.completedAt:null}))};}
let state={tasks:[]};
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&Array.isArray(saved.tasks))state=normalize(saved);}catch{}
let selectedDate=dateKey(),month=new Date().getMonth(),year=new Date().getFullYear(),page='tasks',sectionFilter='all',editingId=null,toastTimer;
const tg=window.Telegram?.WebApp;
function telegramCall(fn){try{fn();}catch{}}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));return true;}catch{toast('Не удалось сохранить данные на устройстве');return false;}}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function completedOn(key){return state.tasks.filter(t=>t.done&&t.completedAt===key).length;}
function getStreak(){const days=new Set(state.tasks.filter(t=>t.done).map(t=>t.completedAt));const d=new Date();if(!days.has(dateKey(d)))d.setDate(d.getDate()-1);let count=0;while(days.has(dateKey(d))){count++;d.setDate(d.getDate()-1);}return count;}
function selectDate(key){selectedDate=key;const d=fromKey(key);month=d.getMonth();year=d.getFullYear();render();}
function render(){
$('#open-calendar').textContent=fromKey(selectedDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
const start=fromKey(selectedDate);start.setDate(start.getDate()-(start.getDay()+6)%7);
$('#week').innerHTML=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const key=dateKey(d);return `<button class="week-day ${key===selectedDate?'selected':''} ${key===dateKey()?'today':''} ${state.tasks.some(t=>t.date===key)?'has-tasks':''}" data-date="${key}" aria-pressed="${key===selectedDate}" aria-label="${d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}"><small>${d.toLocaleDateString('ru-RU',{weekday:'short'})}</small><strong>${d.getDate()}</strong></button>`;}).join('');
$('#section-filters').innerHTML=[['all',{name:'Все'}],...Object.entries(sections)].map(([key,s])=>`<button data-section="${key}" class="${sectionFilter===key?'active':''}" aria-pressed="${sectionFilter===key}">${s.name}</button>`).join('');
const tasks=state.tasks.filter(t=>t.date===selectedDate&&(sectionFilter==='all'||t.section===sectionFilter));const done=tasks.filter(t=>t.done).length;
$('#day-count').textContent=`${done} из ${tasks.length}`;$('#day-progress').style.width=`${tasks.length?done/tasks.length*100:0}%`;
$('#task-list').innerHTML=tasks.length?[...tasks].sort((a,b)=>Number(a.done)-Number(b.done)).map(t=>`<div class="task ${t.done?'done':''}"><button class="check" data-toggle="${escapeHTML(t.id)}" aria-label="${t.done?'Вернуть в план':'Выполнить'}: ${escapeHTML(t.title)}" aria-pressed="${t.done}"><span>${t.done?'✓':''}</span></button><button class="task-content" data-edit="${escapeHTML(t.id)}" aria-label="Редактировать: ${escapeHTML(t.title)}"><span class="task-title">${escapeHTML(t.title)}</span><span class="task-meta"><i class="section-dot" style="--section-color:${sections[t.section].color}"></i>${sections[t.section].name}</span>${t.note?`<span class="task-note">${escapeHTML(t.note)}</span>`:''}</button></div>`).join(''):`<div class="empty"><div class="empty-symbol">${icon('tasks')}</div><h3>Пока нет задач</h3><p>${sectionFilter==='all'?'Добавь первую задачу на этот день.':`Добавь задачу по ${sections[sectionFilter].name}.`}</p></div>`;
renderCalendar();renderProgress();
}
function renderCalendar(){
const first=new Date(year,month,1),days=new Date(year,month+1,0).getDate(),offset=(first.getDay()+6)%7;
$('#month-label').textContent=first.toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
let html=['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(d=>`<span class="weekday">${d}</span>`).join('')+'<span></span>'.repeat(offset);
for(let day=1;day<=days;day++){const key=dateKey(new Date(year,month,day)),n=completedOn(key),planned=state.tasks.some(t=>t.date===key);html+=`<button class="day ${key===selectedDate?'selected':''} ${key===dateKey()?'today':''} ${planned?'has-plan':''}" data-date="${key}" aria-pressed="${key===selectedDate}" aria-label="${day}, выполнено ${n} задач">${day}<small>${n?'✓ '+n:''}</small></button>`;}
$('#calendar').innerHTML=html;
$('#activity-date').textContent=fromKey(selectedDate).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
$('#activity-count').textContent=`Выполнено: ${completedOn(selectedDate)}`;
}
function renderProgress(){const completed=state.tasks.filter(t=>t.done);$('#total-done').textContent=completed.length;$('#active-days').textContent=new Set(completed.map(t=>t.completedAt).filter(Boolean)).size;$('#streak').textContent=getStreak();
$('#section-progress').innerHTML=Object.entries(sections).map(([key,s])=>{const all=state.tasks.filter(t=>t.section===key),done=all.filter(t=>t.done).length;return `<div class="section-progress-row" style="--section-color:${s.color}"><div class="section-progress-top"><strong><i class="section-dot"></i>${s.name}</strong><span>${done} / ${all.length}</span></div><div class="progress-track"><div style="width:${all.length?done/all.length*100:0}%"></div></div></div>`;}).join('');
const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {d,n:completedOn(dateKey(d))};}),max=Math.max(1,...days.map(d=>d.n));
$('#weekly-total').textContent=`Выполнено: ${days.reduce((sum,d)=>sum+d.n,0)}`;
$('#activity-chart').innerHTML=days.map(({d,n},i)=>`<div class="chart-day ${i===6?'today':''}" aria-label="${d.toLocaleDateString('ru-RU')}: ${n} выполнено"><strong>${n}</strong><div class="chart-bar" style="height:${Math.max(3,n/max*100)}px"></div><small>${d.toLocaleDateString('ru-RU',{weekday:'short'})}</small></div>`).join('');
}
function showPage(next){page=next;$('#page-title').textContent={tasks:'Задачи',calendar:'Календарь',progress:'Прогресс'}[page];$('#tasks-view').hidden=page!=='tasks';$('#calendar-view').hidden=page!=='calendar';$('#progress-view').hidden=page!=='progress';$('#task-area').hidden=page==='progress';$('#add-task').hidden=page==='progress';$('#today-button').hidden=page==='progress';document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);if(b.dataset.page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});render();updateBackButton();window.scrollTo({top:0,behavior:'instant'});}
function updateBackButton(){telegramCall(()=>{if(page!=='tasks'||$('#task-dialog').open)tg?.BackButton?.show();else tg?.BackButton?.hide();});}
function openTask(id=null){editingId=id;const task=state.tasks.find(t=>t.id===id),f=$('#task-form');f.reset();f.elements.title.setCustomValidity('');f.elements.title.value=task?.title||'';f.elements.section.value=task?.section||(sectionFilter==='all'?'listening':sectionFilter);f.elements.date.value=task?.date||selectedDate;f.elements.note.value=task?.note||'';$('#dialog-title').textContent=task?'Изменить задачу':'Новая задача';$('#save-task').textContent=task?'Сохранить':'Добавить';$('#delete-task').hidden=!task;$('#task-dialog').showModal();updateBackButton();}
function closeTask(){$('#task-dialog').close();}
$('#add-task').onclick=()=>openTask();$('#close-dialog').onclick=closeTask;$('#task-dialog').addEventListener('close',updateBackButton);
$('#today-button').onclick=()=>selectDate(dateKey());$('#open-calendar').onclick=()=>showPage('calendar');
$('#task-form').elements.title.oninput=e=>e.target.setCustomValidity('');
$('#task-form').onsubmit=e=>{e.preventDefault();const f=e.target,title=f.elements.title.value.trim();if(!title){f.elements.title.setCustomValidity('Напиши название задачи');f.elements.title.reportValidity();return;}const data={title,section:f.elements.section.value,date:f.elements.date.value,note:f.elements.note.value.trim()};if(!validDate(data.date)||!Object.hasOwn(sections,data.section))return;const old=state.tasks.find(t=>t.id===editingId);if(editingId&&!old){closeTask();toast('Эта задача уже удалена');return;}if(old)Object.assign(old,data);else state.tasks.push({id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,...data,done:false,completedAt:null});const saved=save();sectionFilter='all';selectDate(data.date);closeTask();if(saved)toast(old?'Сохранено':'Задача добавлена');};
$('#delete-task').onclick=()=>{const task=state.tasks.find(t=>t.id===editingId);if(!task)return;const remove=()=>{state.tasks=state.tasks.filter(t=>t.id!==task.id);const saved=save();closeTask();render();if(saved)toast('Задача удалена');};if(tg?.isVersionAtLeast?.('6.2')&&tg.initData){tg.showConfirm('Удалить задачу?',ok=>{if(ok)remove();});}else if(confirm('Удалить задачу?'))remove();};
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
if(d.toggle){const t=state.tasks.find(t=>t.id===d.toggle);if(t){t.done=!t.done;t.completedAt=t.done?dateKey():null;save();render();telegramCall(()=>tg?.HapticFeedback?.impactOccurred('light'));}}
if(d.edit)openTask(d.edit);
if(d.section){sectionFilter=d.section;render();}
if(d.date)selectDate(d.date);
if(d.day){const date=fromKey(selectedDate);date.setDate(date.getDate()+Number(d.day));selectDate(dateKey(date));}
if(d.month){const date=new Date(year,month+Number(d.month),1);year=date.getFullYear();month=date.getMonth();renderCalendar();}
if(d.page)showPage(d.page);
});
$('#task-dialog').addEventListener('click',e=>{if(e.target!==$('#task-dialog'))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeTask();});
telegramCall(()=>{tg?.ready();tg?.expand();});
telegramCall(()=>{if(tg?.isVersionAtLeast('6.1')){tg.setHeaderColor('#0c0c0e');tg.setBackgroundColor('#0c0c0e');tg.BackButton.onClick(()=>{if($('#task-dialog').open)closeTask();else showPage('tasks');});}});
telegramCall(()=>{if(tg?.isVersionAtLeast('7.10'))tg.setBottomBarColor('#0c0c0e');});
window.addEventListener('storage',e=>{if(e.key===storageKey){try{const next=JSON.parse(e.newValue);if(next&&Array.isArray(next.tasks)){state=normalize(next);render();}else if(e.newValue===null){state={tasks:[]};render();}}catch{}}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
render();
