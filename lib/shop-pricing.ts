export function shopPricing(price:number,delivery:number,promotion?:number|null){
 const active=typeof promotion==='number'&&Number.isInteger(promotion)&&promotion>0&&promotion<price;
 const original=price+delivery;const total=(active?promotion!:price)+delivery;
 return {original,total,reduction:active?Math.floor((original-total)*100/original):0,promoted:active};
}
