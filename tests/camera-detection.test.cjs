const {test}=require('node:test');
const assert=require('node:assert/strict');
const {detectReadingRegions}=require('../src/camera/detection.js');
const patterns=['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
function image(){const width=600,height=420,data=new Uint8ClampedArray(width*height*4).fill(255);for(let p=0;p<data.length;p+=4)data[p]=data[p+1]=data[p+2]=205;return {width,height,data};}
function digit(pixels,value,x,y,h){
  const scale=h/100, rects=[[6,0,51,10],[52,8,11,43],[52,49,11,43],[6,90,51,10],[0,49,11,43],[0,8,11,43],[6,45,51,10]];
  patterns[Number(value)].split('').forEach((on,i)=>{if(on==='0')return;const [rx,ry,w,height]=rects[i];for(let yy=Math.round(y+ry*scale);yy<Math.round(y+(ry+height)*scale);yy++)for(let xx=Math.round(x+rx*scale);xx<Math.round(x+(rx+w)*scale);xx++){const p=(yy*pixels.width+xx)*4;pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=30;}});
}
function monitor(x,y,h,temp='22.3',rh='59'){
  const p=image(),step=h*.75;
  digit(p,temp[0],x,y,h);digit(p,temp[1],x+step,y,h);digit(p,temp[3],x+step*2,y+h*.5,h*.5);
  const humidityX=x+step*2+h*1.2;
  digit(p,rh[0],humidityX,y,h);digit(p,rh[1],humidityX+step,y,h);
  // Smaller historical values are visible and must not become current readings.
  digit(p,'2',x,y+h*1.45,h*.35);digit(p,'0',x+h*.3,y+h*1.45,h*.35);
  digit(p,'4',humidityX,y+h*1.45,h*.35);digit(p,'9',humidityX+h*.3,y+h*1.45,h*.35);
  return p;
}
test('boundaries follow current glyphs when the monitor moves or changes size',()=>{
  const a=detectReadingRegions(monitor(55,50,90)),b=detectReadingRegions(monitor(170,170,65));
  assert.deepEqual(a?.values,{temperature:'22.3',humidity:'59'});assert.deepEqual(b?.values,a.values);
  assert.ok(b.regions.temperature.x>a.regions.temperature.x);assert.ok(b.regions.temperature.y>a.regions.temperature.y);
  assert.ok(b.regions.temperature.width<a.regions.temperature.width);
  assert.ok(a.regions.temperature.y+a.regions.temperature.height<(50+90*1.4)/420);
});
test('different segment values are read from evidence rather than memorising the supplied photo',()=>{
  const result=detectReadingRegions(monitor(80,100,85,'28.4','61'));
  assert.deepEqual(result?.values,{temperature:'28.4',humidity:'61'});
});
test('a blank or textured photo has no fabricated reading boxes',()=>{
  const blank=image();assert.equal(detectReadingRegions(blank),null);
  for(let y=0;y<blank.height;y++)for(let x=0;x<blank.width;x++){const p=(y*blank.width+x)*4;const gray=75+((x*17+y*23)%15);blank.data[p]=blank.data[p+1]=blank.data[p+2]=gray;}
  assert.equal(detectReadingRegions(blank),null);
});
