/** UX-126: deterministic canvas-text geometry (all dimensions in world units).
 * The top edge moves the box; left/right/bottom edges and lower corners resize.
 * The minimum height is supplied by actual text layout so written content stays visible.
 */
export const CANVAS_TEXT_MIN_WIDTH=200;
export const CANVAS_TEXT_MAX_WIDTH=1200;
export const CANVAS_TEXT_MIN_HEIGHT=76;
export const CANVAS_TEXT_MAX_HEIGHT=100000;
export const CANVAS_TEXT_EDGE_MODES=Object.freeze([
  'move','left','right','bottom','bottom-left','bottom-right'
]);
const canvasTextClamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const canvasTextFinite=x=>typeof x==='number'&&Number.isFinite(x);
export function canvasTextEdgeGeometry(start,mode,deltaX,deltaY,contentMinHeight=76){
 if(!start||!CANVAS_TEXT_EDGE_MODES.includes(mode)||
    ![start.x,start.y,start.width,start.height,deltaX,deltaY,contentMinHeight].every(canvasTextFinite)||
    start.width<CANVAS_TEXT_MIN_WIDTH||start.width>CANVAS_TEXT_MAX_WIDTH||
    start.height<CANVAS_TEXT_MIN_HEIGHT||contentMinHeight<CANVAS_TEXT_MIN_HEIGHT)
  throw Error('CANVAS_TEXT_GEOMETRY_INVALID');
 if(mode==='move')return {
   x:Math.round(start.x+deltaX),y:Math.round(start.y+deltaY),
   width:start.width,height:start.height
 };
 const left=mode==='left'||mode==='bottom-left';
 const right=mode==='right'||mode==='bottom-right';
 const bottom=mode==='bottom'||mode==='bottom-left'||mode==='bottom-right';
 const width=canvasTextClamp(Math.round(start.width+(left?-deltaX:right?deltaX:0)),
   CANVAS_TEXT_MIN_WIDTH,CANVAS_TEXT_MAX_WIDTH);
 const x=left?start.x+start.width-width:start.x;
 const height=canvasTextClamp(Math.round(Math.max(start.height+(bottom?deltaY:0),contentMinHeight)),
   CANVAS_TEXT_MIN_HEIGHT,CANVAS_TEXT_MAX_HEIGHT);
 return {x:Math.round(x),y:start.y,width,height};
}
