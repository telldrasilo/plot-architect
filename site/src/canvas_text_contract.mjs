/** UX-126: editor-only text annotations. No story node, edge, workspace, or MCP fact. */
export const CANVAS_TEXT_LIMIT=160;
const validNum=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1_000_000;
const validId=s=>typeof s==='string'&&s.length>0&&s.length<=80&&/^[A-Za-z0-9_-]+$/.test(s);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fields=(obj,keys)=>Object.keys(obj).every(key=>keys.includes(key));
export function validateCanvasTexts(graph){
  const items=graph.canvasTexts??[];
  if(!Array.isArray(items)||items.length>CANVAS_TEXT_LIMIT)throw Error('CANVAS_TEXT_INVALID: expected a bounded array');
  const ids=new Set(),nodeIds=new Set((graph.nodes??[]).map(n=>n.id));
  for(const item of items){
    if(!object(item)||!fields(item,['id','x','y','width','height','parent','blocks'])||
       !validId(item.id)||ids.has(item.id)||![item.x,item.y,item.width].every(validNum)||
       item.width<200||item.width>1200||
       (item.height!==undefined&&(!validNum(item.height)||item.height<76||item.height>100000))||item.parent!==null&&
       (typeof item.parent!=='string'||!nodeIds.has(item.parent))||
       !Array.isArray(item.blocks)||item.blocks.length<1||item.blocks.length>300)
      throw Error('CANVAS_TEXT_INVALID: item identity, geometry, scope or blocks');
    ids.add(item.id);
    let length=0;
    for(const block of item.blocks){
      if(!object(block)||!fields(block,['type','runs'])||
         !['paragraph','heading','quote'].includes(block.type)||
         !Array.isArray(block.runs)||block.runs.length<1||block.runs.length>200)
        throw Error('CANVAS_TEXT_INVALID: paragraph structure');
      for(const run of block.runs){
        if(!object(run)||!fields(run,['text','italic','underline'])||
           typeof run.text!=='string'||run.text.length>20_000||
           (run.italic!==undefined&&run.italic!==true)||
           (run.underline!==undefined&&run.underline!==true))
          throw Error('CANVAS_TEXT_INVALID: text run');
        length+=run.text.length;
        if(length>20_000)throw Error('CANVAS_TEXT_INVALID: text too long');
      }
    }
  }
  return items;
}
