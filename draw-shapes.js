// Geometry for the server-owned 600 × 480 drawing board; no text in pictures.
export const line=(...points)=>points;
export const oval=(x,y,rx,ry)=>Array.from({length:49},(_,i)=>{const a=i*Math.PI/24;return [x+rx*Math.cos(a),y+ry*Math.sin(a)];});
export const arc=(x,y,rx,ry,start,end)=>Array.from({length:33},(_,i)=>{const a=start+(end-start)*i/32;return [x+rx*Math.cos(a),y+ry*Math.sin(a)];});
export const rect=(x,y,w,h)=>line([x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]);
export const star=(x,y,r,inner,n=5)=>Array.from({length:n*2+1},(_,i)=>{const a=-Math.PI/2+i*Math.PI/n,rad=i%2?inner:r;return [x+rad*Math.cos(a),y+rad*Math.sin(a)];});
export const leaf=(x,y,w,h)=>line([x,y],[x-w*.5,y-h*.3],[x-w*.6,y-h*.7],[x,y-h],[x+w*.6,y-h*.7],[x+w*.5,y-h*.3],[x,y]);
export const eyes=(x1,x2,y,r=9)=>[oval(x1,y,r,r*1.3),oval(x2,y,r,r*1.3)];
export const smile=(x,y,w=32,h=25)=>arc(x,y,w,h,0,Math.PI);
export const wheel=(x,y,r)=>[oval(x,y,r,r),oval(x,y,r*.4,r*.4)];
export const zig=(x,y,w,h,n)=>Array.from({length:n+1},(_,i)=>[x+w*i/n,y+(i%2?h:0)]);
export const curve=(p0,p1,p2)=>Array.from({length:25},(_,i)=>{const t=i/24,u=1-t;return [u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0],u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1]];});
