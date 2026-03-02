/**
 * Berry Phase hero animation for How it works page.
 * Enqueue this script only on the How it works page (wp_enqueue_script).
 * Expects: <canvas id="heroCanvasBerry"> inside .module-hero-canvas
 */
(function(){
function run(){
var c=document.getElementById('heroCanvasBerry')||document.querySelector('.module-hero-canvas canvas');
if(!c||!c.parentElement){setTimeout(run,50);return;}
var x=c.getContext('2d');if(!x)return;
var dpr=window.devicePixelRatio||1;
function phaseColor(phi,a){var h=42+145*(0.5+0.5*Math.sin(phi));return'hsla('+h+',55%,52%,'+a+')'}
function neonGlow(px,py,r,phi){var g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,phaseColor(phi,0.7));g.addColorStop(0.35,phaseColor(phi,0.25));g.addColorStop(1,phaseColor(phi,0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}
var triVerts=[{t:0.3,p:0},{t:Math.PI/2,p:Math.PI*0.7},{t:Math.PI/2,p:Math.PI*1.5}];
var triLabels=['H','X','Z'];
var pathPos=0,pathSpeed=0.0004,loopCount=0,accPhase=0;
var phaseHistory=[];var MAX_HIST=200;
var ang=0;
function sz(){if(!c.parentElement)return;var r=c.parentElement.getBoundingClientRect();if(r.width<1||r.height<1){setTimeout(sz,200);return}c.width=r.width*dpr;c.height=r.height*dpr;x.setTransform(dpr,0,0,dpr,0,0)}
function sphProj(t,p,R,cx,cy){var sx=R*Math.sin(t)*Math.cos(p+ang),sy=-R*Math.cos(t);return{x:cx+sx,y:cy+sy}}
function lerpAngle(a,b,t){return a+(b-a)*t}
function draw(now){
if(!c.parentElement)return;
if(!now)now=0;
var w=c.width/dpr,h=c.height/dpr;x.clearRect(0,0,w,h);
ang=now*0.0002;
var sphCx=w*0.22,sphCy=h*0.5,sphR=h*0.36;
var grL=w*0.48,grR=w*0.96,grT=h*0.15,grB=h*0.85,grW=grR-grL,grH=grB-grT;
pathPos+=pathSpeed;if(pathPos>=3){pathPos-=3;loopCount++;accPhase+=0.52}
var seg=Math.floor(pathPos)%3,segT=pathPos-seg;
var v0=triVerts[seg],v1=triVerts[(seg+1)%3];
var curT=lerpAngle(v0.t,v1.t,segT),curP=lerpAngle(v0.p,v1.p,segT);
var curPhi=curP+accPhase;
phaseHistory.push({phase:accPhase+segT*0.52/3,phi:curPhi});
if(phaseHistory.length>MAX_HIST)phaseHistory.shift();
x.strokeStyle=phaseColor(curPhi,0.15);x.lineWidth=1;x.beginPath();x.arc(sphCx,sphCy,sphR,0,Math.PI*2);x.stroke();
var ambG=x.createRadialGradient(sphCx,sphCy,sphR*0.5,sphCx,sphCy,sphR*1.15);ambG.addColorStop(0,phaseColor(curPhi,0.04));ambG.addColorStop(1,phaseColor(curPhi,0));x.fillStyle=ambG;x.beginPath();x.arc(sphCx,sphCy,sphR*1.15,0,Math.PI*2);x.fill();
x.strokeStyle=phaseColor(curPhi,0.1);x.lineWidth=0.6;x.setLineDash([3,3]);x.beginPath();for(var eq=0;eq<=48;eq++){var ea=eq/48*Math.PI*2;var ex=sphCx+Math.cos(ea)*sphR;var ey=sphCy+Math.sin(ea)*sphR*0.3;if(eq===0)x.moveTo(ex,ey);else x.lineTo(ex,ey)}x.stroke();x.setLineDash([]);
x.strokeStyle=phaseColor(curPhi,0.2);x.lineWidth=0.7;x.setLineDash([2,3]);x.beginPath();x.moveTo(sphCx,sphCy-sphR*1.08);x.lineTo(sphCx,sphCy+sphR*1.08);x.stroke();x.setLineDash([]);
x.font='500 8px monospace';x.textAlign='center';x.fillStyle=phaseColor(curPhi,0.55);x.textBaseline='bottom';x.fillText('|0\u27E9',sphCx,sphCy-sphR*1.1-2);x.textBaseline='top';x.fillText('|1\u27E9',sphCx,sphCy+sphR*1.1+2);
for(var ti=0;ti<3;ti++){var ta=triVerts[ti],tb=triVerts[(ti+1)%3];var steps=20;x.beginPath();for(var s=0;s<=steps;s++){var st2=s/steps;var tt=lerpAngle(ta.t,tb.t,st2);var tp=lerpAngle(ta.p,tb.p,st2);var pp=sphProj(tt,tp,sphR,sphCx,sphCy);if(s===0)x.moveTo(pp.x,pp.y);else x.lineTo(pp.x,pp.y)}var edgePhi=ti*Math.PI*2/3;x.strokeStyle=phaseColor(edgePhi,0.3);x.lineWidth=1.5;x.stroke()}
for(var vi=0;vi<3;vi++){var vp=sphProj(triVerts[vi].t,triVerts[vi].p,sphR,sphCx,sphCy);neonGlow(vp.x,vp.y,10,vi*Math.PI*2/3);x.fillStyle=phaseColor(vi*Math.PI*2/3,0.8);x.beginPath();x.arc(vp.x,vp.y,3,0,Math.PI*2);x.fill();x.font='600 9px monospace';x.textAlign='center';x.textBaseline='bottom';x.fillStyle=phaseColor(vi*Math.PI*2/3,0.65);x.fillText(triLabels[vi],vp.x,vp.y-8)}
var curPt=sphProj(curT,curP,sphR,sphCx,sphCy);
var vg=x.createLinearGradient(sphCx,sphCy,curPt.x,curPt.y);vg.addColorStop(0,phaseColor(curPhi,0.2));vg.addColorStop(1,phaseColor(curPhi,0.8));x.strokeStyle=vg;x.lineWidth=2;x.beginPath();x.moveTo(sphCx,sphCy);x.lineTo(curPt.x,curPt.y);x.stroke();
neonGlow(curPt.x,curPt.y,14,curPhi);x.fillStyle=phaseColor(curPhi,0.95);x.beginPath();x.arc(curPt.x,curPt.y,3.5,0,Math.PI*2);x.fill();
x.strokeStyle=phaseColor(0,0.12);x.lineWidth=0.5;x.beginPath();x.moveTo(grL,grB);x.lineTo(grR,grB);x.stroke();x.beginPath();x.moveTo(grL,grT);x.lineTo(grL,grB);x.stroke();
for(var gl=0;gl<=4;gl++){var gy=grT+gl/4*grH;x.strokeStyle=phaseColor(0,0.05);x.lineWidth=0.5;x.setLineDash([2,4]);x.beginPath();x.moveTo(grL,gy);x.lineTo(grR,gy);x.stroke();x.setLineDash([])}
x.font='400 7px monospace';x.textAlign='right';x.textBaseline='middle';x.fillStyle=phaseColor(0,0.3);x.fillText('2\u03c0',grL-4,grT);x.fillText('\u03c0',grL-4,grT+grH/2);x.fillText('0',grL-4,grB);x.font='400 7px monospace';x.textAlign='center';x.textBaseline='top';x.fillStyle=phaseColor(0,0.25);x.fillText('time \u2192',grL+grW/2,grB+4);
if(phaseHistory.length>1){x.beginPath();for(var hi=0;hi<phaseHistory.length;hi++){var hx=grL+hi/MAX_HIST*grW;var hy=grB-(phaseHistory[hi].phase%(Math.PI*2))/(Math.PI*2)*grH;if(hi===0)x.moveTo(hx,hy);else x.lineTo(hx,hy)}x.strokeStyle=phaseColor(curPhi,0.6);x.lineWidth=1.8;x.stroke();var lastH=phaseHistory[phaseHistory.length-1];var lastHx=grL+(phaseHistory.length-1)/MAX_HIST*grW;var lastHy=grB-(lastH.phase%(Math.PI*2))/(Math.PI*2)*grH;neonGlow(lastHx,lastHy,10,curPhi);x.fillStyle=phaseColor(curPhi,0.9);x.beginPath();x.arc(lastHx,lastHy,3,0,Math.PI*2);x.fill()}
x.font='500 10px monospace';x.textAlign='left';x.textBaseline='top';x.fillStyle=phaseColor(curPhi,0.5);var gammaVal=(accPhase+segT*0.52/3)%(Math.PI*2);x.fillText('Berry Phase: \u03b3 = '+gammaVal.toFixed(2)+' rad',grL+8,grT+4);x.font='400 8px monospace';x.fillStyle=phaseColor(curPhi,0.3);x.fillText('Loop #'+loopCount,grL+8,grT+18);
requestAnimationFrame(draw);
}
sz();window.addEventListener('resize',sz);requestAnimationFrame(draw);
document.addEventListener('visibilitychange',function(){if(!document.hidden)requestAnimationFrame(draw)});
window.addEventListener('pageshow',function(e){if(e.persisted){sz();requestAnimationFrame(draw)}});
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{setTimeout(run,0);}
})();
