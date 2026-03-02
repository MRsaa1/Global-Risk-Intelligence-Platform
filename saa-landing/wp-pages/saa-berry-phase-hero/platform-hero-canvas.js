/**
 * Platform hero: circuit/wires animation. Enqueued only on Platform page.
 * Expects: <canvas id="heroCanvas"> inside .module-hero-canvas
 */
(function(){
var started=false;
function run(){
if(started)return;
var c=document.getElementById('heroCanvas')||document.querySelector('.module-hero-canvas canvas');
if(!c||!c.parentElement){setTimeout(run,50);return;}
var x=c.getContext('2d');if(!x)return;
started=true;
var dpr=window.devicePixelRatio||1;
function phaseColor(phi,a){var h=42+145*(0.5+0.5*Math.sin(phi));return'hsla('+h+',55%,52%,'+a+')'}
function neonGlow(px,py,r,phi){var g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,phaseColor(phi,0.7));g.addColorStop(0.35,phaseColor(phi,0.25));g.addColorStop(1,phaseColor(phi,0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}
var WIRES=['Risk','Analyzer','ARIN','Invest','Crypto','News'];
var NW=6,gates=[],particles=[],flashes=[];
function initGates(w){
  gates=[];var marginL=w*0.1,marginR=w*0.88;
  var gateTypes=['H','X','Z','H','X','Z','H','X','Z','H','Z','X'];
  for(var gi=0;gi<gateTypes.length;gi++){var gx=marginL+(gi+1)/(gateTypes.length+2)*(marginR-marginL);var gy=Math.floor(Math.random()*NW);gates.push({x:gx,wire:gy,type:gateTypes[gi],pulse:0})}
  for(var cn=0;cn<3;cn++){var gx2=marginL+(cn*4+2)/(gateTypes.length+2)*(marginR-marginL);var w1=cn*2,w2=cn*2+1;gates.push({x:gx2,wire:w1,wire2:w2,type:'CNOT',pulse:0})}
}
function sz(){if(!c.parentElement)return;var r=c.parentElement.getBoundingClientRect();if(r.width<1||r.height<1){setTimeout(sz,200);return}c.width=r.width*dpr;c.height=r.height*dpr;x.setTransform(dpr,0,0,dpr,0,0);initGates(c.width/dpr)}
var lastSpawn=0,SPAWN_INT=800;
function draw(now){
  if(!c.parentElement){started=false;return;}
  if(!now)now=0;
  var r=c.parentElement.getBoundingClientRect();
  if(r.width<1||r.height<1){sz();requestAnimationFrame(draw);return;}
  var w=c.width/dpr,h=c.height/dpr;
  if(w<1||h<1){sz();requestAnimationFrame(draw);return;}
  x.clearRect(0,0,w,h);
  var marginL=w*0.08,marginR=w*0.92,wireT=h*0.12,wireB=h*0.88;
  var wireSpacing=(wireB-wireT)/(NW-1);
  for(var bg=0;bg<w;bg+=40){x.strokeStyle=phaseColor(0,0.03);x.lineWidth=0.5;x.beginPath();x.moveTo(bg,0);x.lineTo(bg,h);x.stroke()}
  for(var bgy=0;bgy<h;bgy+=40){x.beginPath();x.moveTo(0,bgy);x.lineTo(w,bgy);x.stroke()}
  for(var wi=0;wi<NW;wi++){
    var wy=wireT+wi*wireSpacing;var wPhi=wi*Math.PI/3;
    x.strokeStyle=phaseColor(wPhi,0.18);x.lineWidth=1;x.beginPath();x.moveTo(marginL,wy);x.lineTo(marginR,wy);x.stroke();
    x.font='500 9px "JetBrains Mono",monospace';x.textAlign='right';x.textBaseline='middle';x.fillStyle=phaseColor(wPhi,0.5);x.fillText(WIRES[wi],marginL-8,wy);
    x.font='400 8px "JetBrains Mono",monospace';x.textAlign='left';x.fillStyle=phaseColor(wPhi,0.35);x.fillText('|0\u27E9',marginL-8,wy-12);
    var mX=marginR+8;x.strokeStyle=phaseColor(wPhi,0.25);x.lineWidth=1.2;
    x.beginPath();x.arc(mX+8,wy,7,Math.PI*0.8,Math.PI*2.2);x.stroke();
    x.beginPath();x.moveTo(mX+8,wy-7);x.lineTo(mX+8,wy+2);x.stroke();
  }
  for(var gi=0;gi<gates.length;gi++){var g=gates[gi];if(g.pulse>0)g.pulse=Math.max(0,g.pulse-0.01);
    var gy=wireT+g.wire*wireSpacing;var gPhi=g.wire*Math.PI/3+now*0.001;
    if(g.type==='CNOT'){
      var gy2=wireT+g.wire2*wireSpacing;
      x.strokeStyle=phaseColor(gPhi,0.25+g.pulse*0.5);x.lineWidth=1;x.beginPath();x.moveTo(g.x,gy);x.lineTo(g.x,gy2);x.stroke();
      x.fillStyle=phaseColor(gPhi,0.4+g.pulse*0.5);x.beginPath();x.arc(g.x,gy,4,0,Math.PI*2);x.fill();
      x.strokeStyle=phaseColor(gPhi,0.5+g.pulse*0.4);x.lineWidth=1.5;x.beginPath();x.arc(g.x,gy2,6,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(g.x-6,gy2);x.lineTo(g.x+6,gy2);x.stroke();x.beginPath();x.moveTo(g.x,gy2-6);x.lineTo(g.x,gy2+6);x.stroke();
    }else{
      var gw=22,gh=18;
      x.fillStyle=phaseColor(gPhi,0.05+g.pulse*0.1);x.fillRect(g.x-gw/2,gy-gh/2,gw,gh);
      x.strokeStyle=phaseColor(gPhi,0.3+g.pulse*0.5);x.lineWidth=1.2;x.strokeRect(g.x-gw/2,gy-gh/2,gw,gh);
      if(g.pulse>0.3)neonGlow(g.x,gy,gw,gPhi);
      x.font='600 10px "JetBrains Mono",monospace';x.textAlign='center';x.textBaseline='middle';
      x.fillStyle=phaseColor(gPhi,0.7+g.pulse*0.3);x.fillText(g.type,g.x,gy);
    }
  }
  if(now-lastSpawn>SPAWN_INT){lastSpawn=now;var pw=Math.floor(Math.random()*NW);particles.push({x:marginL,wire:pw,phi:pw*Math.PI/3,speed:0.08+Math.random()*0.04})}
  for(var pi=particles.length-1;pi>=0;pi--){
    var p=particles[pi];p.x+=p.speed+0.5;
    var py=wireT+p.wire*wireSpacing;
    for(var gi2=0;gi2<gates.length;gi2++){var g2=gates[gi2];if(g2.type==='CNOT')continue;if(g2.wire===p.wire&&Math.abs(p.x-g2.x)<3){g2.pulse=1;p.phi+=Math.PI*0.3}}
    if(p.x>marginR){
      flashes.push({x:marginR+16,y:py,t0:now,val:Math.random()>0.5?'1':'0',phi:p.phi});
      particles.splice(pi,1);continue;
    }
    neonGlow(p.x,py,8,p.phi);
    x.fillStyle=phaseColor(p.phi,0.9);x.beginPath();x.arc(p.x,py,3,0,Math.PI*2);x.fill();
  }
  for(var fi=flashes.length-1;fi>=0;fi--){
    var f=flashes[fi];var age=(now-f.t0)/600;
    if(age>1){flashes.splice(fi,1);continue}
    x.font='700 12px "JetBrains Mono",monospace';x.textAlign='center';x.textBaseline='middle';
    x.fillStyle=phaseColor(f.phi,(1-age)*0.8);x.fillText(f.val,f.x,f.y);
    neonGlow(f.x,f.y,15*(1-age),f.phi);
  }
  requestAnimationFrame(draw);
}
sz();window.addEventListener('resize',sz);requestAnimationFrame(draw);
}
function start(){
  run();
  setTimeout(run,200);setTimeout(run,500);setTimeout(run,1000);setTimeout(run,2000);
  if(document.body){
    var obs=new MutationObserver(function(mutations){
      for(var i=0;i<mutations.length;i++){
        var nodes=mutations[i].addedNodes;
        for(var j=0;j<nodes.length;j++){
          var n=nodes[j];
          if(n.nodeType!==1)continue;
          if(n.id==='heroCanvas'||n.querySelector&&n.querySelector('#heroCanvas')){run();return;}
        }
      }
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }
  document.addEventListener('visibilitychange',function(){if(!document.hidden)run();});
  window.addEventListener('pageshow',function(){run();});
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start);}else{start();}
})();
