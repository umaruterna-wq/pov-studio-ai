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
    if(!key) return res.status(500).json({error:'Gemini server connection is unavailable. Configure GEMINI_API_KEY in the Vercel Production environment.'});

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

Clearly separate facts from fictional POV/recreations. Never present generated footage as real evidence.
Return a complete production package with:
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

    // Gemini currently rejects combining Google Search grounding with JSON response
    // formatting on this model. Research and structured generation are therefore
    // performed as two calls.
    const researchPrompt=`Research the following YouTube video topic using Google Search grounding. Give concise, useful factual notes, source titles and URLs when available, and clearly flag uncertain or disputed claims. Do not write the final script.
TOPIC: ${idea}`;

    const rg=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({
        contents:[{parts:[{text:researchPrompt}]}],
        tools:[{google_search:{}}],
        generationConfig:{temperature:.2}
      })
    });
    const rd=await rg.json();
    if(!rg.ok)return res.status(rg.status).json({error:rd.error?.message||'Gemini research failed'});
    const research=rd.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'No research was returned.';

    const finalPrompt=prompt+`

RESEARCH NOTES FROM A SEPARATE GROUNDED SEARCH:
${research}

Use those research notes when appropriate. Do not invent sources. Return ONLY valid JSON with exactly these top-level keys:
research, script, storyboard, visuals, voiceover, editing, captions, thumbnail, seo.
The research field should summarize the supplied research notes.`;

    const schema={
      type:'OBJECT',
      properties:{
        research:{type:'OBJECT',additionalProperties:true},
        script:{type:'OBJECT',additionalProperties:true},
        storyboard:{type:'ARRAY',items:{type:'OBJECT',additionalProperties:true}},
        visuals:{type:'ARRAY',items:{type:'OBJECT',additionalProperties:true}},
        voiceover:{type:'OBJECT',additionalProperties:true},
        editing:{type:'OBJECT',additionalProperties:true},
        captions:{type:'OBJECT',additionalProperties:true},
        thumbnail:{type:'OBJECT',additionalProperties:true},
        seo:{type:'OBJECT',additionalProperties:true}
      },
      required:['research','script','storyboard','visuals','voiceover','editing','captions','thumbnail','seo']
    };
    const g=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({
        contents:[{parts:[{text:finalPrompt}]}],
        generationConfig:{
          responseMimeType:'application/json',
          responseSchema:schema,
          temperature:.5
        }
      })
    });
    const gd=await g.json();
    if(!g.ok)return res.status(g.status).json({error:gd.error?.message||'Gemini generation failed'});
    const raw=gd.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    let clean=raw.replace(/^\`\`\`json|^\`\`\`|\`\`\`$/g,'').trim();
    // Be tolerant of harmless text or a second JSON fragment after the main object.
    function extractFirstJsonObject(s){
      const start=s.indexOf('{');
      if(start<0) throw new Error('Gemini returned no JSON object.');
      let depth=0,inString=false,escaped=false;
      for(let i=start;i<s.length;i++){
        const ch=s[i];
        if(inString){
          if(escaped) escaped=false;
          else if(ch==='\\\\') escaped=true;
          else if(ch==='"') inString=false;
        }else{
          if(ch==='"') inString=true;
          else if(ch==='{') depth++;
          else if(ch==='}' && --depth===0) return s.slice(start,i+1);
        }
      }
      throw new Error('Gemini returned incomplete JSON.');
    }
    const project=JSON.parse(extractFirstJsonObject(clean));
    return res.status(200).json({
      project,
      grounding:rd.candidates?.[0]?.groundingMetadata||null
    });
  }catch(e){
    return res.status(500).json({error:e.message||'Server error'});
  }
}