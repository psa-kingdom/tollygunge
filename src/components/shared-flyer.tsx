'use client';
import { useEffect,useState } from 'react';
import Image from 'next/image';
import { renderFlyer,type FlyerEvent } from '@/lib/flyer-canvas';
import { eventLink,type Speaker } from '@/domain/event-flow';
export function SharedFlyer({event,headline,presentation}:{event:FlyerEvent&{speakers:Speaker[]};headline:string;presentation:{accent:string}}) {
 const [image,setImage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;renderFlyer(event,event.speakers,eventLink(location.origin,event),{headline,accent:presentation.accent}).then(value=>{if(active)setImage(value);}).catch(()=>{if(active)setError('Flyer preview unavailable. Open the event for current details.');});return()=>{active=false;};},[event,headline,presentation]);
 return <section><h1>{event.title}</h1>{image?<Image className="flyer-preview" src={image} alt={`${event.title} event flyer`} width={1080} height={1350} unoptimized/>:<p role="status">{error||'Preparing current event flyer…'}</p>}</section>;
}
