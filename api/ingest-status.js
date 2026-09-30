export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  try{
    const key=process.env.SHOTSTACK_API_KEY, id=req.query?.id;
    if(!key)return res.status(500).json({error:'SHOTSTACK_API_KEY is not configured'});
    if(!id)return res.status(400).json({error:'Missing source id'});
    const r=await fetch('https://api.shotstack.io/ingest/v1/sources/'+encodeURIComponent(id),{headers:{'Accept':'application/json','x-api-key':key}});
    const d=await r.json();
    if(!r.ok)return res.status(r.status).json({error:d.errors?.[0]?.detail||d.message||'Ingest status failed'});
    const a=d.data?.attributes||{};
    const rendition=a.outputs?.renditions?.find(x=>x.status==='ready');
    return res.status(200).json({status:a.status,url:rendition?.url||a.source||null,duration:a.duration||8});
  }catch(e){return res.status(500).json({error:e.message||'Ingest status failed'})}
}