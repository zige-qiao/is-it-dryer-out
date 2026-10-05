import { components, normalise } from './image.js';
import { boundedRegion } from './regions.js';
import { expandedRotation, compose, homography } from './geometry.js';
import { checkRecognitionBudget } from './budget.js';

const canonical = angle => ((angle + 180) % 360 + 360) % 360 - 180;
function orientedComponent(item, width) {
  const points = item.points;
  let sx=0,sy=0,sxx=0,syy=0,sxy=0;
  for (const p of points) { if((p&1023)===0)checkRecognitionBudget(); const x=p%width,y=Math.floor(p/width); sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y; }
  const n=points.length, theta=.5*Math.atan2(2*(sxy-sx*sy/n),sxx-sx*sx/n-syy+sy*sy/n),c=Math.cos(theta),s=Math.sin(theta);
  let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
  for (const p of points) {const x=p%width,y=Math.floor(p/width),u=x*c+y*s,v=-x*s+y*c;l=Math.min(l,u);r=Math.max(r,u);t=Math.min(t,v);b=Math.max(b,v);}
  const w=r-l+1,h=b-t+1;
  return { angle:theta*180/Math.PI, long:Math.max(w,h),short:Math.min(w,h),fill:n/(w*h), aspect:Math.max(w,h)/Math.min(w,h) };
}

// Raw image evidence only: no units, glyph labels or plausible values rank axes.
export function rawDisplayRegions(pixels) {
  const {width,height,data}=pixels,n=width*height,gray=new Uint8Array(n),histogram=new Uint32Array(256),masks=[];
  for(let i=0;i<n;i++){if((i&1023)===0)checkRecognitionBudget();const v=Math.round(.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2]);gray[i]=v;histogram[v]++;}
  for(const fraction of [.1,.2,.3,.4,.6,.8]){let count=0,level=0;while(level<255&&count<n*fraction)count+=histogram[level++];for(const bright of [false,true]) masks.push({mask:Uint8Array.from(gray,v=>Number(bright?v>level:v<level)),score:1});}
  for(const delta of [4,16])masks.push({mask:Uint8Array.from(gray,(_,i)=>Number(data[i*4+1]-data[i*4]>delta&&data[i*4+1]>=data[i*4+2]-12)),score:5});
  const colours=new Map();for(let i=0;i<n;i++){if((i&1023)===0)checkRecognitionBudget();const key=`${Math.floor((data[i*4+1]-data[i*4]+144)/32)},${Math.floor((data[i*4+2]-data[i*4]+144)/32)}`;if(!colours.has(key))colours.set(key,[]);colours.get(key).push(i);}
  for(const indices of [...colours.values()].sort((a,b)=>b.length-a.length).slice(0,8)){const mask=new Uint8Array(n);for(const i of indices)mask[i]=1;masks.push({mask,score:3});}
  const raw=[];
  for(const {mask,score} of masks)for(const item of components(mask,width,height,0,true)){
    const area=item.width*item.height;if(item.count<n*.0015||area>n*.85||item.count<80)continue;
    const axes=orientedComponent(item,width);
    if(axes.short<14||axes.aspect<1.35||axes.aspect>5||axes.fill<.5)continue;
    const region=boundedRegion(item,width,height,axes.short*.025);
    if(raw.some(p=>Math.abs(p.region.x-region.x)<.025&&Math.abs(p.region.y-region.y)<.025&&Math.abs(p.region.width-region.width)<.05&&Math.abs(p.region.height-region.height)<.05))continue;
    raw.push({region,kind:'display',angle:axes.angle,score:score+axes.fill+Math.min(3,axes.long*axes.short/n*16),axes,item});
  }
  const strokeGroups=components(normalise(pixels,.55,'adaptive').mask,width,height,0,true).filter(item=>item.count>80&&item.width*item.height<n*.04&&Math.max(item.width,item.height)>height*.045&&Math.max(item.width,item.height)<height*.25&&Math.max(item.width,item.height)/Math.min(item.width,item.height)<10&&item.x>1&&item.y>1&&item.x+item.width<width-1&&item.y+item.height<height-1);
  for(const proposal of raw){const box=proposal.item,inside=strokeGroups.filter(item=>{
    if(item.x<box.x-2||item.y<box.y-2||item.x+item.width>box.x+box.width+2||item.y+item.height>box.y+box.height+2)return false;
    if(Math.max(item.width,item.height)/Math.min(item.width,item.height)<5)return true;
    if(Math.min(item.width,item.height)<3||item.count/(item.width*item.height)<=.5)return false;
    const direction=orientedComponent(item,width).angle,difference=Math.abs(((direction-proposal.angle+135)%90+90)%90-45);
    return difference<=10;
  }).sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height));
    if(inside.length>=2){const size=Math.max(inside[1].width,inside[1].height);if(size>=Math.max(inside[0].width,inside[0].height)*.6){proposal.strokeScore=size/height*60;proposal.score+=proposal.strokeScore;}}
  }
  const interiors=raw.filter(p=>p.region.x>0&&p.region.y>0&&p.region.x+p.region.width<.999&&p.region.y+p.region.height<.999);
  return (interiors.length?interiors:raw).sort((a,b)=>b.score-a.score||b.axes.long*b.axes.short-a.axes.long*a.axes.short).slice(0,4).map((p,i)=>{
    let best=Infinity,angle=p.angle;for(let a=Math.round(p.angle)-10;a<=Math.round(p.angle)+10;a++){checkRecognitionBudget();const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;for(let j=0;j<p.item.points.length;j+=4){const point=p.item.points[j],x=point%width,y=Math.floor(point/width),u=x*c+y*s,v=-x*s+y*c;l=Math.min(l,u);r=Math.max(r,u);t=Math.min(t,v);b=Math.max(b,v);}const area=(r-l)*(b-t);if(area<best){best=area;angle=a;}}
    const {item,...proposal}=p;return {...proposal,angle,quad:item.corners,displayId:`display-${i}`};});
}

