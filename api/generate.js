export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const body=req.body||{};
    const {idea,duration='10 minutes',voice='Deep Male',voiceStyle='Deadpan',visualStyle='Deadpan Flat Cartoon',perspective='Second-Person POV',direction='Real-Insert Explainer',captions='Deadpan Subtitle Sans',reference=''}=body;
    if(!idea) return res.status(400).json({error:'Missing idea'});
    const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if(!key) return res.status(500).json({error:'Gemini server connection is unavailable. Use the Backup AI connection in POVForge or configure GEMINI_API_KEY in the Vercel Production environment.'});
    const prompt=`You are POVForge AI, an expert faceless YouTube producer.
Create an original, research-aware production package for this video:
IDEA: ${idea}
DURATION: ${duration}
VOICE: ${voice}
VOICE STYLE: ${voiceStyle}
VISUAL STYLE: ${visualStyle}
NARRATIVE: ${perspective}
DIRECTION: ${direction}
CAPTIONS: ${captions}
REFERENCE: ${reference||'None'}

Use Google Search grounding for current factual claims. Clearly separate facts from fictional POV/recreations. Never present generated footage as real evidence. Return ONLY valid JSON with exactly:
research, script, storyboard, visuals, voiceover, editing, captions, thumbnail, seo.
Research: key factual points, source titles/URLs when available, and uncertainty notes.
Script: a strong hook, retention beats, pattern interrupts, and satisfying ending sized for the requested duration.
Storyboard: numbered scenes with timestamps, visual action, narration purpose and transitions.
Visuals: detailed image/video prompts, consistent world/characters, 16:9.
Voiceover: final narration plus delivery notes.
Editing: CapCut-friendly timeline, music, SFX, zooms, cuts, B-roll and real-insert placement.
Captions: exact caption style, timing approach and on-screen text rules.
Thumbnail: three concepts plus one final image prompt and overlay text.
SEO: five titles, description, tags, hashtags and pinned comment.`;
    const g=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],tools:[{google_search:{}}],generationConfig:{responseMimeType:'application/json',temperature:.7}})
    });
    const gd=await g.json();
    if(!g.ok)return res.status(g.status).json({error:gd.error?.message||'Gemini failed'});
    const raw=gd.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    let clean=raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/g,'').trim();
    const project=JSON.parse(clean);
    return res.status(200).json({project,grounding:gd.candidates?.[0]?.groundingMetadata||null});
  }catch(e){return res.status(500).json({error:e.message||'Server error'})}
}