import { record, text } from './operations';
export const promotionKinds = ['registration_open','capacity_pressure','final_reminder','upcoming'] as const;
export type PromotionKind = typeof promotionKinds[number];
export type PromotionSettings = Record<PromotionKind, boolean> & { capacityPercent: number; finalMinutes: number; upcomingMinutes: number };
export const defaultPromotion: PromotionSettings = { registration_open:false,capacity_pressure:false,final_reminder:false,upcoming:false,capacityPercent:80,finalMinutes:1440,upcomingMinutes:1440 };
export function promotionInput(value: unknown): PromotionSettings {
 const v=record(value);
 for(const key of promotionKinds) if(typeof v[key]!=='boolean') throw Error('Choose promotion settings.');
 for(const [key,min,max] of [['capacityPercent',1,99],['finalMinutes',15,10080],['upcomingMinutes',15,10080]] as const)
  if(!Number.isInteger(v[key]) || Number(v[key])<min || Number(v[key])>max) throw Error('Check promotion timing and capacity threshold.');
 return Object.fromEntries([...promotionKinds,'capacityPercent','finalMinutes','upcomingMinutes'].map(key=>[key,v[key]])) as PromotionSettings;
}
export const assetEligibility = ['public','members','confirmed','attended','selected','finance'] as const;
export type AssetEligibility = typeof assetEligibility[number];
export function assetInput(value:unknown) {
 const v=record(value);
 if(!assetEligibility.includes(v.eligibility as AssetEligibility)) throw Error('Choose resource eligibility.');
 if(!['presentation','notes','certificate','photos','report','speaker_material','other'].includes(String(v.type))) throw Error('Choose resource type.');
 if(!['draft','published','archived'].includes(String(v.status))) throw Error('Choose publication state.');
 const selected=v.selectedMembers ?? [];
 if(!Array.isArray(selected) || selected.length>500 || selected.some(id=>typeof id!=='string' || !id.length || id.length>128)) throw Error('Choose up to 500 member accounts.');
 if(v.eligibility==='selected' && !selected.length) throw Error('Select at least one member.');
 return {title:text(v.title,'Title',120,2),description:text(v.description??'','Description',1000),type:String(v.type),status:String(v.status),eligibility:v.eligibility as AssetEligibility,selectedMembers:v.eligibility==='selected'?[...new Set(selected)] as string[]:[]};
}
export function badgeInput(value:unknown) {
 const v=record(value);
 if(!Number.isInteger(v.threshold)||Number(v.threshold)<1||Number(v.threshold)>10000||typeof v.enabled!=='boolean'||!['medal','star','trophy'].includes(String(v.icon))) throw Error('Check badge threshold, icon and enabled state.');
 return {name:text(v.name,'Badge name',80,2),description:text(v.description??'','Description',300),threshold:Number(v.threshold),icon:String(v.icon),enabled:v.enabled};
}
export function variantInput(value:unknown) {
 const v=record(value),p=record(v.presentation??{accent:'gold'});
 if(!['gold','navy'].includes(String(p.accent))||!['draft','published','archived'].includes(String(v.status))) throw Error('Choose flyer presentation and state.');
 return {name:text(v.name,'Variant name',80,2),headline:text(v.headline??'','Headline',60),presentation:{accent:String(p.accent)},status:String(v.status)};
}
export function canAccessAsset(eligibility:AssetEligibility, context:{signedIn:boolean;activeMember:boolean;confirmed:boolean;attended:boolean;selected:boolean}) {
 return eligibility==='public'||(context.signedIn && ({members:context.activeMember,confirmed:context.confirmed,attended:context.attended,selected:context.selected,public:true,finance:false}[eligibility]));
}
export function eventResourceUrl(value:unknown) {
 const url=new URL(text(value,'Recording URL',2000,8));
 if(url.protocol!=='https:'||url.username||url.password||url.hostname==='localhost'||/^127\.|^0\.|^169\.254\./.test(url.hostname)||url.hostname==='[::1]') throw Error('Use an HTTPS recording link without credentials.');
 return url.href;
}
