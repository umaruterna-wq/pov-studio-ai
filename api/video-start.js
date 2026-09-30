export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const b=req.body||{}, key=process.env.GEMINI_API_KEY||b.apiKey;
    if(!key)return res.status(500).json({error:'No Gemini connection is configured. Save a Gemini API key in Backup AI first.'});
    if(!b.prompt)return res.status(400).json({error:'Missing prompt'});
    const model=b.model||'veo-3.1-fast-generate-preview';
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':predictLongRunning',{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({instances:[{prompt:b.prompt}],parameters:{aspectRatio:b.aspectRatio||'16:9',resolution:b.resolution||'720p',numberOfVideos:1}})
    });
    const d=await r.json();if(!r.ok)return res.status(r.status).json({error:d.error?.message||'Veo request failed'});
    return res.status(200).json({operation:d.name});
  }catch(e){return res.status(500).json({error:e.message||'Video generation failed'})}
}