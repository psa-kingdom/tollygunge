'use client';
import {useEffect,useState} from 'react';
import {api} from './operations-client';
import {promotionKinds,type PromotionSettings} from '@/domain/event-engagement';
type Asset={id:string;event_id:string;title:string;description:string;type:string;eligibility:string;selected_members:string[];status:string;version:number;url?:string|null};
type Badge={id:string;name:string;description:string;threshold:number;icon:string;enabled:boolean;version:number};
type Promotion={version:number;settings:PromotionSettings;eligible:number;globallyEnabled:boolean;jobs:{id:string;kind:string;status:string;reason:string|null}[]};
type Review={eligible:number;sample:{name:string;email:string}[];messages:{kind:string;subject:string;body:string}[];reviewToken:string};
const emptyAsset={title:'',description:'',type:'presentation',eligibility:'attended',selectedMembers:[] as string[],status:'draft',url:''};
export function EventEngagementPanel({eventId,canPromote=false,canManageFinance=false}:{eventId:string;canPromote?:boolean;canManageFinance?:boolean}) {
 const [promotion,setPromotion]=useState<Promotion|null>(null),[assets,setAssets]=useState<Asset[]>([]),[members,setMembers]=useState<{id:string;name:string}[]>([]),[badges,setBadges]=useState<Badge[]>([]),[asset,setAsset]=useState<Asset|null>(null),[form,setForm]=useState(emptyAsset),[file,setFile]=useState<File|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [review,setReview]=useState<Review|null>(null);
 useEffect(()=>{let active=true;Promise.all([api<Promotion>(`/api/staff/event-promotions?eventId=${eventId}`),api<{assets:Asset[];members:{id:string;name:string}[]}>(`/api/staff/event-assets?eventId=${eventId}`),api<Badge[]>('/api/staff/event-badges')]).then(([p,a,b])=>{if(active){setPromotion(p);setAssets(a.assets);setMembers(a.members);setBadges(b);setAsset(null);setForm(emptyAsset);setFile(null);setReview(null);}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[eventId]);
 async function run(work:()=>Promise<void>){setBusy(true);setMessage('');try{await work();}catch(e){setMessage(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}}
 function editAsset(row:Asset|null){setAsset(row);setForm(row?{title:row.title,description:row.description,type:row.type,eligibility:row.eligibility,selectedMembers:row.selected_members,status:row.status,url:row.url??''}:emptyAsset);setFile(null);}
 return <section className="content-section event-engagement"><h3>Promotion and member resources</h3>
  {promotion&&<details><summary>Event promotion</summary><p>Eligible active members who have not registered: {promotion.eligible}. {promotion.globallyEnabled?'Promotion worker enabled.':'Promotion delivery paused globally.'} Existing attendee reminders remain separate.</p>
   <fieldset disabled={busy||!canPromote}><legend>Promotional messages</legend>{promotionKinds.map(kind=><label key={kind}><input type="checkbox" checked={promotion.settings[kind]} onChange={e=>setPromotion({...promotion,settings:{...promotion.settings,[kind]:e.target.checked}})}/>{({registration_open:'Registration open',capacity_pressure:'Seats filling',final_reminder:'Final registration reminder',upcoming:'Upcoming event'})[kind]}</label>)}
    <label>Seats filling threshold (%)<input type="number" min={1} max={99} value={promotion.settings.capacityPercent} onChange={e=>setPromotion({...promotion,settings:{...promotion.settings,capacityPercent:Number(e.target.value)}})}/></label>
    <label>Minutes before registration closes<input type="number" min={15} max={10080} value={promotion.settings.finalMinutes} onChange={e=>setPromotion({...promotion,settings:{...promotion.settings,finalMinutes:Number(e.target.value)}})}/></label>
    <label>Minutes before event starts<input type="number" min={15} max={10080} value={promotion.settings.upcomingMinutes} onChange={e=>setPromotion({...promotion,settings:{...promotion.settings,upcomingMinutes:Number(e.target.value)}})}/></label>
    <button type="button" className="button secondary" onClick={()=>void run(async()=>{await api('/api/staff/event-promotions',{eventId,version:promotion.version,settings:promotion.settings});setPromotion(await api(`/api/staff/event-promotions?eventId=${eventId}`));setReview(null);setMessage('Promotion settings saved. Review and approve the saved audience before scheduling.');})}>Save promotion settings</button>
    <button type="button" className="button secondary" onClick={()=>void run(async()=>{setReview(await api('/api/staff/event-promotions',{eventId,version:promotion.version,action:'review'}));})}>Review saved promotion</button>
   </fieldset>{!canPromote&&<p>Saving promotion requires event and communications permissions.</p>}
   {review&&<section className="notice"><h4>Review saved audience and messages</h4><p>{review.eligible} eligible members. Eligibility will be checked again at delivery.</p>{review.sample.map(p=><p key={p.email}>{p.name} · {p.email}</p>)}{review.messages.map(m=><div key={m.kind}><strong>{m.subject}</strong><p className="prose-text">{m.body}</p></div>)}<button type="button" className="button" disabled={busy||!canPromote} onClick={()=>void run(async()=>{await api('/api/staff/event-promotions',{eventId,version:promotion.version,action:'approve',reviewToken:review.reviewToken});setReview(null);setPromotion(await api(`/api/staff/event-promotions?eventId=${eventId}`));setMessage('Saved promotion approved. The global switch controls scheduling and delivery.');})}>Approve saved promotion schedule</button></section>}
   <button type="button" disabled={busy} className="button secondary" onClick={()=>void run(async()=>{setPromotion(await api(`/api/staff/event-promotions?eventId=${eventId}`));})}>Refresh audience and delivery</button>
   {promotion.jobs.map(job=><p key={job.id}>{job.kind.replaceAll('_',' ')} · {job.status}{job.reason?' · '+job.reason:''}</p>)}
  </details>}
  <details><summary>Event resources</summary><p>Files stay private in storage. Access is evaluated at each download.</p>
   <label>Resource<select value={asset?.id??''} disabled={busy} onChange={e=>editAsset(assets.find(a=>a.id===e.target.value)??null)}><option value="">New resource</option>{assets.map(a=><option key={a.id} value={a.id}>{a.title} · {a.status}</option>)}</select></label>
   <form onSubmit={e=>{e.preventDefault();void run(async()=>{
    const details={...form,eventId,id:asset?.id,version:asset?.version};let saved:Asset;
    if(asset) saved=await api('/api/staff/event-assets',details);
    else if(form.url) saved=await api('/api/staff/event-assets',details);
    else {if(!file)throw Error('Choose a file.');const data=new FormData();data.set('details',JSON.stringify(details));data.set('file',file);const response=await fetch('/api/staff/event-assets',{method:'POST',body:data});const value=await response.json();if(!response.ok)throw Error(value.error??'Upload failed.');saved=value;}
    setAssets((await api<{assets:Asset[]}>(`/api/staff/event-assets?eventId=${eventId}`)).assets);editAsset(saved);setMessage('Event resource saved.');
   });}}><fieldset disabled={busy}><legend>Resource details</legend>
    <label>Resource title<input required minLength={2} maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label>Description<textarea maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <label>Resource type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{['presentation','notes','certificate','photos','report','speaker_material','other'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</select></label>
    <label>Resource eligibility<select value={form.eligibility} onChange={e=>setForm({...form,eligibility:e.target.value})}>{[['public','Public'],['members','Active members'],['confirmed','Confirmed registrants'],['attended','Verified attendees'],['selected','Selected members'],...(canManageFinance?[['finance','Finance staff only']]:[])].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    {form.eligibility==='selected'&&<label>Selected members<select multiple value={form.selectedMembers} onChange={e=>setForm({...form,selectedMembers:Array.from(e.target.selectedOptions,o=>o.value)})}>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
    <label>Resource publication<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{['draft','published','archived'].map(status=><option key={status}>{status}</option>)}</select></label>
    {!asset&&<><label>HTTPS recording link (optional)<input type="url" value={form.url} onChange={e=>{setForm({...form,url:e.target.value});setFile(null);}}/></label>{!form.url&&<label>PDF, JPEG or PNG · up to 5 MB<input required type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}</>}
    <button className="button secondary">{asset?'Save resource':'Upload resource'}</button>
   </fieldset></form>{asset&&<a className="text-link" href={`/api/event-assets/${asset.id}`}>Download resource →</a>}
  </details>
  <details><summary>Attendance badge rules</summary><p>Rules apply across TPA events and count verified attendance only.</p>{badges.map(b=><form key={b.id} onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/api/staff/event-badges',b);setBadges(await api('/api/staff/event-badges'));setMessage('Badge rule saved.');});}}><fieldset disabled={busy}><legend>{b.name}</legend>
   <label>Badge name<input required maxLength={80} value={b.name} onChange={e=>setBadges(badges.map(r=>r.id===b.id?{...r,name:e.target.value}:r))}/></label>
   <label>Badge description<input maxLength={300} value={b.description} onChange={e=>setBadges(badges.map(r=>r.id===b.id?{...r,description:e.target.value}:r))}/></label>
   <label>Attendance threshold<input type="number" min={1} max={10000} value={b.threshold} onChange={e=>setBadges(badges.map(r=>r.id===b.id?{...r,threshold:Number(e.target.value)}:r))}/></label>
   <label>Badge icon<select value={b.icon} onChange={e=>setBadges(badges.map(r=>r.id===b.id?{...r,icon:e.target.value}:r))}>{['medal','star','trophy'].map(icon=><option key={icon}>{icon}</option>)}</select></label>
   <label><input type="checkbox" checked={b.enabled} onChange={e=>setBadges(badges.map(r=>r.id===b.id?{...r,enabled:e.target.checked}:r))}/>Enabled</label><button className="button secondary">Save badge rule</button>
  </fieldset></form>)}<button type="button" className="button secondary" disabled={busy} onClick={()=>void run(async()=>{await api('/api/staff/event-badges',{name:'New milestone',description:'',threshold:1,icon:'medal',enabled:false});setBadges(await api('/api/staff/event-badges'));})}>Add badge rule</button></details>
  <p aria-live="polite">{message}</p>
 </section>;
}
