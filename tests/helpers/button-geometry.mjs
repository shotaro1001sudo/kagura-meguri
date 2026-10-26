// Read-only DOM diagnostic. No text, inputs, cookies or URLs are collected.
export function buttonGeometry() {
 const b=document.getElementById('cookie-reject-optional');
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
 const describe=e=>{if(!e)return null;const s=getComputedStyle(e);return {tag:e.tagName,id:e.id,role:e.getAttribute('role'),rect:rect(e),display:s.display,visibility:s.visibility,position:s.position,zIndex:s.zIndex,pointerEvents:s.pointerEvents,opacity:s.opacity,inert:e.inert===true,ariaHidden:e.getAttribute('aria-hidden')};};
 const r=rect(b),x=r?r.x+r.width/2:null,y=r?r.y+r.height/2:null;
 const points=r?[[x,y],[r.left+4,r.top+4],[r.right-4,r.top+4],[r.left+4,r.bottom-4],[r.right-4,r.bottom-4]]:[];
 const hitSamples=points.map(([px,py])=>{const e=document.elementFromPoint(px,py);return {x:px,y:py,owns:!!b&&(e===b||b.contains(e)),target:describe(e)};});
 const hit=r?document.elementFromPoint(x,y):null,style=b?getComputedStyle(b):null;
 const ancestors=[];for(let e=b?.parentElement;e&&ancestors.length<10;e=e.parentElement)ancestors.push(describe(e));
 const result={exists:!!b,focused:!!b&&document.activeElement===b,visible:!!r&&r.width>0&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&style.visibility==='visible'&&style.display!=='none',hit:hitSamples.length===5&&hitSamples.every(p=>p.owns),hitSamples,overflow:document.documentElement.scrollWidth>innerWidth,rect:r,point:{x,y},activeElement:describe(document.activeElement),hitTarget:describe(hit),button:describe(b),ancestors,cmp:describe(document.getElementById('CybotCookiebotDialog')),viewport:{innerWidth,innerHeight,scrollX,scrollY,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft}:null}};
 return {...result,operable:result.focused&&result.visible&&result.hit&&!result.overflow};
}
