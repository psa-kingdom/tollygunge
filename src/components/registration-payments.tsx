"use client";
import { FinanceWorkspace } from "./payments-workspace";
export function RegistrationPayments({eventId,onSaved}:{eventId?:string;onSaved?:()=>Promise<void>}={}) {return <FinanceWorkspace key={eventId??"all"} eventId={eventId} onSaved={onSaved}/>;}
