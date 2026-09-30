// POV Studio AI production backend scaffold.
// Deploy this folder as a serverless Node function (Vercel/Netlify) with secrets stored as environment variables.
// Required env: GEMINI_API_KEY, SHOTSTACK_API_KEY.
// The public GitHub Pages site must never contain these secrets.

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {idea,duration='10 minutes',voice='Deep Male',voiceStyle='Deadpan',visualStyle='Deadpan Flat Cartoon',perspective='Second-Person POV',direction='Real-Insert Explainer',captions='Deadpan Subtitle Sans',assets=[]}=req.body||{};
    if(!idea) return res.status(400).json({error:'Missing idea'});
    if(!process.env.GEMINI_API_KEY) return res.status(500).json({error:'GEMINI_API_KEY is not configured on the server.'});
    const prompt=`You are POV Studio AI. Build a production-ready ${duration} YouTube video.
IDEA: ${idea}
VOICE: ${voice}; VOICE STYLE: ${voiceStyle}
VISUAL STYLE: ${visualStyle}
NARRATIVE: ${perspective}
DIRECTION: ${direction}
CAPTIONS: ${captions}
Return ONLY JSON with script, scenes, narration, captions, edit, thumbnail, seo.
For scenes provide duration, visualPrompt, transition, sfx and musicCue. Keep second-person narration and the selected style consistent.`;
    const g=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(process.env.GEMINI_API_KEY),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:.7}})
    });
    const gd=await g.json();
    if(!g.ok) return res.status(g.status).json({error:gd.error?.message||'Gemini failed'});
    const raw=gd.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    const project=JSON.parse(raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/g,'').trim());

    // If public media URLs are supplied, automatically assemble them in Shotstack.
    // The next production step is to have the worker generate/ingest Veo clips and narration,
    // then pass their URLs into this same renderer.
    if(process.env.SHOTSTACK_API_KEY && Array.isArray(assets) && assets.length){
      let t=0; const clips=assets.map((src,i)=>{
        const durationSec=Number(project.scenes?.[i]?.duration)||5;
        const clip={asset:{type:'video',src},start:t,length:durationSec,fit:'cover'};
        t+=durationSec; return clip;
      });
      const timeline={tracks:[{clips}]};
      const render=await fetch('https://api.shotstack.io/edit/v1/render',{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','x-api-key':process.env.SHOTSTACK_API_KEY},
        body:JSON.stringify({timeline,output:{format:'mp4',resolution:'hd',aspectRatio:'16:9'}})
      });
      const rd=await render.json();
      if(!render.ok) return res.status(render.status).json({project,error:rd.message||'Shotstack render failed'});
      return res.status(200).json({project,render:rd.response||rd});
    }
    return res.status(200).json({project,render:null,notice:'Blueprint created. Connect the Veo/media worker to render automatically.'});
  }catch(e){return res.status(500).json({error:e.message||'Server error'})}
}
