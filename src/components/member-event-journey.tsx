'use client';
import {useEffect,useState} from 'react';
import {api} from './operations-client';
export type EventJourney={attendanceCount:number;badges:{id:string;name:string;description:string;icon:string}[];resources:{id:string;event_id:string;title:string;description:string;type:string}[]};
export function MemberEventJourney() {
 const [journey,setJourney]=useState<EventJourney|null>(null),[error,setError]=useState('');
 useEffect(()=>{api<EventJourney>('/api/member/event-journey').then(setJourney).catch(e=>setError(e.message));},[]);
 return <section className="content-section"><h2>Your Event Journey</h2>{journey?<><p>Events attended: <strong>{journey.attendanceCount}</strong></p><h3>Attendance milestone badges</h3>{journey.badges.length?journey.badges.map(b=><p key={b.id}><span aria-hidden="true">{({medal:'🏅',star:'⭐',trophy:'🏆'})[b.icon as 'medal']}</span> <strong>{b.name}</strong> · {b.description}</p>):<p>No milestone badges are currently earned or enabled. Individual event attendance badges appear in your event history.</p>}<h3>Unlocked resources</h3>{journey.resources.length?journey.resources.map(r=><p key={r.id}><a href={`/api/event-assets/${r.id}`}>{r.title}</a> · {r.type.replaceAll('_',' ')}{r.description?' · '+r.description:''} <a href={`/member/events?eventId=${r.event_id}`}>View event →</a></p>):<p>No published resources are currently available to you.</p>}</>:<p aria-live="polite">{error||'Loading your event journey…'}</p>}</section>;
}
