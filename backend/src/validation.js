function cpfOk(value){
 const cpf=String(value||"").replace(/\D/g,"");
 if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false;
 for(let t=9;t<11;t++){let sum=0;for(let i=0;i<t;i++)sum+=Number(cpf[i])*(t+1-i);if((sum*10)%11%10!==Number(cpf[t]))return false;}
 return true;
}
function cpfMask(value){return value?String(value).replace(/\D/g,"").replace(/^(\d{3})\d+(\d{2})$/,"$1.***.***-$2"):null;}
function susMask(value){return value?"•••• •••• •••• "+String(value).replace(/\D/g,"").slice(-4):null;}
module.exports={cpfOk,cpfMask,susMask};
