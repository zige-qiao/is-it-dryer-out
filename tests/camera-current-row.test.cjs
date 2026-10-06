const {test}=require('node:test');
const assert=require('node:assert/strict');
const {findCurrentRows,passesCurrentRow}=require('../src/camera/current-row.js');
const {image,digit,rect,monitor}=require('./helpers/camera-pixels.cjs');
const {runWithRecognitionBudget,RecognitionCancelledError}=require('../src/camera/budget.js');

test('integer height and vertical overlap include their exact boundaries',()=>{
 const row={x:0,y:100,width:300,height:100};
 assert.equal(passesCurrentRow([{y:100,height:80}],row,100),true);
 assert.equal(passesCurrentRow([{y:100,height:79.99}],row,100),false);
 assert.equal(passesCurrentRow([{y:160,height:80}],row,100),true);
 assert.equal(passesCurrentRow([{y:160.01,height:80}],row,100),false);
 assert.equal(passesCurrentRow([{y:60,height:80}],row,100),true);
 assert.equal(passesCurrentRow([{y:59.99,height:80}],row,100),false);
 assert.equal(passesCurrentRow([],row,100),false);
 assert.equal(passesCurrentRow([{y:100,height:100}],null,100),false);
});

test('raw stroke evidence preserves an unreadable main row without units',()=>{
 const p=image(); digit(p,'2',70,60,100);digit(p,'8',150,60,100);
 rect(p,90,84,20,18); // Undecodable, but still a full main cell.
 digit(p,'4',70,230,40);digit(p,'9',105,230,40);
 const rows=findCurrentRows(p); assert.equal(rows.length,1);
 assert.ok(rows[0].integerHeight>=95);assert.equal(rows[0].evidence,'raw-strokes');
 assert.equal(passesCurrentRow([{x:70,y:230,width:25,height:40}],rows[0].row,rows[0].integerHeight),false);
});

test('smaller temperature fractions do not reduce the integer reference',()=>{
 const rows=findCurrentRows(monitor(55,50,80,'23.2','60'));
 assert.equal(rows.length,1);assert.ok(rows[0].integerHeight>=75);
});

test('a narrow one establishes a row when paired with a broad cell',()=>{
 const p=image();digit(p,'1',40,70,100);digit(p,'6',120,70,100);
 const rows=findCurrentRows(p);assert.equal(rows.length,1);assert.ok(rows[0].integerHeight>=95);
});

test('scales are independent for two supplied LCD bounds',()=>{
 const p=image();digit(p,'2',30,30,90);digit(p,'8',105,30,90);
 digit(p,'6',360,230,30);digit(p,'0',385,230,30);
 const rows=findCurrentRows(p,[{x:10,y:10,width:220,height:170},{x:340,y:200,width:130,height:100}]);
 assert.equal(rows.length,2);assert.ok(rows[0].integerHeight>rows[1].integerHeight*2);
 assert.equal(passesCurrentRow([{y:230,height:30}],rows[1].row,rows[1].integerHeight),true);
});

test('competing equal-sized rows in one LCD stay unresolved',()=>{
 const p=image();for(const y of [40,160]){digit(p,'2',40,y,60);digit(p,'8',90,y,60);}
 assert.deepEqual(findCurrentRows(p,[{x:10,y:10,width:220,height:230}]),[]);
});

test('relative scale detects distant cells without an absolute size floor',()=>{
 for(const h of [12,20,60]){const p=image();digit(p,'6',40,40,h);digit(p,'0',40+h*.8,40,h);
 const rows=findCurrentRows(p);assert.ok(rows.length);assert.ok(rows[0].integerHeight>=h*.8);}
});

test('raw analysis observes cancellation inside pixel preparation',()=>{
 let n=0;assert.throws(()=>runWithRecognitionBudget(()=>{if(++n>3)throw new RecognitionCancelledError();},()=>findCurrentRows(image())),RecognitionCancelledError);
});