function rawStrokeAxis(pixels,region){
  const {width,height,data}=pixels,votes=new Float64Array(90),b=region||{x:0,y:0,width:1,height:1};
  const gray=(x,y)=>{const p=(y*width+x)*4;return .299*data[p]+.587*data[p+1]+.114*data[p+2];};
  for(let y=Math.max(1,Math.floor(b.y*height));y<Math.min(height-1,(b.y+b.height)*height);y+=2)for(let x=Math.max(1,Math.floor(b.x*width));x<Math.min(width-1,(b.x+b.width)*width);x+=2){
    if ((x & 127) === 0) checkRecognitionBudget();
    const dx=gray(x+1,y)-gray(x-1,y),dy=gray(x,y+1)-gray(x,y-1),strength=Math.hypot(dx,dy);if(strength<6)continue;
    const angle=((Math.atan2(dy,dx)*180/Math.PI%90)+90)%90;votes[Math.round(angle)%90]+=strength;
  }
  // Long connected stroke groups provide an axis without the stair-step bias
  // of individual gradients in resampled or diagonal edges.
  const grayValues=Uint8Array.from({length:width*height},(_,i)=>Math.round(.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2]));
  const hist=new Uint32Array(256);for(const v of grayValues)hist[v]++;let minimum=0,mode=0;while(minimum<255&&!hist[minimum])minimum++;for(let i=1;i<256;i++)if(hist[i]>hist[mode])mode=i;const level=(minimum+mode)/2;
  const axisVotes=new Float64Array(90);
  for(const item of components(normalise(pixels,.55,'gentle').mask,width,height,0,true)){
    if(item.count<40||item.width*item.height>width*height*.1)continue;
    if(region&&(item.x+item.width<region.x*width||item.x>(region.x+region.width)*width||item.y+item.height<region.y*height||item.y>(region.y+region.height)*height))continue;
    const axes=orientedComponent(item,width);if(axes.aspect<1.25||axes.aspect>8||axes.short<4)continue;
    let bestArea=Infinity,angle=0;
    for(let a=0;a<90;a++){checkRecognitionBudget();const c=Math.cos(a*Math.PI/180),s=Math.sin(a*Math.PI/180);let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
      for(const p of item.points){const x=p%width,y=Math.floor(p/width),u=x*c+y*s,v=-x*s+y*c;l=Math.min(l,u);r=Math.max(r,u);t=Math.min(t,v);b=Math.max(b,v);}
      const area=(r-l+1)*(b-t+1);if(area<bestArea){bestArea=area;angle=a;}
    }
    axisVotes[angle]+=item.count;
  }
  const componentStrength=axisVotes.reduce((a,b)=>a+b,0);
  const useVotes=componentStrength>150?axisVotes:votes;
  let peak=0,best=0;for(let i=0;i<90;i++){const v=useVotes[(i+89)%90]+useVotes[i]+useVotes[(i+1)%90];if(v>best){best=v;peak=i;}}
  let gradientPeak=0,gradientBest=0;for(let i=0;i<90;i++){const v=votes[(i+89)%90]+votes[i]+votes[(i+1)%90];if(v>gradientBest){gradientBest=v;gradientPeak=i;}}
  const axis=peak>45?peak-90:peak,gradient=gradientPeak>45?gradientPeak-90:gradientPeak;
  return {axis:Math.abs(axis-gradient)<=8?Math.round((axis+gradient)/2):axis,gradient};
}

