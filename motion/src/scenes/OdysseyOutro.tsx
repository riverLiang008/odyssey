import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

// Pixel bounds from the supplied 1720×1560 brand artwork. The original PNG is
// clipped at render time; geometry, colors and letterforms are not recreated.
type Piece = Readonly<{id:string;x:number;y:number;w:number;h:number;start:number}>;
const blocks: readonly Piece[] = [
  {id:'red',x:207,y:287,w:800,h:802,start:6},
  {id:'yellow',x:1007,y:287,w:502,h:502,start:17},
  {id:'green',x:1208,y:788,w:301,h:301,start:28},
  {id:'blue',x:1007,y:888,w:201,h:201,start:39},
];
const glyphs: readonly Piece[] = [
  {id:'o',x:558,y:1203,w:71,h:79,start:57},
  {id:'d',x:659,y:1203,w:64,h:79,start:63},
  {id:'y1',x:744,y:1203,w:69,h:79,start:69},
  {id:'s1',x:838,y:1203,w:60,h:79,start:75},
  {id:'s2',x:924,y:1203,w:60,h:79,start:81},
  {id:'e',x:1013,y:1203,w:51,h:79,start:87},
  {id:'y2',x:1091,y:1203,w:69,h:79,start:93},
];
const clamp = {extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
function ArtworkPiece({piece,scale,originX,originY,frame}:{piece:Piece;scale:number;originX:number;originY:number;frame:number}) {
  const p=interpolate(frame,[piece.start,piece.start+12],[0,1],clamp);
  const eased=1-Math.pow(1-p,3);
  return <div style={{position:'absolute',left:originX+piece.x*scale,top:originY+piece.y*scale,
    width:piece.w*scale,height:piece.h*scale,overflow:'hidden',opacity:p,
    transform:`translateY(${(1-eased)*12}px)`,willChange:'transform'}}>
    <Img src={staticFile('outro/odyssey-logo.png')} style={{position:'absolute',maxWidth:'none',
      width:1720*scale,height:1560*scale,left:-piece.x*scale,top:-piece.y*scale}}/>
  </div>;
}
export function OdysseyOutro() {
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{backgroundColor:'#ffffff'}}>
    {blocks.map(piece=><ArtworkPiece key={piece.id} piece={piece} scale={.52} originX={514} originY={90} frame={frame}/>)}
    {glyphs.map(piece=><ArtworkPiece key={piece.id} piece={piece} scale={.85} originX={229.85} originY={-281.4} frame={frame}/>)}
  </AbsoluteFill>;
}
