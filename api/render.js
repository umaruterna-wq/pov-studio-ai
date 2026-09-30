export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const key=process.env.SHOTSTACK_API_KEY;
    if(!key)return res.status(500).json({error:'SHOTSTACK_API_KEY is not configured'});
    const b=req.body||{};
    if(!b.timeline)return res.status(400).json({error:'Missing timeline'});
    const r=await fetch('https://api.shotstack.io/edit/v1/render',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key},body:JSON.stringify({timeline:b.timeline,output:b.output||{format:'mp4',resolution:'hd'}})});
    const d=await r.json();return res.status(r.status).json(d);
  }catch(e){return res.status(500).json({error:e.message||'Render request failed'})}
}