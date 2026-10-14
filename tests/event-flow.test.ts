import test from "node:test";
import assert from "node:assert/strict";
import { speakersInput, remindersInput, eventReturnPath, eventLink, bookingLabel, istInput, istInstant } from "../src/domain/event-flow";
import { eventEmail } from "../src/domain/event-email";
import { eventInput } from "../src/domain/operations";
const event = { id:"00000000-0000-4000-8000-000000000001", title:"Design & <Learning>", starts_at:"2026-12-12T12:00:00Z", location:"Hall <A>", fee_paise:75000 };
test("event speakers and reminder settings enforce meaningful limits and types", () => {
  assert.equal(speakersInput(Array.from({length:6},(_,i) => ({name:`Speaker ${i}`,credentials:""}))).length,6);
  for (const value of [[{name:"x"}],Array(7).fill({name:"Speaker"}),[{name:"Speaker",credentials:"x".repeat(121)}]]) assert.throws(() => speakersInput(value));
  assert.deepEqual(remindersInput({enabled:true,offsets:[15,10080,60],includePending:false}).offsets,[10080,60,15]);
  for (const offsets of [[],[14],[10081],[60,60],[15,60,120,1440],[1.5]]) assert.throws(() => remindersInput({enabled:true,offsets,includePending:false}));
  assert.throws(() => remindersInput({enabled:"true",offsets:[60],includePending:false}));
  const input={title:"Workshop",description:"",location:"Hall",startsAt:event.starts_at,endsAt:"2026-12-12T13:00:00Z",capacity:5,version:0};
  assert.equal(eventInput(input).reminders?.enabled,true);
  assert.equal(eventInput({...input,id:event.id}).reminders,undefined);
});
test("event time inputs remain IST regardless of machine timezone and links respect visibility", () => {
  assert.equal(istInput(event.starts_at),"2026-12-12T17:30");
  assert.equal(istInstant("2026-12-12T17:30"),event.starts_at.replace("Z",".000Z"));
  assert.equal(eventLink("https://example.invalid",{...event,visibility:"members"}),`https://example.invalid/member/events?eventId=${event.id}`);
  assert.equal(bookingLabel({...event,registration_ends_at:"2026-12-12T11:00:00Z"},Date.parse("2026-12-12T11:00:00Z")),"Registration closed");
});
test("event email distinguishes pending payment, confirmation, refunds and reminders with escaped details", () => {
  const registration={id:event.id,fee_paise:75000,payment_status:"pending"};
  for(const state of ["pending","paid","not_required","failed","refunded","cancelled","registration_cancelled","event_cancelled","event_update","reminder_confirmed","reminder_pending"]) {
    const mail=eventEmail(event,state,"https://example.invalid",registration);
    assert.ok(mail.text.includes("₹750.00"));assert.ok(mail.text.includes(event.id));assert.ok(mail.text.includes("IST"));
    assert.ok(mail.html.includes("Hall &lt;A&gt;"));assert.ok(!mail.html.includes("<Learning>"));
  }
  assert.ok(eventEmail(event,"reminder_pending","https://example.invalid",registration).text.includes("not a registration confirmation"));
  assert.ok(eventEmail(event,"registration_cancelled","https://example.invalid",registration).text.includes("No automatic refund"));
});

test("event continuation rejects external URLs and unrelated destinations", () => {
  assert.equal(eventReturnPath(`/member/events?eventId=${event.id}`),`/member/events?eventId=${event.id}`);
  for(const value of ["https://evil.invalid","//evil.invalid","/admin","/member/events?eventId=bad","/member/events?eventId="+event.id+"&next=//evil.invalid",["/member/events"]]) assert.equal(eventReturnPath(value),undefined);
});
