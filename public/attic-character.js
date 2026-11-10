// Animate the original illustration locally. A small texture deformation keeps
// the scenery fixed and preserves the supplied character's drawing and palette.
export async function mountAtticCharacter(scene){
  const image=new Image();image.src='/attic-radio.jpg';
  try{await image.decode();}catch{return;}
  const host=document.createElement('div');host.className='attic-character';host.dataset.expression='idle';
  host.setAttribute('role','img');host.setAttribute('aria-label','女仆正在敲键盘，偶尔眨眼');
  const canvas=document.createElement('canvas');canvas.className='attic-character-canvas';host.append(canvas);
  const face=document.createElementNS('http://www.w3.org/2000/svg','svg');
  face.setAttribute('viewBox','0 0 548 1280');face.setAttribute('preserveAspectRatio','none');face.setAttribute('aria-hidden','true');
  face.innerHTML=`<defs><linearGradient id="attic-lid-skin" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8d1b6"/><stop offset="1" stop-color="#ffe4c8"/></linearGradient><radialGradient id="attic-cheek"><stop stop-color="#f28b98" stop-opacity=".65"/><stop offset="1" stop-color="#f28b98" stop-opacity="0"/></radialGradient></defs>
   <g class="attic-face-puppet">
    <g class="attic-lids"><path d="M255 600 Q270 605 284 609 Q295 625 286 636 Q268 646 258 627Z" fill="url(#attic-lid-skin)"/><path d="M315 598 Q339 584 366 590 L362 615 Q358 634 338 633 Q318 631 315 612Z" fill="url(#attic-lid-skin)"/><path class="attic-lash" d="M259 619 Q272 634 286 628 M319 612 Q340 625 360 609"/><path class="attic-lash" d="M261 622 257 623 M358 611 363 610"/></g>
    <g class="attic-happy-sparkle" fill="#fff8e9"><circle cx="278" cy="622" r="1.3"/><circle cx="343" cy="611" r="1.8"/></g>
    <g class="attic-blush"><ellipse cx="283" cy="638" rx="14" ry="7" fill="url(#attic-cheek)"/><ellipse cx="350" cy="632" rx="16" ry="8" fill="url(#attic-cheek)"/></g>
    <g class="attic-mouth"><ellipse cx="311" cy="641" rx="9" ry="7" fill="#ffe1c4"/><g class="attic-mouth-open"><path d="M305 640 Q311 638 317 639 Q316 649 312 649 Q307 649 305 640" fill="#743442" stroke="#70373b" stroke-width=".65"/><path d="M308 646 Q312 643 315 646 Q313 650 310 648" fill="#ee99a2"/></g></g>
    <path class="attic-happy-mouth" d="M304 641 Q311 649 319 639" fill="none" stroke="#97534b" stroke-width="1.25" stroke-linecap="round"/>
    <path class="attic-thinking-brow" d="M320 583 Q331 577 341 579" fill="none" stroke="#5b4058" stroke-width="1.7" stroke-linecap="round"/>
   </g>`;
  host.append(face);scene.prepend(host);
  let gl;
  try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});}catch{}
  let program,timeUniform,moodUniform;
  if(gl){
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
    try{
      program=gl.createProgram();
      gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 a; varying vec2 uv; void main(){uv=vec2((a.x+1.)*.5,(1.-a.y)*.5);gl_Position=vec4(a,0.,1.);}'));
      gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 uv;uniform sampler2D image;uniform float time;uniform float mood;
       float oval(vec2 p,vec2 c,vec2 r){vec2 d=(p-c)/r;return 1.-smoothstep(.25,1.,dot(d,d));}
       void main(){vec2 p=uv*vec2(548.,1280.);vec2 q=p;
        float breath=sin(time*1.65),head=oval(p,vec2(333.,556.),vec2(155.,174.));
        float think=step(1.5,mood)*(1.-step(2.5,mood));
        float dx=sin(time*.82)*1.25+think*1.5,dy=breath*1.35;
        q-=vec2(dx,dy)*head;
        float hair=oval(p,vec2(465.,674.),vec2(80.,143.));q.x-=sin(time*1.2+.8)*2.1*hair;
        float torso=oval(p,vec2(335.,703.),vec2(100.,66.));q.y-=breath*.8*torso;
        float left=oval(p,vec2(239.,747.),vec2(37.,19.)),right=oval(p,vec2(326.,755.),vec2(38.,20.));
        float typing=(1.-think)*(.45+.55*step(0.,sin(time*.65)));
        q.y-=left*max(0.,sin(time*7.5))*1.7*typing+right*max(0.,sin(time*7.5+2.8))*1.7*typing;
        vec4 original=texture2D(image,q/vec2(548.,1280.));
        float paper=smoothstep(177.,198.,p.x)*(1.-smoothstep(398.,423.,p.x))*smoothstep(826.,835.,p.y)*(1.-smoothstep(884.,902.,p.y));
        vec4 deskLeft=texture2D(image,vec2(182.,p.y)/vec2(548.,1280.));
        vec4 deskRight=texture2D(image,vec2(426.,p.y)/vec2(548.,1280.));
        gl_FragColor=mix(original,mix(deskLeft,deskRight,smoothstep(180.,420.,p.x)),paper);}`));
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Character shader link failed');
      gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
      timeUniform=gl.getUniformLocation(program,'time');moodUniform=gl.getUniformLocation(program,'mood');
      host.classList.add('has-motion-canvas');
      scene.classList.add('has-attic-character');
    }catch{gl=null;canvas.remove();}
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let nextBlink=2.8,blinkAt=-10,lastFrame=-100,lastReply=null,smileUntil=0,previewUntil=0,previewMood='idle',previous='';
  const start=performance.now();
  function frame(now){
    requestAnimationFrame(frame);if(document.hidden||now-lastFrame<33)return;lastFrame=now;
    const time=(now-start)/1000,paused=reduced.matches||document.body.classList.contains('motion-paused');
    const reply=scene.querySelector('#reply-text')?.textContent;
    if(reply!==lastReply){if(lastReply!==null)smileUntil=time+4;lastReply=reply;}
    const speaking=scene.classList.contains('is-speaking'),thinking=scene.classList.contains('is-thinking');
    const mood=previewUntil>time?previewMood:speaking?'speaking':thinking?'thinking':time<smileUntil?'happy':'idle';
    if(mood!==previous){host.dataset.expression=mood;host.setAttribute('aria-label',({idle:'女仆正在敲键盘，偶尔眨眼',thinking:'女仆正在思考',speaking:'女仆正在说话',happy:'女仆开心地微笑'})[mood]);previous=mood;}
    if(!paused&&time>nextBlink){blinkAt=time;nextBlink=time+3.2+Math.random()*3;}
    host.classList.toggle('is-blinking',!paused&&time-blinkAt<.15);
    host.classList.toggle('motion-still',paused);
    const t=paused?0:time,dx=Math.sin(t*.82)*1.25+(mood==='thinking'?1.5:0),dy=Math.sin(t*1.65)*1.35;
    face.querySelector('.attic-face-puppet').setAttribute('transform',`translate(${dx} ${dy})`);
    face.querySelector('.attic-mouth-open').setAttribute('transform',`translate(311 641) scale(1 ${paused?.5:.35+Math.abs(Math.sin(time*12))*.65}) translate(-311 -641)`);
    if(gl&&!gl.isContextLost()){
      const width=Math.min(1440,Math.round(scene.clientWidth*(devicePixelRatio||1))),height=Math.round(width*scene.clientHeight/scene.clientWidth);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
      gl.uniform1f(timeUniform,t);gl.uniform1f(moodUniform,mood==='thinking'?2:mood==='speaking'?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();host.classList.remove('has-motion-canvas');scene.classList.remove('has-attic-character');});
  const button=document.createElement('button');button.type='button';button.className='secondary';button.id='attic-expression-preview';button.textContent='☺ 人物表情';button.title='依次预览微笑、思考、说话，不发送弹幕或播放声音';
  const moods=['happy','thinking','speaking','idle'];let previewIndex=0;
  button.addEventListener('click',()=>{previewMood=moods[previewIndex++%moods.length];previewUntil=(performance.now()-start)/1000+5;});
  document.querySelector('.view-actions')?.append(button);
  frame(start);return host;
}
