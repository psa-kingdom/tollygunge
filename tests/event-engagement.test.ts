import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPromotion,promotionInput,canAccessAsset,variantInput,badgeInput,assetInput,eventResourceUrl} from '../src/domain/event-engagement';
import {speakersInput} from '../src/domain/event-flow';
import {promotionWindow,promotionReview,verifyPromotionReview} from '../src/lib/event-promotion';
test('structured speakers preserve legacy shape and validate professional fields',()=>{
 assert.deepEqual(speakersInput([{name:'Legacy speaker',credentials:'CA'}]),[{name:'Legacy speaker',credentials:'CA'}]);
 assert.equal(speakersInput([{name:'Speaker',credentials:'CA',designation:'Director',organization:'TPA',description:'Professional educator'}])[0].organization,'TPA');
 for(const change of [{description:'x'.repeat(501)},{organization:42},{designation:'Bad\nTitle'}])assert.throws(()=>speakersInput([{name:'Speaker',...change}]));
});
test('promotion is opt-in and validates timing and capacity',()=>{
 assert.ok(!defaultPromotion.registration_open&&!defaultPromotion.upcoming);
 assert.deepEqual(promotionInput(defaultPromotion),defaultPromotion);
 for(const change of [{capacityPercent:100},{finalMinutes:14},{upcoming:'true'}])assert.throws(()=>promotionInput({...defaultPromotion,...change}));
});
test('promotion uses booking windows, capacity and bounded catch-up instead of frontend timers',()=>{
 const now=new Date('2026-12-12T12:00:00Z'),e={id:'test',version:1,status:'published',title:'Event',visibility:'public',starts_at:new Date(now.getTime()+3600000),registration_starts_at:null,registration_ends_at:null,capacity:10,location:'Hall',fee_paise:0,created_at:now};
 const s={...defaultPromotion,registration_open:true,capacity_pressure:true,final_reminder:true,upcoming:true,finalMinutes:60,upcomingMinutes:60};
 assert.ok(promotionWindow(e,s,'registration_open',0,now,now));
 assert.equal(promotionWindow(e,s,'capacity_pressure',7,now,now),null);
 assert.ok(promotionWindow(e,s,'capacity_pressure',8,now,now));
 assert.equal(promotionWindow(e,s,'capacity_pressure',10,now,now),null);
 assert.equal(promotionWindow({...e,booking_closed:true},s,'upcoming',0,now,now),null);
 assert.equal(promotionWindow({...e,status:'cancelled'},s,'upcoming',0,now,now),null);
 assert.ok(promotionWindow(e,s,'final_reminder',0,new Date(now.getTime()+15*60000-1),now));
 assert.equal(promotionWindow(e,s,'final_reminder',0,new Date(now.getTime()+15*60000+1),now),null);
});
test('resource rules distinguish members, registrations, actual attendance and finance',()=>{
 const empty={signedIn:false,activeMember:false,confirmed:false,attended:false,selected:false};
 assert.ok(canAccessAsset('public',empty));
 for(const eligibility of ['members','confirmed','attended','selected','finance'] as const)assert.equal(canAccessAsset(eligibility,empty),false);
 assert.equal(canAccessAsset('attended',{...empty,signedIn:true,confirmed:true}),false);
 assert.ok(canAccessAsset('attended',{...empty,signedIn:true,attended:true}));
 assert.equal(canAccessAsset('finance',{...empty,signedIn:true,activeMember:true,attended:true}),false);
 assert.throws(()=>assetInput({title:'Notes',type:'notes',status:'published',eligibility:'selected',selectedMembers:[]}));
 assert.throws(()=>eventResourceUrl('javascript:alert(1)'));
 assert.throws(()=>eventResourceUrl('https://user:pass@example.invalid/recording'));
});
test('variant presentation excludes event fact copies and badges require explicit configuration',()=>{
 const variant=variantInput({name:'Last day',headline:'Register today',presentation:{accent:'gold'},status:'draft',title:'Copied event title',feePaise:1});
 assert.equal('title' in variant,false);assert.equal('feePaise' in variant,false);
 assert.throws(()=>badgeInput({name:'Badge',threshold:0,icon:'medal',enabled:true}));
 assert.throws(()=>badgeInput({name:'Badge',threshold:5,icon:'medal',enabled:'true'}));
});
test('promotion approval binds reviewed recipients, actor, event and saved settings',()=>{
 const context={eventId:'event',eventVersion:3,settingsVersion:2,actor:'admin'},recipients=[{id:'member',email:'member@example.invalid'}],secret='synthetic-review-secret';
 const token=promotionReview(recipients,context,secret);
 assert.doesNotThrow(()=>verifyPromotionReview(token,recipients,context,secret));
 for(const change of [{actor:'other'},{eventVersion:4},{settingsVersion:3}])assert.throws(()=>verifyPromotionReview(token,recipients,{...context,...change},secret));
 assert.throws(()=>verifyPromotionReview(token,[],context,secret));
 assert.throws(()=>verifyPromotionReview(token+'tampered',recipients,context,secret));
});