export function remapHypotheses(hypotheses,pixels,context={}){return hypotheses.map(h=>{
  if(h.method!=='perspective'&&!h.preserveMatrix)return {...h,...expandedRotation(pixels.width,pixels.height,h.angle||0,h.shear||0),sourceWidth:pixels.width,sourceHeight:pixels.height};
  const crop=context.crop||{x:0,y:0,width:1,height:1};
  const inputMap=[pixels.width/(crop.width*h.sourceWidth),0,-crop.x*pixels.width/crop.width,0,pixels.height/(crop.height*h.sourceHeight),-crop.y*pixels.height/crop.height,0,0,1];
  const scale=Math.min(1,800/Math.max(h.width,h.height));
  return {...h,matrix:compose(inputMap,compose(h.matrix,[1/scale,0,0,0,1/scale,0,0,0,1])),width:Math.max(1,Math.round(h.width*scale)),height:Math.max(1,Math.round(h.height*scale)),cardinal:false,sourceWidth:pixels.width,sourceHeight:pixels.height};
});}

export function prepareOrientation(pixels,options={}){
  const proposals=rawDisplayRegions(pixels),primary=proposals.find(p=>p.region.width*p.region.height>.08&&p.axes.aspect>1.8&&p.axes.fill>.65&&p.strokeScore&&p.region.x>0&&p.region.y>0&&p.region.x+p.region.width<.999&&p.region.y+p.region.height<.999),strokes=rawStrokeAxis(pixels,primary?.region),longAxis=primary?.angle;
  let axis=strokes.axis;
  if(longAxis!==undefined){const difference=a=>Math.abs(((a-longAxis+135)%90+90)%90-45);if(difference(axis)>15&&difference(strokes.gradient)<difference(axis))axis=strokes.gradient;}
  // A long LCD axis chooses which of the two perpendicular stroke axes to retain.
  let base=axis;
  if(longAxis!==undefined){const alternatives=[axis,axis+90,axis-90];base=alternatives.sort((a,b)=>Math.abs(canonical(a-longAxis))-Math.abs(canonical(b-longAxis)))[0];}
  // Stroke edges and the LCD border share an axis; their small disagreement is
  // geometric uncertainty rather than a reason to prefer the bezel exclusively.
  if(Math.abs(base-Math.round(base/90)*90)<=2)base=Math.round(base/90)*90;
  if(Math.abs(base)<2)base=0;
  const prior=options.priorCorrection,angles=[0];
  if(prior?.orientationResolved&&Number.isFinite(prior.angle))angles.push(prior.angle);
  angles.push(base,canonical(base+180));
  if(base!==0&&!primary)angles.push(-180);
  if(!proposals.length)angles.push(canonical(base+90),canonical(base-90));
  const hypotheses=[];
  for(const angle of angles){const normalized=canonical(angle);if(hypotheses.some(h=>Math.abs(canonical(h.angle-normalized))<2))continue;
    const supported=prior?.orientationResolved&&Math.abs(canonical((prior.angle||0)-normalized))<2,shear=supported?(prior.shear||0):0;
    hypotheses.push({id:normalized===0?'identity':`orientation-${normalized}`,angle:normalized,shear,method:normalized||shear?'strokes':'none',evidence:{axis,longAxis,displayId:proposals[0]?.displayId||null,supportedPrior:supported},...expandedRotation(pixels.width,pixels.height,normalized,shear),sourceWidth:pixels.width,sourceHeight:pixels.height});if(hypotheses.length===4)break;
  }
  let supportedPriorId=null;
  if(prior?.orientationResolved&&prior.matrix){const descriptor={...prior,id:`supported-${prior.id||prior.method||'correction'}`,width:prior.width||prior.analysisWidth,height:prior.height||prior.analysisHeight,native:true,preserveMatrix:true,evidence:{...prior.evidence,supportedPrior:true}};supportedPriorId=descriptor.id;hypotheses.splice(1,0,remapHypotheses([descriptor],pixels,{sourceSize:options.sourceSize})[0]);hypotheses.length=Math.min(4,hypotheses.length);}
  if(primary&&Math.abs(primary.angle)>8&&Math.abs(primary.angle)<35&&!prior){
    // Prefer a nested LCD interior to the rounded case silhouette when both
    // preserve the same raw stroke group and screen axis.
    const interior=proposals.find(p=>p!==primary&&p.strokeScore>primary.strokeScore*.6&&Math.abs(p.angle-primary.angle)<5&&p.region.width*p.region.height<primary.region.width*primary.region.height*.85&&p.region.width*p.region.height>primary.region.width*primary.region.height*.5&&p.region.x>=primary.region.x&&p.region.y>=primary.region.y&&p.region.x+p.region.width<=primary.region.x+primary.region.width&&p.region.y+p.region.height<=primary.region.y+primary.region.height)||primary;
    const quad=interior.quad,lengths=quad.map((p,i)=>Math.hypot(p[0]-quad[(i+1)%4][0],p[1]-quad[(i+1)%4][1]));
    if(Math.min(...lengths)>12){const width=Math.round((lengths[0]+lengths[2])/2),height=Math.round((lengths[1]+lengths[3])/2),matrix=homography([[0,0],[width-1,0],[width-1,height-1],[0,height-1]],quad);
      if(matrix&&width/height>1.4&&width/height<5){const perspective={id:'display-perspective',matrix,width,height,sourceWidth:pixels.width,sourceHeight:pixels.height,method:'perspective',cardinal:false,evidence:{displayId:primary.displayId,rawQuad:true}};
        hypotheses.splice(1,0,perspective,{...perspective,id:'display-perspective-opposite',matrix:compose(matrix,expandedRotation(width,height,180).matrix)});hypotheses.length=Math.min(4,hypotheses.length);
      }
    }
  }
  return {proposals,hypotheses,orientation:{state:'pending',credibleIds:supportedPriorId?[supportedPriorId]:hypotheses.filter(h=>!primary||Math.abs(base)<8||h.angle!==0).map(h=>h.id)}};
}
