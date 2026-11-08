'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const timer = require('../timer');

test('old tasks migrate without losing content', () => {
  const tasks = [{id:'a',title:'Essay',note:'Plan'}];
  timer.normalize(tasks,1000);
  assert.equal(tasks[0].elapsedMs,0);
  assert.equal(tasks[0].timerStartedAt,null);
  assert.equal(tasks[0].note,'Plan');
});
test('pause and resume accumulate time without counting pauses', () => {
  const tasks = [{id:'a'}];
  timer.toggle(tasks,'a',1000);
  timer.toggle(tasks,'a',61000);
  assert.equal(timer.elapsed(tasks[0],121000),60000);
  timer.toggle(tasks,'a',121000);
  timer.pause(tasks[0],151000);
  assert.equal(timer.elapsed(tasks[0]),90000);
});
test('background suspension and reload retain elapsed time', () => {
  const tasks=[{id:'a'}];
  timer.toggle(tasks,'a',1000);
  const restored=timer.normalize(JSON.parse(JSON.stringify(tasks)),7201000);
  assert.equal(timer.elapsed(restored[0],7201000),7200000);
  timer.pause(restored[0],7201000);
  timer.pause(restored[0],8001000);
  assert.equal(restored[0].elapsedMs,7200000);
});
test('starting another task pauses the previous task', () => {
  const tasks=[{id:'a'},{id:'b'}];
  timer.toggle(tasks,'a',1000);
  timer.toggle(tasks,'b',31000);
  assert.equal(tasks[0].timerStartedAt,null);
  assert.equal(tasks[0].elapsedMs,30000);
  assert.equal(timer.elapsed(tasks[1],61000),30000);
});
test('completed tasks cannot start and invalid data is normalized', () => {
  const tasks=[{id:'a',done:true,elapsedMs:-1},{id:'b',elapsedMs:Infinity,timerStartedAt:2000}];
  timer.normalize(tasks,1000);
  assert.equal(timer.toggle(tasks,'a',1000),false);
  assert.equal(timer.elapsed(tasks[0]),0);
  assert.equal(tasks[1].timerStartedAt,null);
  assert.equal(timer.elapsed(tasks[1]),0);
});
test('clock and readable duration handle hour boundaries', () => {
  assert.equal(timer.clock(3661000),'01:01:01');
  assert.equal(timer.duration(3661000),'1 ч 1 мин');
  assert.equal(timer.duration(59000),'59 сек');
  assert.equal(timer.duration(60000),'1 мин');
});

test('UI starts, persists, restores, completes and displays task timers', () => {
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  const nodes=new Map(),listeners={};
  function el(){return {style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},elements:{title:{value:'',setCustomValidity(){},reportValidity(){}},section:{value:'listening'},date:{value:''},note:{value:''}},addEventListener(){},setAttribute(){},removeAttribute(){},reset(){},showModal(){this.open=true},close(){this.open=false}};}
  const document={querySelector(s){assert(html.includes('id="'+s.slice(1)+'"'),'Missing '+s);if(!nodes.has(s))nodes.set(s,el());return nodes.get(s)},querySelectorAll(){return []},addEventListener(type,fn){listeners[type]=fn}};
  let storage=null;
  const context=vm.createContext({StudyTimer:timer,document,window:{addEventListener(){},scrollTo(){}},localStorage:{getItem(){return storage},setItem(k,v){storage=v}},setTimeout(){},setInterval(){},clearTimeout(){},console,confirm(){return true}});
  vm.runInContext(source,context);
  const form=nodes.get('#task-form');form.elements.title.value='IELTS';form.elements.date.value=vm.runInContext('dateKey()',context);form.onsubmit({preventDefault(){},target:form});
  const id=JSON.parse(storage).tasks[0].id;
  function click(dataset){listeners.click({target:{closest(){return {dataset}}}});}
  click({timer:id});
  assert(JSON.parse(storage).tasks[0].timerStartedAt);
  assert.equal(nodes.get('#running-timer').hidden,false);
  assert(nodes.get('#task-list').innerHTML.includes('Пауза'));
  // Simulate the browser being suspended for one hour, then returning.
  vm.runInContext('state.tasks[0].timerStartedAt=Date.now()-3600000;render()',context);
  assert.equal(nodes.get('#total-study-time').textContent,'1 ч 0 мин');
  click({page:'progress'});
  assert.equal(nodes.get('#running-timer').hidden,false);
  click({toggle:id});
  const saved=JSON.parse(storage).tasks[0];
  assert.equal(saved.timerStartedAt,null);
  assert(saved.elapsedMs>=3600000);
  assert.equal(nodes.get('#running-timer').hidden,true);
  assert(!nodes.get('#task-list').innerHTML.includes('data-timer='));
  click({toggle:id});
  assert(nodes.get('#task-list').innerHTML.includes('Продолжить'));
});
