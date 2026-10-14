import test from 'node:test';
import assert from 'node:assert/strict';
import {eventStage,moneyInput,recordingUrl} from '../src/domain/event-operations';
const event={status:'published',starts_at:'2026-10-12T10:00:00Z',ends_at:'2026-10-12T11:00:00Z'};
test('operational lifecycle status prioritizes recorded completion and archive',()=>{
 const now=Date.parse('2026-10-12T09:00:00Z');
 assert.equal(eventStage(event,now),'Registration open');
 assert.equal(eventStage({...event,booking_closed:true},now),'Registration closed');
 assert.equal(eventStage({...event,registration_starts_at:'2026-10-12T09:30:00Z'},now),'Scheduled');
 assert.equal(eventStage(event,Date.parse('2026-10-12T10:30:00Z')),'Live');
 assert.equal(eventStage(event,Date.parse('2026-10-12T12:00:00Z')),'Past');
 assert.equal(eventStage({...event,completed_at:'2026-10-12T11:10:00Z'},now),'Completed');
 assert.equal(eventStage({...event,completed_at:'2026-10-12T11:10:00Z',archived_at:'2026-10-12T11:20:00Z'},now),'Archived');
 assert.equal(eventStage({...event,status:'cancelled'},now),'Cancelled');
});
test('expense amounts retain paise and reject fractional, malformed and excessive values',()=>{
 assert.equal(moneyInput(12345),12345);
 for(const value of [0,-1,1.2,'12345',NaN,Infinity,100000001,null]) assert.throws(()=>moneyInput(value));
});
test('event recording links reject unsafe schemes and embedded credentials',()=>{
 assert.equal(recordingUrl('https://example.invalid/recording'),'https://example.invalid/recording');
 for(const value of ['javascript:alert(1)','http://example.invalid','https://user:password@example.invalid','file:///tmp/private']) assert.throws(()=>recordingUrl(value));
});
