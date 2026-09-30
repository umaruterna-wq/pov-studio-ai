export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const key=process.env.SHOTSTACK_API_KEY;
    const geminiKey=process.env.GEMINI_API_KEY;
    const {videoUri}=req.body||{};
    if(!key)return res.status(500).json({error:'SHOTSTACK_API_KEY is not configured'});
    if(!geminiKey)return res.status(500).json({error:'GEMINI_API_KEY is not configured'});
    if(!videoUri)return res.status(400).json({error:'Missing videoUri'});

    const source=await fetch(videoUri,{headers:{'x-goog-api-key':geminiKey}});
    if(!source.ok)return res.status(source.status).json({error:'Could not download the generated Veo video'});
    const contentType=source.headers.get('content-type')||'video/mp4';
    const bytes=await source.arrayBuffer();

    const signed=await fetch('https://api.shotstack.io/ingest/v1/upload',{
      method:'POST',
      headers:{'Accept':'application/json','x-api-key':key}
    });
    const sd=await signed.json();
    if(!signed.ok)return res.status(signed.status).json({error:sd.errors?.[0]?.detail||sd.message||'Could not get Shotstack upload URL'});
    const upload=sd.data?.attributes;
    if(!upload?.url||!upload?.id)return res.status(500).json({error:'Shotstack did not return an upload URL'});

    const put=await fetch(upload.url,{method:'PUT',headers:{'Content-Type':contentType},body:bytes});
    if(!put.ok)return res.status(put.status).json({error:'Shotstack upload failed'});
    return res.status(200).json({sourceId:upload.id});
  }catch(e){return res.status(500).json({error:e.message||'Ingest failed'})}
}