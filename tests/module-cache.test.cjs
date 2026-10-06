const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

function graph() {
  const files=new Set(), visiting=new Set();
  function visit(file) {
    assert.ok(!visiting.has(file),`circular import: ${file}`);
    if(files.has(file)) return;
    visiting.add(file);
    const code=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of code.matchAll(/\b(?:import|export)\s+[^;]*?\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      match[1]??=match[2];
      assert.ok(match[1].startsWith('.'),`production import must be local: ${match[1]}`);
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));
    }
    visiting.delete(file); files.add(file);
  }
  visit('app.js'); visit('src/camera/worker.js'); return files;
}

function worker(base='https://example.test/dew/', workerSource=source) {
  const stores=new Map(), handlers={}, requests=[];
  let offline=false, activated=false, skipped=false;
  const absolute = request => new URL(typeof request==='string'?request:request.url,base).href;
  const fetch=async request=>{
    if(offline) throw Error('offline');
    const url=absolute(request);requests.push(url);
    const file=new URL(url).pathname.slice(new URL(base).pathname.length)||'index.html';
    return new Response(fs.readFileSync(path.join(root,file)),{headers:{'content-type':file.endsWith('.js')?'text/javascript':'text/html'}});
  };
  const caches={
    async open(name){
      if(!stores.has(name)) stores.set(name,new Map());
      const store=stores.get(name);
      return {
        async addAll(files){assert.ok(files.every(file=>file.cache==='reload'),'installation must bypass stale HTTP-cached modules');const responses=await Promise.all(files.map(fetch));files.forEach((f,i)=>store.set(absolute(f),responses[i]));},
        async match(request){return store.get(absolute(request))?.clone();},
        async put(request,response){store.set(absolute(request),response.clone());},
      };
    },
    async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);},
  };
  vm.runInNewContext(workerSource,{caches,fetch,Response,Request,URL,self:{location:base+'service-worker.js',addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{activated=true;}}}});
  return {
    stores,requests,caches,base,get activated(){return activated;},get skipped(){return skipped;},set offline(value){offline=value;},
    async lifecycle(name){let pending;handlers[name]({waitUntil:p=>pending=p});await pending;},
    async request(file,mode='cors',method='GET'){let pending;handlers.fetch({request:{url:absolute(file),mode,method},respondWith:p=>pending=p});return pending;},
  };
}

test('native import graph resolves without cycles and modules import without browser side effects',()=>{
  for(const file of graph()) if(file!=='app.js') assert.doesNotThrow(()=>require(path.join(root,file)),file);
});
test('HTML entry URLs and cache revision stay synchronised',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const revision=source.match(/is-it-dryer-out-v(\d+)/)[1];
  for(const asset of ['app.js','styles.css']) {
    assert.ok(html.includes(`${asset}?v=${revision}`));assert.ok(source.includes(`"${asset}?v=${revision}"`));
  }
});
for(const base of ['https://example.test/','https://example.test/dew/']) {
  test(`fresh install caches the complete import graph and reloads offline at ${base}`,async()=>{
    const w=worker(base);await w.lifecycle('install');assert.equal(w.skipped,true);
    for(const file of graph()) assert.ok(w.requests.some(url=>new URL(url).pathname===new URL(file,base).pathname),`missing cached module: ${file}`);
    assert.match(await (await w.request('./','navigate')).text(),/type="module"/);
    w.offline=true;
    for(const file of graph()) {
      const entry=file==='app.js'?`app.js?v=${source.match(/is-it-dryer-out-v(\d+)/)[1]}`:file;
      const response=await w.request(entry);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/javascript');
    }
    assert.match(await (await w.request('unknown-page','navigate')).text(),/type="module"/);
    assert.equal((await w.request('src/missing.js')).type,'error');
    assert.equal((await w.request('https://api.example.test/weather')).type,'error');
    assert.equal(await w.request('submit','cors','POST'),undefined);
  });
}
test('activation removes old shells and retired camera caches while preserving unrelated caches',async()=>{
  const w=worker();const revision=Number(source.match(/is-it-dryer-out-v(\d+)/)[1]);
  await w.caches.open(`is-it-dryer-out-v${revision-1}`);await w.caches.open('unrelated-app');
  for(const name of ['dew-camera-ocr-6.0.1-v1','dew-camera-preview-v1','dew-camera-preview-ocr-6.0.1-v1']) {
    await w.caches.open(name);
  }
  await w.lifecycle('install');await w.lifecycle('activate');
  assert.equal(w.activated,true);assert.deepEqual(await w.caches.keys(),['unrelated-app',`is-it-dryer-out-v${revision}`]);
  w.offline=true;assert.equal((await w.request('src/voice/controller.js')).status,200);
});
