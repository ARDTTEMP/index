import test from 'node:test';
import assert from 'node:assert/strict';
import {shopPricing} from '../lib/shop-pricing.ts';
test('Customer prices include delivery and discounts never overstate savings',()=>{
 assert.deepEqual(shopPricing(8000,2000),{original:10000,total:10000,reduction:0,promoted:false});
 assert.deepEqual(shopPricing(8000,2000,6000),{original:10000,total:8000,reduction:20,promoted:true});
 assert.equal(shopPricing(10000,2000,9000).reduction,8);
 assert.equal(shopPricing(8000,2000,8000).promoted,false);
 assert.equal(shopPricing(8000,2000,0).promoted,false);
 assert.equal(shopPricing(8000,2000,1.5).promoted,false);
});
