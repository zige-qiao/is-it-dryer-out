const patterns=['1111110','0110000','1101101','1111001','0110011','1011011','1011111','1110000','1111111','1111011'];
function image(){const width=600,height=420,data=new Uint8ClampedArray(width*height*4).fill(255);for(let p=0;p<data.length;p+=4)data[p]=data[p+1]=data[p+2]=205;return {width,height,data};}
function digit(pixels,value,x,y,h){
  const scale=h/100, rects=[[6,0,51,10],[52,8,11,43],[52,49,11,43],[6,90,51,10],[0,49,11,43],[0,8,11,43],[6,45,51,10]];
  patterns[Number(value)].split('').forEach((on,i)=>{if(on==='0')return;const [rx,ry,w,height]=rects[i];for(let yy=Math.round(y+ry*scale);yy<Math.round(y+(ry+height)*scale);yy++)for(let xx=Math.round(x+rx*scale);xx<Math.round(x+(rx+w)*scale);xx++){const p=(yy*pixels.width+xx)*4;pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=30;}});
}
function rect(p,x,y,w,h) { for(let yy=Math.round(y);yy<Math.round(y+h);yy++)for(let xx=Math.round(x);xx<Math.round(x+w);xx++){if(xx<0||yy<0||xx>=p.width||yy>=p.height)continue;const i=(yy*p.width+xx)*4;p.data[i]=p.data[i+1]=p.data[i+2]=30;} }
function ring(p,x,y,r,t) { for(let yy=Math.floor(y-r);yy<=y+r;yy++)for(let xx=Math.floor(x-r);xx<=x+r;xx++){const d=Math.hypot(xx-x,yy-y);if(d<=r&&d>=r-t)rect(p,xx,yy,1,1);} }
function unit(p,field,x,y,h) {
  if(field==='temperature'){ring(p,x+h*.03,y+h*.06,h*.045,h*.017);const xx=x+h*.16,hh=h*.31,t=h*.033;rect(p,xx,y,hh*.5,t);rect(p,xx,y,t,hh);rect(p,xx,y+hh-t,hh*.5,t);}
  else {const hh=h*.4,w=h*.22;ring(p,x+hh*.13,y+hh*.12,hh*.12,hh*.045);ring(p,x+w-hh*.13,y+hh-hh*.12,hh*.12,hh*.045);for(let row=0;row<hh;row++)rect(p,x+w-w*row/hh,y+row,h*.03,1);}
}
function monitor(x,y,h,temp='22.3',rh='59'){
  const p=image(),step=h*.75;
  digit(p,temp[0],x,y,h);digit(p,temp[1],x+step,y,h);digit(p,temp[3],x+step*2,y+h*.5,h*.5);
  // Pixel-drawn units are part of the evidence, not inferred from layout.
  unit(p,'temperature',x+step*2,y,h);
  rect(p,x+step*2-h*.08,y+h*.92,h*.04,h*.07);
  const humidityX=x+step*2+h*1.2;
  digit(p,rh[0],humidityX,y,h);digit(p,rh[1],humidityX+step,y,h);unit(p,'humidity',humidityX+step+h*.7,y+h*.55,h);
  // Smaller historical values are visible and must not become current readings.
  digit(p,'2',x,y+h*1.45,h*.35);digit(p,'0',x+h*.3,y+h*1.45,h*.35);
  digit(p,'4',humidityX,y+h*1.45,h*.35);digit(p,'9',humidityX+h*.3,y+h*1.45,h*.35);
  return p;
}

module.exports={monitor,image,digit,unit,rect};
