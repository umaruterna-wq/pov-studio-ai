export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  try{
    const key=process.env.SHOTSTACK_API_KEY;
    if(!key)return res.status(500).json({error:'SHOTSTACK_API_KEY is not configured in Vercel Production.'});
    const b=req.body||{};

    if(b.noVeo){
      const scenes=Array.isArray(b.scenes)?b.scenes:[];
      const narration=String(b.narration||'').trim();
      if(!scenes.length)return res.status(400).json({error:'No scenes supplied for no-Veo mode.'});
      if(!narration)return res.status(400).json({error:'No voiceover narration supplied for no-Veo mode.'});

      const total=Math.max(30,Number(b.durationSeconds)||600);
      const perScene=Math.max(4,total/scenes.length);
      const imageClips=scenes.map((s,i)=>({
        asset:{
          type:'image',
          prompt:String(s.prompt||s.visual||s.description||('Cinematic POV scene '+(i+1)))+' 16:9 YouTube visual, consistent visual identity, no text, no logos, high detail.',
          model:'flux-schnell',
          options:{resolution:'1K',aspectRatio:'16:9'}
        },
        start:i*perScene,
        length:perScene,
        fit:'cover',
        transition:{in:'fade',out:'fade'}
      }));

      const voiceMap={'Deep Male':'Matthew','Calm Male':'Stephen','Female':'Joanna','Deadpan':'Joey'};
      const voice=voiceMap[b.voice]||'Matthew';

      const timeline={
        background:'#000000',
        tracks:[
          {clips:imageClips},
          {clips:[{
            asset:{
              type:'audio',
              prompt:narration,
              model:'polly-neural',
              options:{voice}
            },
            start:0,
            length:'auto'
          }]}
        ]
      };

      const r=await fetch('https://api.shotstack.io/edit/v1/render',{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':key},
        body:JSON.stringify({timeline,output:b.output||{format:'mp4',resolution:'hd',aspectRatio:'16:9'}})
      });
      const d=await r.json();
      if(!r.ok){
        const detail=d?.errors?.map(x=>x.detail||x.message).filter(Boolean).join('; ');
        return res.status(r.status).json({error:detail||d.message||'Shotstack rejected the no-Veo render.'});
      }
      return res.status(r.status).json(d);
    }

    if(!b.timeline)return res.status(400).json({error:'Missing timeline'});
    const r=await fetch('https://api.shotstack.io/edit/v1/render',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':key},
      body:JSON.stringify({timeline:b.timeline,output:b.output||{format:'mp4',resolution:'hd'}})
    });
    const d=await r.json();
    return res.status(r.status).json(d);
  }catch(e){
    return res.status(500).json({error:e.message||'Render request failed'});
  }
}