test('unrelated displays at the same baseline keep independent references',()=>{
 const p=image();for(const x of [25,380]){digit(p,'6',x,70,40);digit(p,'0',x+32,70,40);}
 const rows=findCurrentRows(p);assert.equal(rows.length,2);assert.ok(rows[0].row.width<100);assert.ok(rows[1].row.width<100);
});

test('source-stroke gaps and unreadable bars still establish full cells',()=>{
 const p=image();digit(p,'8',50,40,100);digit(p,'6',130,40,100);
 for(const x of [50,130])for(const y of [48,88,132])for(let yy=y;yy<y+2;yy++)for(let xx=x;xx<x+64;xx++){
  const i=(yy*p.width+xx)*4;p.data[i]=p.data[i+1]=p.data[i+2]=205;
 }
 const rows=findCurrentRows(p);assert.ok(rows.length);assert.ok(rows[0].integerHeight>=95);
});

test('the gate excludes fractions only through the explicit integer-cell list',()=>{
 const row={x:0,y:0,width:200,height:100};const integers=[{y:0,height:100},{y:0,height:100}],fraction={y:50,height:50};
 assert.equal(passesCurrentRow(integers,row,100),true);
 assert.equal(passesCurrentRow([...integers,fraction],row,100),false);
});

test('a supported perspective correction measures height along the display axis',()=>{
 const {homography,warp,inverse}=require('../src/camera/geometry.js');
 const p=image();digit(p,'2',60,60,80);digit(p,'8',125,60,80);
 const matrix=homography([[0,0],[599,0],[599,419],[0,419]],[[10,18],[579,0],[595,405],[30,419]]);
 const photograph=warp(p,inverse(matrix)),corrected=warp(photograph,matrix);
 const rows=findCurrentRows(corrected,[{x:20,y:30,width:250,height:200}]);
 assert.equal(rows.length,1);assert.ok(rows[0].integerHeight>=76&&rows[0].integerHeight<=84);
 assert.equal(passesCurrentRow([{y:60,height:80},{y:60,height:80}],rows[0].row,rows[0].integerHeight),true);
});

test('uniform and fine texture do not establish a display row',()=>{
 const p=image();assert.deepEqual(findCurrentRows(p),[]);
 for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4;p.data[i]=p.data[i+1]=p.data[i+2]=75+((x*17+y*23)%15);}
 assert.deepEqual(findCurrentRows(p),[]);
});

test('an independent smaller LCD extends beyond background digits without needing units',()=>{
 const {expandedRotation,correctedPixels}=require('../src/camera/geometry.js');
 const p=image();digit(p,'9',20,20,140);digit(p,'9',135,20,140);
 for(const x of [55,97,203,245])digit(p,'6',x,190,55);
 for(const angle of [0,180]){
  const corrected=correctedPixels(p,expandedRotation(p.width,p.height,angle)),rows=findCurrentRows(corrected);
  const large=rows.find(row=>row.integerHeight>100),small=rows.find(row=>row.integerHeight<70);
  assert.ok(large);assert.ok(small);
  const centre=small.row.y+small.row.height/2;
  assert.ok(centre<large.displayBounds.y||centre>large.displayBounds.y+large.displayBounds.height);
  assert.equal(passesCurrentRow([{y:small.row.y,height:55}],small.row,small.integerHeight),true);
 }
});

test('sparse bezel chains cannot pair with joined divider strokes to double the digit reference',()=>{
 const p=image();digit(p,'2',70,70,60);digit(p,'8',120,70,60);
 rect(p,20,40,1,120);for(let y=40;y<160;y+=20)rect(p,20,y,13,1);
 rect(p,190,40,3,120);for(let y=40;y<160;y+=20)rect(p,190,y,42,2);
 const rows=findCurrentRows(p);
 assert.ok(rows.length);assert.ok(rows.every(row=>row.integerHeight<90));
 assert.ok(rows.some(row=>row.integerHeight>=55));
});
