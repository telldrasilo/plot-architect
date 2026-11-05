/**
 * Graphite edge direction V2: place a visual arrow on the *complete* SVG path.
 *
 * getTotalLength/getPointAtLength measure the rendered route, including bends
 * and curves. No endpoint is shortened and no graph data is changed.
 * This is deliberately independent from DOM mutation and persistence.
 */
const finiteDirectionNumber=value=>typeof value==='number'&&Number.isFinite(value);

export function directionAtPathFraction(path,{fraction=.5,tangentWindow=2}={}){
 if(!path||typeof path.getTotalLength!=='function'
   ||typeof path.getPointAtLength!=='function'
   ||!finiteDirectionNumber(fraction)||fraction<=0||fraction>=1
   ||!finiteDirectionNumber(tangentWindow)||tangentWindow<=0)return null;
 let length,center,before,after;
 try{
  length=path.getTotalLength();
  if(!finiteDirectionNumber(length)||length<=0)return null;
  const distance=length*fraction;
  center=path.getPointAtLength(distance);
  const sample=Math.min(tangentWindow,distance,length-distance);
  before=path.getPointAtLength(distance-sample);
  after=path.getPointAtLength(distance+sample);
  if(![center?.x,center?.y,before?.x,before?.y,after?.x,after?.y]
   .every(finiteDirectionNumber))return null;
  let dx=after.x-before.x,dy=after.y-before.y;
  if(Math.hypot(dx,dy)<1e-7){
   before=path.getPointAtLength(0);
   after=path.getPointAtLength(length);
   dx=after.x-before.x;dy=after.y-before.y;
   if(!finiteDirectionNumber(dx)||!finiteDirectionNumber(dy)
     ||Math.hypot(dx,dy)<1e-7)return null;
  }
  return {x:center.x,y:center.y,angle:Math.atan2(dy,dx)*180/Math.PI,
   distance,length};
 }catch{return null;}
}
