export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({error:'GET only'});
  try{
    const key=process.env.GEMINI_API_KEY||req.query?.apiKey, op=req.query?.operation;
    if(!key)return res.status(500).json({error:'No Gemini connection is configured. Save a Gemini API key in Backup AI first.'});
    if(!op)return res.status(400).json({error:'Missing operation'});
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/'+op,{headers:{'x-goog-api-key':key}});
    const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d.error?.message||'Operation lookup failed'});
    return res.status(200).json(d);
  }catch(e){return res.status(500).json({error:e.message||'Status failed'})}
}