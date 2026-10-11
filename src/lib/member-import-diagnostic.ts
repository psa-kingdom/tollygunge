import 'server-only';
import {isDeepStrictEqual} from 'node:util';
import type {Pool,PoolClient} from 'pg';
import {mapMembers,type MemberRow} from '@/domain/member-import';
import {clean,prefix,email,mobile,country,internationalPostalCode,membershipKey,memberInput,MemberValidationError} from '@/domain/member-foundation';
import {matchCandidates,matchMember,memberFromBody} from './member-register';
import {importUpdate} from './member-import';
import {OperationError} from './operation-error';
type DB=Pick<Pool|PoolClient,'query'>;
export type ImportIssue={code:string;field:string;severity:'invalid'|'conflict'|'blocked'|'warning';reason:string;relatedRows?:number[]};
export type DiagnosticRow={sourceRow:number;source:Record<string,string>;normalized:Record<string,string>;issues:ImportIssue[];status:'valid'|'conflict'|'invalid';action:string;normalizations:MemberRow['normalizations'];matchedRecord?:{personId:string;personVersion:number;membershipVersion:number}};
export async function diagnoseMembers(db:DB,cells:string[][],sourceRows?:number[],cellErrors?:Record<number,string>) {
 const mapped=mapMembers(cells,sourceRows,cellErrors),rows:DiagnosticRow[]=[],inputs=[];
 const version=(await db.query('SELECT id FROM tpa.postal_versions WHERE active')).rows[0];
 const pins=mapped.map(r=>r.source.Pin.trim()).filter(p=>/^[1-9]\d{5}$/.test(p));
 const postal=version?(await db.query('SELECT pin,state,district,locality FROM tpa.postal_locations WHERE version_id=$1 AND pin=ANY($2::text[])',[version.id,pins])).rows:[];
 const aliases=version?(await db.query('SELECT state,district,alias,city FROM tpa.postal_city_aliases WHERE version_id=$1',[version.id])).rows:[];
 for(const original of mapped){const row:DiagnosticRow={sourceRow:original.sourceRow,source:original.source,normalized:{},issues:[],status:'valid',action:'Review before importing.',normalizations:[]};
  const add=(code:string,field:string,reason:string,severity:ImportIssue['severity']='invalid')=>row.issues.push({code,field,reason,severity});
  const field=(header:string,code:string,normalize:(v:string)=>string,required=false)=>{const raw=original.source[header]??'';
   if(required && !raw.trim()){add('missing_'+code,header,'Supply the missing required value.');return;}
   try{row.normalized[header]=normalize(raw);if(raw!==row.normalized[header]) row.normalizations.push({field:header,before:raw,after:row.normalized[header]});}
   catch(e){add(code==='prefix'?'unsupported_value':'malformed_'+code,header,e instanceof MemberValidationError?Object.values(e.fieldErrors).join(' '):'Unsupported value.');}
  };
  field('Prefix','prefix',prefix);field('First Name','name',v=>clean(v,'firstName',120),true);field('Last Name','name',v=>clean(v,'lastName',120),true);
  field('Email','email',v=>email(v,true),true);field('Mobile','mobile',mobile);field('Membership No.','membership_number',v=>clean(v,'membershipNumber',80),true);
  field('Designation','designation',v=>clean(v,'designation',120));field('Organisation','organization',v=>clean(v,'organization',200));
  for(const h of ['Address','State','District','City','Postal Locality','Pin']) field(h,h==='Pin'?'pin':'address',v=>clean(v,h,h==='Address'?1000:200));
  field('Country','country',country);
  if((row.normalized['First Name']??'').length+(row.normalized['Last Name']??'').length+1>120) add('malformed_name','First Name','Combined names exceed the supported display-name length.');
  const n=row.normalized,present=['Address','Country','State','District','City','Postal Locality','Pin'].some(h=>(original.source[h]??'').trim());
  if(present){for(const h of ['Address','Country','Pin']) if(!n[h]) add('address_completeness',h,'Complete line 1, country and postal code.');
   if(n.Country==='IN'){
    if(n.Pin && !/^[1-9]\d{5}$/.test(n.Pin)) add('malformed_pin','Pin','Use a six-digit Indian PIN.');
    if(!n.District) add('missing_district','District','Supply an authoritative district; no derivation is permitted.','conflict');
    if(!version) add('postal_reference_unavailable','Pin','Postal checks require provisioned local reference data.','blocked');
    else if(/^[1-9]\d{5}$/.test(n.Pin??'')){
     let matches=postal.filter(p=>p.pin===n.Pin);
     if(!matches.length) add('invalid_pin','Pin','PIN does not occur in the reference snapshot.');
     if(n.State){const valid=matches.filter(p=>p.state.toLowerCase()===n.State.toLowerCase());if(matches.length && !valid.length) add('postal_contradiction','State','Supplied state contradicts the PIN reference.');matches=valid;}
     if(n.District){const valid=matches.filter(p=>p.district.toLowerCase()===n.District.toLowerCase());if(matches.length && !valid.length) add('postal_contradiction','District','Supplied district contradicts the PIN reference.');matches=valid;}
     const districts=[...new Set(matches.map(p=>p.district))];
     if(!n.District && districts.length>1) add('postal_ambiguity','District','PIN has multiple matching districts.');
     if(!n.State && new Set(matches.map(p=>p.state)).size>1) add('postal_ambiguity','State','PIN has multiple matching states.');
     if(n['Postal Locality'] && matches.length && !matches.some(p=>p.locality.toLowerCase()===n['Postal Locality'].toLowerCase())) add('postal_contradiction','Postal Locality','Supplied locality contradicts the PIN hierarchy.');
     if(n.City){const contexts=matches.filter(p=>aliases.some(a=>a.state.toLowerCase()===p.state.toLowerCase() && a.district.toLowerCase()===p.district.toLowerCase() && a.alias.toLowerCase()===n.City.toLowerCase()));
      if(matches.length && !contexts.length) add('unsupported_reference_value','City','City is not covered by a reviewed alias in the PIN administrative context; this does not prove the source city is wrong.');
      else if(!matches.length) add('dependent_check_blocked','City','Resolve PIN/state/district contradictions before checking the city.','blocked');
     }
    }else add('dependent_check_blocked','State / District / City','Correct or supply the PIN before checking the postal hierarchy.','blocked');
   }else if(n.Country){if(!n.City) add('address_completeness','City','Supply the international city.');if(n.Pin && !internationalPostalCode(n.Country,n.Pin)) add('malformed_pin','Pin','Postal format does not match the selected country.');}
  }
  for(const [key,reason] of Object.entries(original.fieldErrors)){if(key==='file' || reason.includes('Formula')) add('unsafe_spreadsheet_cell',key,reason);
   else if(reason.startsWith('Duplicate')){const membership=key==='membershipNumber';const value=membership?membershipKey(original.membershipNumber):original.email;
    row.issues.push({code:membership?'duplicate_membership_number':'duplicate_email',field:key,severity:'conflict',reason,relatedRows:mapped.filter(r=>(membership?membershipKey(r.membershipNumber):r.email)===value).map(r=>r.sourceRow)});}
  }
  try{const input=memberInput({prefix:n.Prefix,firstName:n['First Name'],lastName:n['Last Name'],email:n.Email,mobile:n.Mobile,membershipNumber:n['Membership No.'],designation:n.Designation,organization:n.Organisation,addresses:{}});inputs.push({row,input});}
  catch(e){if(e instanceof MemberValidationError) for(const [field,reason] of Object.entries(e.fieldErrors)) {
   const header=({firstName:'First Name',lastName:'Last Name',membershipNumber:'Membership No.',email:'Email',mobile:'Mobile',prefix:'Prefix',designation:'Designation',organization:'Organisation'} as Record<string,string>)[field]??field;
   if(!row.issues.some(i=>i.field===header)) add(field==='membershipNumber'?'malformed_membership_number':field==='firstName'?'malformed_name':'unsupported_value',header,reason);
  }else throw e;}
  rows.push(row);
 }
 const candidates=await matchCandidates(db,inputs.map(x=>x.input));
 const accounts=(await db.query('SELECT email FROM public."user" WHERE lower(btrim(email))=ANY($1::text[])',[inputs.map(x=>x.input.email)])).rows;
 for(const {row,input} of inputs){try{const match=await matchMember(db,input,candidates);if(match) {row.matchedRecord={personId:match.personId,personVersion:match.personVersion,membershipVersion:match.membershipVersion};
  const previous=memberFromBody(match.body,String(match.membership.membership_number));
  if(!isDeepStrictEqual(previous,importUpdate(previous,input))) row.issues.push({code:'database_identity_conflict',field:'Existing record',severity:'conflict',reason:'Existing member fields differ; explicit administrator review is required before any correction.'});
 }
  else if(accounts.some(a=>a.email.trim().toLowerCase()===input.email)) throw new OperationError('Existing account requires explicit staff identity linking.',409,'identity_conflict');
 }catch(e){if(e instanceof OperationError && e.status===409) row.issues.push({code:'database_identity_conflict',field:'Email / Membership No.',severity:'conflict',reason:e.message});else throw e;}}
 for(const row of rows){row.status=row.issues.some(i=>['duplicate_email','duplicate_membership_number','database_identity_conflict'].includes(i.code))?'conflict':row.issues.some(i=>['invalid','blocked'].includes(i.severity))?'invalid':row.issues.some(i=>i.severity==='conflict')?'conflict':'valid';row.action=row.status==='valid'?'Review the exact preview before importing.':'Correct authoritative source facts and revalidate; no automatic merge or overwrite.';}
 return {source:rows.length,valid:rows.filter(r=>r.status==='valid').length,conflict:rows.filter(r=>r.status==='conflict').length,invalid:rows.filter(r=>r.status==='invalid').length,rows,
  issues:Object.fromEntries([...new Set(rows.flatMap(r=>r.issues.map(i=>i.code)))].map(code=>[code,rows.filter(r=>r.issues.some(i=>i.code===code)).length]))};
}
