const $=id=>document.getElementById(id);
const SOFT=45*1024,HARD=60*1024;
const vid=document.createElement('video');vid.muted=true;vid.playsInline=true;vid.preload='auto';
let src=null,frames=[],blob=null,cur=0,timer=null,name='anim';

const dims=()=>{const[w,h]=$('res').value.split('x').map(Number);return{w,h,fs:w*h/8}};
const fmt=b=>(b/1024).toFixed(1)+' KB';

/* ---------- GIF decoder (tanpa library) ---------- */
function lzw(min,data,n){
  const clear=1<<min,eoi=clear+1;let size=min+1,next=eoi+1;
  const pre=new Int16Array(4096),suf=new Uint8Array(4096),stack=new Uint8Array(4097);
  const out=new Uint8Array(n);let o=0,bits=0,acc=0,ip=0,old=-1,first=0;
  for(let i=0;i<clear;i++)suf[i]=i;
  while(o<n){
    while(bits<size){if(ip>=data.length)return out;acc|=data[ip++]<<bits;bits+=8}
    const code=acc&((1<<size)-1);acc>>=size;bits-=size;
    if(code===clear){size=min+1;next=eoi+1;old=-1;continue}
    if(code===eoi)break;
    if(old===-1){out[o++]=suf[code];old=code;first=code;continue}
    let c=code,sp=0;
    if(code>=next){stack[sp++]=first;c=old}
    while(c>=clear){stack[sp++]=suf[c];c=pre[c]}
    first=suf[c];stack[sp++]=first;
    while(sp>0&&o<n)out[o++]=stack[--sp];
    if(next<4096){pre[next]=old;suf[next]=first;next++;if(next===(1<<size)&&size<12)size++}
    old=code;
  }
  return out;
}
function deint(px,w,h){
  const out=new Uint8Array(px.length);let r=0;
  for(const[s,st]of[[0,8],[4,8],[2,4],[1,2]])for(let y=s;y<h;y+=st){out.set(px.subarray(r*w,(r+1)*w),y*w);r++}
  return out;
}
function parseGIF(buf){
  const d=new Uint8Array(buf);
  if(String.fromCharCode(d[0],d[1],d[2])!=='GIF')throw new Error('Bukan file GIF valid');
  const W=d[6]|d[7]<<8,H=d[8]|d[9]<<8,fl=d[10];let p=13,gct=null;
  if(fl&0x80){const n=3<<((fl&7)+1);gct=d.subarray(p,p+n);p+=n}
  const comp=document.createElement('canvas');comp.width=W;comp.height=H;
  const cx=comp.getContext('2d',{willReadFrequently:true});
  const out=[];let gce=null,pd=0,pr=null,saved=null;
  while(p<d.length){
    const b=d[p++];
    if(b===0x3B)break;
    if(b===0x21){
      const l=d[p++];
      if(l===0xF9)gce={disp:(d[p+1]>>2)&7,tr:(d[p+1]&1)?d[p+4]:-1,ms:(d[p+2]|d[p+3]<<8)*10};
      let n;while((n=d[p++])!==0)p+=n;
    }else if(b===0x2C){
      const ix=d[p]|d[p+1]<<8,iy=d[p+2]|d[p+3]<<8,iw=d[p+4]|d[p+5]<<8,ih=d[p+6]|d[p+7]<<8,lf=d[p+8];p+=9;
      let pal=gct;
      if(lf&0x80){const n=3<<((lf&7)+1);pal=d.subarray(p,p+n);p+=n}
      const min=d[p++],ch=[];let n,tot=0;
      while((n=d[p++])!==0){ch.push(d.subarray(p,p+n));p+=n;tot+=n}
      const data=new Uint8Array(tot);let o=0;for(const c of ch){data.set(c,o);o+=c.length}
      let px=lzw(min,data,iw*ih);if(lf&0x40)px=deint(px,iw,ih);
      if(pd===2&&pr)cx.clearRect(pr[0],pr[1],pr[2],pr[3]);
      else if(pd===3&&saved)cx.putImageData(saved,0,0);
      const g=gce||{disp:0,tr:-1,ms:100};
      saved=g.disp===3?cx.getImageData(0,0,W,H):null;
      const im=cx.getImageData(ix,iy,iw,ih),dd=im.data;
      for(let i=0;i<px.length;i++){
        const c=px[i];if(c===g.tr)continue;
        dd[i*4]=pal[c*3];dd[i*4+1]=pal[c*3+1];dd[i*4+2]=pal[c*3+2];dd[i*4+3]=255;
      }
      cx.putImageData(im,ix,iy);
      const f=document.createElement('canvas');f.width=W;f.height=H;f.getContext('2d').drawImage(comp,0,0);
      out.push({c:f,ms:g.ms<=10?100:g.ms});
      pd=g.disp;pr=[ix,iy,iw,ih];gce=null;
    }
  }
  if(!out.length)throw new Error('GIF tidak berisi frame');
  let t=0;const starts=out.map(f=>{const s=t;t+=f.ms;return s});
  const total=t;
  return{dur:total/1000,w:W,h:H,n:out.length,
    at:async s=>{const m=(s*1000)%total;let i=starts.length-1;while(i>0&&starts[i]>m)i--;return out[i].c}};
}

