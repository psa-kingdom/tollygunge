import test from "node:test";
import assert from "node:assert/strict";
import { historicalEventInput, historicalAttendanceAvailable } from "../src/domain/historical-event-details";
import { ownWorkbookAttendance } from "../src/domain/member-attendance";
const input = {date:"2026-09-02",title:" Tax workshop ",description:"Updated description",location:"Kolkata",speakers:"Sample speaker",version:0,reason:"Correct event details"};
test("missing historical registers are unknown, distinct from available empty registers", () => {
 assert.equal(historicalAttendanceAvailable({sheet:"",rows:[],attendanceAvailable:false}), false);
 assert.equal(historicalAttendanceAvailable({sheet:"16-07-26",rows:[],attendanceAvailable:true}), true);
 assert.equal(historicalAttendanceAvailable({sheet:"16-07-26",rows:[]}), true);
 assert.equal(historicalAttendanceAvailable({sheet:"",rows:[]}), false);
 assert.equal(historicalAttendanceAvailable({sheet:"",rows:[{name:"Sample participant"}]}), true);
});
test("validates edits and rejects invalid dates, versions, blank reasons and oversized fields", () => {
 assert.equal(historicalEventInput(input).title,"Tax workshop");
 for(const change of [{date:"2026-02-30"},{date:"2026-13-02"},{version:-1},{version:1.5},{reason:""},{title:"x"},{description:"x".repeat(5001)}]) assert.throws(()=>historicalEventInput({...input,...change}));
});
test("event corrections preserve attendance identity and use the saved title in member history", () => {
 const rows=[{number:"123",status:"Attended"},{number:"456",status:"Not recorded"}];
 const events=[{date:input.date,title:historicalEventInput(input).title,rows}];
 assert.deepEqual(ownWorkbookAttendance(events,["123"]),[{date:input.date,title:"Tax workshop",source:"workbook"}]);
 assert.deepEqual(ownWorkbookAttendance(events,["456"]),[]);
 assert.deepEqual(rows,[{number:"123",status:"Attended"},{number:"456",status:"Not recorded"}]);
 const parsed=historicalEventInput({...input,rows:[],dateOverride:"2026-10-04"});
 assert.equal(parsed.date,input.date);
 assert.ok(!("rows" in parsed));
});
