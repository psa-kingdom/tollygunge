import { notFound } from 'next/navigation';
import { currentActor } from '@/lib/actor';
import { getDatabase } from '@/lib/database';
import { activeEventMember } from '@/lib/event-engagement';
import { uuid } from '@/domain/operations';
import { eventLink } from '@/domain/event-flow';
import { SiteShell } from '@/components/site-shell';
import { SharedFlyer } from '@/components/shared-flyer';
export const dynamic='force-dynamic';
export const metadata={title:'TPA event flyer',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 let id;try{id=uuid((await params).id);}catch{notFound();}
 const db=getDatabase();
 const row=(await db.query(`SELECT f.id,f.headline,f.presentation,e.* FROM tpa.flyer_variants f JOIN tpa.events e ON e.id=f.event_id WHERE f.id=$1 AND f.status='published' AND e.status='published'`,[id])).rows[0];
 if(!row) notFound();
 if(row.visibility==='members') {const actor=await currentActor();if(!actor||!await activeEventMember(db,actor.id)) notFound();}
 return <SiteShell><main id="main" className="page-content"><SharedFlyer event={JSON.parse(JSON.stringify(row))} headline={row.headline} presentation={row.presentation}/><a className="button" href={eventLink('',row)}>View event and registration →</a></main></SiteShell>;
}
