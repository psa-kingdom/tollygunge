"use client";
import {useEffect,useState,useId} from 'react';
import {api} from './operations-client';
import {invitationDefaults} from '@/domain/invitation-template';
type Template={id:string;subject:string;body:string;approved_at:string|null};
type State={revision:number;latest_id:string|null;approved_id:string|null;templates:Template[]};
export function InvitationTemplateEditor({onDirtyChange}:{onDirtyChange?:(dirty:boolean)=>void}){
 const formId=useId();
 const [state,setState]=useState<State>(),[form,setForm]=useState(invitationDefaults),[saved,setSaved]=useState(invitationDefaults),[preview,setPreview]=useState<{subject:string;text:string;html:string}>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const dirty=form.subject!==saved.subject || form.body!==saved.body;
 useEffect(()=>{onDirtyChange?.(dirty);},[dirty,onDirtyChange]);
 function apply(data:State){setState(data);const latest=data.templates.find(t=>t.id===data.latest_id)??invitationDefaults;setForm({subject:latest.subject,body:latest.body});setSaved({subject:latest.subject,body:latest.body});setPreview(undefined);}
 useEffect(()=>{api<State>('/api/staff/invitation-templates').then(apply).catch(e=>setMessage(e.message));},[]);
 async function action(name:string){setBusy(true);try{
  if(name==='preview'){setPreview(await api('/api/staff/invitation-templates',{action:name,...form}));setMessage('Preview only. No email sent.');}
  else{apply(await api<State>('/api/staff/invitation-templates',{action:name,...form,revision:state?.revision,id:state?.latest_id}));setMessage(name==='save'?'New draft saved. Invitation sending is blocked until approval.':'Template approved. No invitations were sent.');}
 }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section><h2>Member invitation template</h2><p>Configure the single email used to set an account password. Template approval sends nothing; recipients are reviewed separately.</p>
 <p role="status">{state?.approved_id?'Approved template ready for recipient review.':'Invitations held: no approved template.'} {message}</p>
 <fieldset className="plain-fieldset"><legend>Invitation message</legend>
 <label htmlFor={formId+'-subject'}>Invitation subject</label><input id={formId+'-subject'} style={{width:'100%'}} disabled={busy || !state} value={form.subject} maxLength={200} onChange={e=>{setForm({...form,subject:e.target.value});setPreview(undefined);}} />
 <label htmlFor={formId+'-body'}>Invitation body</label><textarea id={formId+'-body'} style={{width:'100%'}} disabled={busy || !state} rows={12} value={form.body} maxLength={12000} onChange={e=>{setForm({...form,body:e.target.value});setPreview(undefined);}} />
 </fieldset>
 <p>Supported placeholders: {'{{member_name}}, {{association_name}}, {{setup_link}}, {{expiry}}'}. Include one setup link and the expiry in the body.</p>
 <div className="action-row"><button className="button secondary" disabled={busy} onClick={()=>void action('preview')}>Preview invitation email</button><button className="button" disabled={busy || !state || (!dirty && !!state.latest_id)} onClick={()=>void action('save')}>Save invitation draft</button><button className="button secondary" disabled={busy || !state?.latest_id || dirty || !preview || state.approved_id===state.latest_id} onClick={()=>void action('approve')}>Approve invitation template</button></div>
 {preview&&<div><h3>{preview.subject}</h3><iframe title="Invitation email preview" sandbox="" srcDoc={preview.html} style={{width:'100%',height:420,border:'1px solid #ddd'}} /></div>}</section>;
}