/* ---------- UI ---------- */
$('theme').onclick=()=>{const r=document.documentElement;r.dataset.theme=r.dataset.theme==='dark'?'light':'dark'};
$('fps').oninput=()=>{$('fpsV').textContent=$('fps').value;estimate()};
$('thr').oninput=()=>$('thrV').textContent=$('thr').value;
['dur','res','delta'].forEach(i=>$(i).oninput=estimate);

const seek=t=>new Promise(r=>{vid.onseeked=r;vid.currentTime=t});

function ready(label){
  $('info').textContent=label;
  $('start').max=src.dur;
  $('cutMsg').textContent=src.dur>10?'⚠️ Lebih dari 10 detik: akan dipotong otomatis.':'';
  autoCut();
}
async function loadFile(f){
  if(!f)return;
  name=f.name.replace(/\.[^.]+$/,'');
  src=null;
  if(f.type==='image/gif'||/\.gif$/i.test(f.name)){
    try{
      src=parseGIF(await f.arrayBuffer());
      ready(`${f.name} — GIF ${src.w}×${src.h}, ${src.n} frame, ${src.dur.toFixed(1)} s`);
    }catch(e){alert('GIF gagal dibaca: '+e.message)}
    return;
  }
  if(vid.src)URL.revokeObjectURL(vid.src);
  vid.src=URL.createObjectURL(f);
  vid.onloadedmetadata=()=>{
    src={dur:vid.duration,w:vid.videoWidth,h:vid.videoHeight,
      at:async t=>{await seek(Math.min(t,vid.duration-.001));return vid}};
    ready(`${f.name} — ${vid.videoWidth}×${vid.videoHeight}, ${vid.duration.toFixed(1)} s`);
  };
  vid.onerror=()=>alert('Video tidak bisa dibaca browser (codec tidak didukung). Coba MP4 H.264, WEBM, atau GIF.');
}
$('file').onchange=e=>loadFile(e.target.files[0]);
const dz=$('drop');
dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};
dz.ondragleave=()=>dz.classList.remove('over');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');loadFile(e.dataTransfer.files[0])};

function maxDur(){const{fs}=dims(),fps=+$('fps').value;return (SOFT-5)/(fs*fps)}
function autoCut(){
  const avail=(src?src.dur:60)-(+$('start').value||0);
  const m=$('delta').checked?maxDur()*3:maxDur();
  const d=Math.max(0.5,Math.min(avail,m));
  $('dur').value=d.toFixed(1);
  $('cutMsg').textContent=`Durasi diset ${d.toFixed(1)} s (batas tanpa delta ≈ ${maxDur().toFixed(1)} s).`;
  estimate();
}
$('cut').onclick=autoCut;

function estimate(){
  const{fs}=dims(),n=Math.round($('dur').value*$('fps').value);
  const full=5+n*fs;
  $('stats').innerHTML=`Estimasi (tanpa delta): ${n} frame, ${fmt(full)}`;
  if(!blob)$('warn').innerHTML=full>HARD?'<span class="e">Tanpa delta melebihi hard limit — kurangi durasi/FPS atau aktifkan delta.</span>':'';
}

function toBits(img,w,h){
  const g=new Float32Array(w*h),thr=+$('thr').value,dith=$('dith').checked,inv=$('inv').checked;
  for(let i=0;i<w*h;i++)g[i]=.299*img.data[i*4]+.587*img.data[i*4+1]+.114*img.data[i*4+2];
  const on=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,o=g[i],nw=o<thr?0:255;
    on[i]=nw?1:0;
    if(dith){const e=o-nw;
      if(x+1<w)g[i+1]+=e*7/16;
      if(y+1<h){if(x>0)g[i+w-1]+=e*3/16;g[i+w]+=e*5/16;if(x+1<w)g[i+w+1]+=e/16}}
  }
  const out=new Uint8Array(w*h/8);
  for(let y=0;y<h;y++)for(let xb=0;xb<w/8;xb++){
    let b=0;
    for(let k=0;k<8;k++){let v=on[y*w+xb*8+k];if(inv)v^=1;if(v)b|=1<<(7-k)}
    out[y*(w/8)+xb]=b;
  }
  return out;
}

