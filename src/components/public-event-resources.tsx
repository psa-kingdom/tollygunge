import {getDatabase} from '@/lib/database';
export async function PublicEventResources({eventId}:{eventId:string}) {
 const resources=(await getDatabase().query(`SELECT a.id,a.title,a.description FROM tpa.event_assets a JOIN tpa.events e ON e.id=a.event_id WHERE a.event_id=$1 AND a.status='published' AND a.eligibility='public' AND e.visibility='public' AND e.status='published' ORDER BY a.uploaded_at DESC`,[eventId])).rows;
 if(!resources.length)return null;
 return <section className="content-section"><h2>Event resources</h2>{resources.map(r=><p key={r.id}><a href={`/api/event-assets/${r.id}`}>{r.title}</a>{r.description?' · '+r.description:''}</p>)}</section>;
}
