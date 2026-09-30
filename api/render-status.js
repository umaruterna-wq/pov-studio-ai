export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  try{
    const key=process.env.SHOTSTACK_API_KEY, id=req.query?.id;
    if(!key)return res.status(500).json({error:'SHOTSTACK_API_KEY is not configured'});
    if(!id)return res.status(400).json({error:'Missing render id'});
    const r=await fetch('https://api.shotstack.io/edit/v1/render/'+encodeURIComponent(id),{headers:{'Accept':'application/json','x-api-key':key}});
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json({error:d.errors?.[0]?.detail||d.message||'Render status failed'});
    const a=d.response||d.data?.attributes||{};
    return res.status(200).json({status:a.status||d.status,url:a.url||d.url||null});
  }catch(e){return res.status(500).json({error:e.message||'Render status failed'})}
}