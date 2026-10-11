export const invitationDefaults={subject:'Your {{association_name}} account invitation',body:'Hello {{member_name}},\n\nYour account is ready. Use this secure link to set your password:\n{{setup_link}}\n\nThis single-use link expires in {{expiry}}. After activation, complete your profile and address details for review. Account activation does not verify your professional profile or approve payment.\n\n{{association_name}}'};
export type InvitationContent={subject:string;body:string};
const placeholders=['member_name','association_name','setup_link','expiry'];
export function validateInvitationTemplate(raw:Record<string,unknown>):InvitationContent {
 const subject=typeof raw.subject==='string'?raw.subject.trim():'',body=typeof raw.body==='string'?raw.body.trim():'';
 if(!subject || subject.length>200 || /[\r\n\x00-\x1f]/.test(subject))throw Error('Subject must contain 1–200 characters on one line.');
 if(!body || body.length>12000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body))throw Error('Body must contain 1–12,000 characters of plain text.');
 for(const text of [subject,body]){
  const stripped=text.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>{if(!placeholders.includes(key))throw Error('Unknown template placeholder: '+key);return '';});
  if(/[{}]/.test(stripped))throw Error('Use only the supported {{placeholder}} values.');
 }
 if(subject.includes('{{setup_link}}'))throw Error('Put the setup link in the body, not the subject.');
 if((body.match(/\{\{setup_link\}\}/g)??[]).length!==1 || !body.includes('{{expiry}}'))throw Error('Body must contain exactly one {{setup_link}} and an {{expiry}} placeholder.');
 return {subject,body};
}
export function renderInvitation(content:InvitationContent,name:string,url:string){
 const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))throw Error('Invalid invitation link.');
 const values:Record<string,string>={member_name:name.replace(/[\r\n]/g,' '),association_name:'Tollygunge Professional Association',setup_link:url,expiry:'48 hours'};
 const render=(s:string)=>s.replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>values[key]);
 const subject=render(content.subject),text=render(content.body);
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const htmlBody=escape(text).replace(escape(url),`<a href="${escape(url)}">Set your password</a>`).replace(/\n/g,'<br>');
 return {subject,text,html:`<!doctype html><html><body><main style="font-family:Arial,sans-serif;max-width:620px;margin:24px auto;padding:24px;color:#172b4d;border-top:4px solid #b9975b"><h2>Tollygunge Professional Association</h2><p>${htmlBody}</p></main></body></html>`};
}
