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

    // No-Veo mode: Shotstack generates still images and narration directly,
    // then renders them into one MP4. This avoids Google Veo completely.
    if(b.noVeo){
      const scenes=Array.isArray(b.scenes)?b.scenes:[];
      const narration=String(b.narration||'').trim();
      if(!scenes.length)return res.status(400).json({error:'No scenes supplied for no-Veo mode'});
      if(!narration)return res.status(400).json({error:'No voiceover narration supplied for no-Veo mode'});

      const total=Math.max(30,Number(b.durationSeconds)||600);
      const perScene=Math.max(4,total/scenes.length);
      const imageClips=scenes.map((s,i)=>({
        asset:{
          type:'image',
          prompt:String(s.prompt||s.visual||s.description||('Cinematic scene '+(i+1)))+
            ' 16:9 YouTube visual, consistent visual identity, no text, no logos, high detail.',
          model:'flux-schnell',
          options:{aspectRatio:'16:9'}
        },
        start:i*perScene,
        length:perScene,
        fit:'cover',
        transition:{in:'fade',out:'fade'}
      }));

      const voiceMap={
        'Deep Male':'Matthew',
        'Calm Male':'Stephen',
        'Female':'Joanna',
        'Deadpan':'Joey'
      };
      const voice=voiceMap[b.voice]||'Matthew';

      const timeline={
        background:'#000000',
        tracks:[
          {clips:imageClips},
          {clips:[{
            asset:{
              type:'text-to-speech',
              text:narration,
              voice
            },
            start:0,
            length:'auto'
          }]}
        ]
      };

      const payload={
        timeline,
        output:b.output||{format:'mp4',resolution:'hd',aspectRatio:'16:9'}
      };
      const r=await fetch('https://api.shotstack.io/edit/v1/render',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':key},
        body:JSON.stringify(payload)
      });
      const d=await r.json();
      return res.status(r.status).json(d);
    }

    if(!b.timeline)return res.status(400).json({error:'Missing timeline'});
    const r=await fetch('https://api.shotstack.io/edit/v1/render',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key},
      body:JSON.stringify({timeline:b.timeline,output:b.output||{format:'mp4',resolution:'hd'}})
    });
    const d=await r.json();return res.status(r.status).json(d);
  }catch(e){return res.status(500).json({error:e.message||'Render request failed'})}
}