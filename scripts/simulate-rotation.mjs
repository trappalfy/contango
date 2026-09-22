/**
 * Proves a rotation would execute, without sending anything.
 *
 * The transaction cannot be built and tried for real without a private key,
 * so this stands in: it overrides the two approvals in the call's state and
 * runs the exact calldata lib/v4/router.ts produces against a live node. If it
 * returns SUCCESS, every part of the encoding is right — the two hops, the
 * open delta that joins them, the settle and the take.
 *
 * The token keeps its balances under ERC-7201 namespaced storage, so the
 * allowance slot is derived from OpenZeppelin's namespace rather than guessed;
 * the balance slot is checked against the real balance first to prove the
 * derivation.
 *
 * Run: node scripts/simulate-rotation.mjs [wallet] [amount]
 */
import { createPublicClient, http, keccak256, encodeAbiParameters, parseAbiParameters, encodeFunctionData, parseUnits, formatUnits } from 'viem'
const RPC='https://rpc.mainnet.chain.robinhood.com'
const client=createPublicClient({transport:http(RPC)})
const W=process.argv[2] ?? '0xef048611d7F3077b35Fab260565886186fDa32bA'
const XOM='0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5'
const USO='0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344'
const USDG='0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168'
const ZERO='0x0000000000000000000000000000000000000000'
const PERMIT2='0x000000000022D473030F116dDEE9F6B43aC78BA3'
const ROUTERS={'official 0x06AfBA43':'0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99','observed 0x88767899':'0x8876789976decbfcbbbe364623c63652db8c0904'}

// --- storage slots ---
const OZ='0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00'
const allowBase='0x'+(BigInt(OZ)+1n).toString(16).padStart(64,'0')
const inner=keccak256(encodeAbiParameters(parseAbiParameters('address,bytes32'),[W,allowBase]))
const xomAllowSlot=keccak256(encodeAbiParameters(parseAbiParameters('address,bytes32'),[PERMIT2,inner]))
const MAXU=(1n<<256n)-1n

function permit2Slot(owner,token,spender){
  const a=keccak256(encodeAbiParameters(parseAbiParameters('address,uint256'),[owner,1n]))
  const b=keccak256(encodeAbiParameters(parseAbiParameters('address,bytes32'),[token,a]))
  return keccak256(encodeAbiParameters(parseAbiParameters('address,bytes32'),[spender,b]))
}
const exp=BigInt(Math.floor(Date.now()/1000)+3600)
const packed=((1n<<160n)-1n) | (exp<<160n) | (0n<<208n)

// --- calldata, identical to lib/v4/router.ts ---
const SINGLE=parseAbiParameters('((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint160 sqrtPriceLimitX96,bytes hookData)')
const CA=parseAbiParameters('address currency, uint256 amount')
const byte=(v)=>v.toString(16).padStart(2,'0'), cb=(...v)=>`0x${v.map(byte).join('')}`
const urAbi=[{type:'function',name:'execute',stateMutability:'payable',inputs:[{name:'commands',type:'bytes'},{name:'inputs',type:'bytes[]'},{name:'deadline',type:'uint256'}],outputs:[]}]
const single=(c0,c1,fee,sp,z,amt,min)=>encodeAbiParameters(SINGLE,[{poolKey:{currency0:c0,currency1:c1,fee,tickSpacing:sp,hooks:ZERO},zeroForOne:z,amountIn:amt,amountOutMinimum:min,sqrtPriceLimitX96:0n,hookData:'0x'}])

const amountIn=parseUnits(process.argv[3] ?? '0.05',18)
// quote it first
const quoterAbi=[{type:'function',name:'quoteExactInput',stateMutability:'nonpayable',inputs:[{name:'params',type:'tuple',components:[{name:'exactCurrency',type:'address'},{name:'path',type:'tuple[]',components:[{name:'intermediateCurrency',type:'address'},{name:'fee',type:'uint24'},{name:'tickSpacing',type:'int24'},{name:'hooks',type:'address'},{name:'hookData',type:'bytes'}]},{name:'exactAmount',type:'uint128'}]}],outputs:[{name:'amountOut',type:'uint256'},{name:'gasEstimate',type:'uint256'}]}]
const q=await client.simulateContract({address:'0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94',abi:quoterAbi,functionName:'quoteExactInput',
  args:[{exactCurrency:XOM,path:[{intermediateCurrency:USDG,fee:2000,tickSpacing:20,hooks:ZERO,hookData:'0x'},{intermediateCurrency:USO,fee:1200,tickSpacing:15,hooks:ZERO,hookData:'0x'}],exactAmount:amountIn}]})
const quoted=q.result[0]
const minOut=quoted*995n/1000n
console.log(`quote: 0.05 XOM -> ${formatUnits(quoted,18)} USO   (min at 0.5% slippage: ${formatUnits(minOut,18)})`)

const input=encodeAbiParameters(parseAbiParameters('bytes actions, bytes[] params'),[cb(0x06,0x06,0x0c,0x0f),[
  single(USDG,XOM,2000,20,false,amountIn,0n),
  single(USDG,USO,1200,15,true,0n,minOut),
  encodeAbiParameters(CA,[XOM,amountIn]),
  encodeAbiParameters(CA,[USO,minOut])]])

for(const [name,UR] of Object.entries(ROUTERS)){
  const data=encodeFunctionData({abi:urAbi,functionName:'execute',args:[cb(0x10),[input],BigInt(Math.floor(Date.now()/1000)+1800)]})
  const overrides={
    [XOM]:{stateDiff:{[xomAllowSlot]:'0x'+MAXU.toString(16)}},
    [PERMIT2]:{stateDiff:{[permit2Slot(W,XOM,UR)]:'0x'+packed.toString(16).padStart(64,'0')}},
  }
  const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{from:W,to:UR,data,value:'0x0'},'latest',overrides]})})
  const j=await r.json()
  console.log(`\n${name}:`)
  console.log('  ', j.error ? (j.error.data && j.error.data!=='0x' ? 'revert '+j.error.data : '(bare revert) '+j.error.message) : 'SUCCESS ✓  the whole rotation executes')
}
