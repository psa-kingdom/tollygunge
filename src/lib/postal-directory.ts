/** Legacy verification-form adapter to the shared postal validation service. */
import type { PoolClient, Pool } from "pg";
import { addressKeys, parseAddress,formatAddress } from "@/domain/address";
import { getDatabase } from "./database";
import { validateAddresses } from "./member-address";
import type { Addresses } from "@/domain/member-foundation";
export async function validatePostalAddresses(details:Record<string,string>, previous:Record<string,string>={},db:Pick<Pool|PoolClient,"query">=getDatabase(),partial=true) {
  for(const key of addressKeys) {
    const field=key+"Structured";
    if(!details[field] || partial && details[field]===previous[field]) continue;
    const parsed=parseAddress(details[field]),kind=key==="officeAddress"?"office":"residence";
    const old=previous[field] ? {[kind]:parseAddress(previous[field])} : {};
    const normalized=await validateAddresses(db,{[kind]:parsed} as Addresses,partial ? old as Addresses : {},partial);
    const value=normalized[kind]!;
    details[field]=JSON.stringify(value);details[key]=formatAddress(value);
  }
}
