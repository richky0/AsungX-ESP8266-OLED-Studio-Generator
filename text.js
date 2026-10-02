/* Generator teks bergerak: jadi "src" baru untuk pipeline app.js */
const tcv=document.createElement('canvas'),tcx=tcv.getContext('2d');
let tTimer=null,tAgain=false;

function prep(){
  const[w,h]=$('res').value.split('x').map(Number);
  tcv.width=w;tcv.height=h; // reset canvas
  const size=+$('tsize').value,mode=$('tmode').value,sp=+$('tspeed').value;
  tcx.font=`${$('tbold').checked?'bold ':''}${size}px ${$('tfont').value}`;
  const lines=$('ttext').value.split('\n'),horiz=mode==='left'||mode==='right';
  let tw=0,bh=0,mw=0;
  if(horiz)tw=tcx.measureText(lines.join(' ')).width;
  else{bh=lines.length*size*1.2;mw=Math.max(...lines.map(l=>tcx.measureText(l).width))}
  const dist=(horiz?tw:bh)+(horiz?w:h);
  return{w,h,size,mode,sp,lines,horiz,tw,bh,mw,dist,cycle:dist/sp};
}

function makeTextSource(){
  return{
    text:true,
    get w(){return prep().w},get h(){return prep().h},
    get dur(){return prep().cycle},
    at:async t=>{
      const g=prep();
      tcx.fillStyle='#000';tcx.fillRect(0,0,g.w,g.h);
      tcx.fillStyle='#fff';tcx.textBaseline='middle';
      const pos=(t*g.sp)%g.dist;
      if(g.horiz){
        tcx.textAlign='left';
        const x=g.mode==='left'?g.w-pos:-g.tw+pos;
        tcx.fillText(g.lines.join(' '),Math.round(x),Math.round(g.h/2));
      }else{
        tcx.textAlign='center';
        const lh=g.size*1.2,y0=g.mode==='up'?g.h-pos:-g.bh+pos;
        g.lines.forEach((l,i)=>tcx.fillText(l,Math.round(g.w/2),Math.round(y0+lh*(i+.5))));
      }
      return tcv;
    }
  };
}

function check(){
  const el=$('tinfo');
  if(!$('ttext').value.trim()){el.innerHTML='';return}
  const g=prep(),fps=+$('fps').value,dur=+$('dur').value,fs=g.w*g.h/8;
  const ppf=g.sp/fps,nCycle=Math.ceil(g.cycle*fps),nDur=Math.round(dur*fps);
  const nmax=Math.floor((SOFT-5)/fs),sizeDur=5+nDur*fs;
  const m=[`<div>1 putaran: <b>${g.cycle.toFixed(1)} s</b> (${nCycle} frame, ${fmt(5+nCycle*fs)} tanpa delta) · ${ppf.toFixed(1)} px/frame</div>`];
  const add=(c,t)=>m.push(`<div class="${c}">${t}</div>`);
  if(ppf>6)add('w','⚠️ Terlalu cepat (>6 px/frame): teks sulit dibaca dan terlihat melompat. Turunkan kecepatan atau naikkan FPS.');
  else if(ppf<0.5)add('w','⚠️ Terlalu lambat (<0.5 px/frame): banyak frame identik, boros ukuran. Naikkan kecepatan atau turunkan FPS.');
  if(g.horiz&&g.size>g.h)add('w',`⚠️ Tinggi font (${g.size}px) melebihi tinggi OLED (${g.h}px): teks terpotong.`);
  if(!g.horiz&&g.mw>g.w)add('w',`⚠️ Baris terpanjang (${Math.round(g.mw)}px) melebihi lebar OLED (${g.w}px): teks terpotong. Kecilkan font atau pecah baris.`);
  if(dur<g.cycle*0.98)add('w',`⚠️ Durasi (${dur} s) lebih pendek dari 1 putaran: teks tidak lewat penuh. Klik Auto-cut.`);
  else if(dur>g.cycle*1.02)add('w',`⚠️ Durasi (${dur} s) lebih dari 1 putaran: frame berulang membuang ukuran. Klik Auto-cut (loop dilakukan firmware).`);
  if(sizeDur>HARD)add('e',`❌ Estimasi ${fmt(sizeDur)} tanpa delta melebihi hard limit 60 KB.`);
  else if(sizeDur>SOFT)add('w',`⚠️ Estimasi ${fmt(sizeDur)} tanpa delta melebihi soft limit 45 KB.`);
  if(sizeDur>SOFT){
    const tmax=nmax/fps;
    let s=`Saran: maks ${tmax.toFixed(1)} s @ ${fps} FPS tanpa delta. Naikkan kecepatan ke ≥ ${Math.ceil(g.dist/tmax)} px/s`;
    const f=Math.floor(nmax/g.cycle);
    if(f>=5)s+=` atau turunkan FPS ke ≤ ${f}`;
    add('muted',s+', atau aktifkan delta / kecilkan resolusi. Ukuran final terlihat setelah Convert.');
  }
  el.innerHTML=m.join('');
}

async function runText(){
  if($('conv').disabled){tAgain=true;return}
  await convert();
  if(tAgain){tAgain=false;return runText()}
  if(frames.length)play();
}
const deb=()=>{clearTimeout(tTimer);tTimer=setTimeout(runText,350)};

$('tgo').onclick=()=>{
  const t=$('ttext').value.trim();
  if(!t)return alert('Isi teks dulu.');
  src=makeTextSource();
  name='teks_'+(t.slice(0,12).replace(/[^a-z0-9]+/gi,'_')||'anim');
  ready('✍️ Teks bergerak — tips: matikan Dithering untuk teks agar lebih tajam');
  check();runText();
};

['ttext','tfont','tsize','tspeed','tmode','tbold'].forEach(id=>$(id).addEventListener('input',()=>{
  $('tsizeV').textContent=$('tsize').value;$('tspV').textContent=$('tspeed').value;
  check();if(src&&src.text)deb();
}));
['fps','dur','res','thr','dith','delta','inv'].forEach(id=>$(id).addEventListener('input',()=>{
  check();if(src&&src.text)deb();
}));
$('cut').addEventListener('click',check);
check();