async function convert(){
  if(!src)return alert('Upload video/GIF dulu.');
  const{w,h}=dims(),fps=+$('fps').value,st=+$('start').value;
  const n=Math.max(1,Math.round($('dur').value*fps));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d',{willReadFrequently:true});
  const s=Math.min(w/src.w,h/src.h),dw=src.w*s,dh=src.h*s;
  frames=[];stop();$('conv').disabled=true;$('prog').hidden=false;$('prog').max=n;
  try{
    for(let i=0;i<n;i++){
      const el=await src.at(st+i/fps);
      x.fillStyle='#000';x.fillRect(0,0,w,h);
      x.drawImage(el,(w-dw)/2,(h-dh)/2,dw,dh);
      frames.push(toBits(x.getImageData(0,0,w,h),w,h));
      $('prog').value=i+1;
      if(i%5===0)await new Promise(r=>setTimeout(r));
    }
    build();
  }catch(e){alert('Gagal convert: '+e.message)}
  $('conv').disabled=false;$('prog').hidden=true;
}

function build(){
  const n=frames.length,fs=frames[0].length,d=$('delta').checked?1:0;
  const parts=[new Uint8Array([n&255,n>>8,fs&255,fs>>8,d]),frames[0]];
  for(let i=1;i<n;i++){
    if(!d){parts.push(frames[i]);continue}
    const idx=[],val=[];
    for(let j=0;j<fs;j++)if(frames[i][j]!==frames[i-1][j]){idx.push(j);val.push(frames[i][j])}
    const b=new Uint8Array(2+idx.length*3),c=idx.length;
    b[0]=c&255;b[1]=c>>8;
    idx.forEach((v,k)=>{b[2+k*2]=v&255;b[3+k*2]=v>>8});
    b.set(val,2+c*2);
    parts.push(b);
  }
  blob=new Blob(parts);
  $('scrub').max=n-1;show(0);stats();
}

function stats(){
  const n=frames.length,fps=+$('fps').value,sz=blob.size;
  $('stats').innerHTML=`Total frame: ${n}<br>Ukuran: <b>${fmt(sz)}</b><br>Durasi: ${(n/fps).toFixed(1)} s @ ${fps} FPS`;
  let m='<span class="ok">✅ Di bawah soft limit</span>',ok=true;
  if(sz>HARD){m='<span class="e">❌ Melebihi hard limit 60 KB — download dinonaktifkan. Kurangi durasi/FPS atau aktifkan delta.</span>';ok=false}
  else if(sz>SOFT)m='<span class="w">⚠️ Melebihi soft limit 45 KB. Kurangi durasi atau aktifkan delta.</span>';
  $('warn').innerHTML=m;$('dl').disabled=!ok;
}

function show(i){
  if(!frames.length)return;
  cur=i;const{w,h}=dims(),ctx=$('oled').getContext('2d');
  $('oled').width=w;$('oled').height=h;
  const im=ctx.createImageData(w,h),f=frames[i];
  for(let p=0;p<w*h;p++){
    const on=(f[p>>3]>>(7-(p&7)))&1,o=p*4;
    im.data[o]=on?230:0;im.data[o+1]=on?255:0;im.data[o+2]=on?250:0;im.data[o+3]=255;
  }
  ctx.putImageData(im,0,0);
  $('scrub').value=i;$('fi').textContent=`Frame: ${i+1} / ${frames.length} — ${f.length} B`;
}
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶'}
function play(){
  if(!frames.length)return;
  stop();$('play').textContent='⏸';
  timer=setInterval(()=>show((cur+1)%frames.length),1000/(+$('fps').value*+$('spd').value));
}
$('play').onclick=()=>timer?stop():play();
$('spd').onchange=()=>timer&&play();
$('prev').onclick=()=>{stop();show((cur-1+frames.length)%frames.length)};
$('next').onclick=()=>{stop();show((cur+1)%frames.length)};
$('scrub').oninput=e=>{stop();show(+e.target.value)};
$('conv').onclick=convert;
$('dl').onclick=()=>{
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=name+'_anim.bin';a.click();
};
$('reset').onclick=()=>{
  stop();frames=[];blob=null;$('dl').disabled=true;$('stats').innerHTML='';$('warn').innerHTML='';
  $('fi').textContent='Frame: - / -';$('fps').value=15;$('fpsV').textContent=15;$('thr').value=128;$('thrV').textContent=128;
  $('dur').value=3;$('start').value=0;
  $('oled').getContext('2d').clearRect(0,0,999,999);estimate();
};
estimate();
