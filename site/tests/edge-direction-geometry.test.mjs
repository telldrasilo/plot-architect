import test from 'node:test';
import assert from 'node:assert/strict';
import {directionAtPathFraction} from '../src/edge_direction_geometry.mjs';

const segment=(a,b)=>{
 const length=Math.hypot(b.x-a.x,b.y-a.y);
 return {getTotalLength:()=>length,
  getPointAtLength:d=>({x:a.x+(b.x-a.x)*Math.max(0,Math.min(1,d/length)),
   y:a.y+(b.y-a.y)*Math.max(0,Math.min(1,d/length))})};
};
const routed=()=>{
 // The line's real length is 400, not its 316px endpoint chord.
 const first=segment({x:0,y:0},{x:100,y:0});
 const second=segment({x:100,y:0},{x:100,y:300});
 return {getTotalLength:()=>400,getPointAtLength:d=>
  d<=100?first.getPointAtLength(d):second.getPointAtLength(d-100)};
};

test('midpoint follows actual routed SVG path length, not endpoint chord',()=>{
 const placement=directionAtPathFraction(routed());
 assert.equal(placement.distance,200);
 assert.equal(placement.length,400);
 assert.deepEqual({x:placement.x,y:placement.y},{x:100,y:100});
 assert.equal(placement.angle,90);
});

test('straight, reversed and diagonal directions preserve the tangent',()=>{
 const straight=directionAtPathFraction(segment({x:0,y:7},{x:100,y:7}));
 assert.equal(straight.x,50);
 assert.equal(straight.y,7);
 assert.equal(straight.angle,0);
 const reverse=directionAtPathFraction(segment({x:100,y:0},{x:0,y:0}));
 assert.ok(Math.abs(reverse.angle)===180);
 const diagonal=directionAtPathFraction(segment({x:0,y:0},{x:50,y:50}));
 assert.ok(Math.abs(diagonal.angle-45)<1e-9);
});

test('fraction is explicit but defaults to half the actual length',()=>{
 const p=directionAtPathFraction(routed(),{fraction:.25});
 assert.equal(p.distance,100);
 assert.deepEqual({x:p.x,y:p.y},{x:100,y:0});
 assert.ok(Math.abs(p.angle-45)<1e-9,'corner gets a tangent bisector');
});

test('degenerate, malformed and non-finite measurements do not render a marker',()=>{
 assert.equal(directionAtPathFraction(null),null);
 assert.equal(directionAtPathFraction({getTotalLength:()=>0,getPointAtLength:()=>({x:0,y:0})}),null);
 assert.equal(directionAtPathFraction({getTotalLength:()=>10,getPointAtLength:()=>({x:NaN,y:0})}),null);
 assert.equal(directionAtPathFraction(segment({x:0,y:0},{x:1,y:1}),{fraction:1}),null);
 assert.equal(directionAtPathFraction(segment({x:0,y:0},{x:1,y:1}),{tangentWindow:-1}),null);
 assert.equal(directionAtPathFraction({getTotalLength(){throw Error('detached')},getPointAtLength(){} }),null);
});
