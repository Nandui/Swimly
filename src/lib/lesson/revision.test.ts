import assert from "node:assert/strict";
import { test } from "node:test";
import { attendanceFingerprint } from "./revision";
const stamp=new Date("2026-09-09T10:00:00Z");
const row={studentId:"synthetic",status:"PRESENT",note:null,markedAt:stamp};
test("attendance completion reopens after roster, note, or legacy mark updates",()=>{
 const before=attendanceFingerprint(["synthetic"],[row],"");
 assert.notEqual(before,attendanceFingerprint(["synthetic","new-swimmer"],[row],""));
 assert.notEqual(before,attendanceFingerprint(["synthetic"],[{...row,markedAt:new Date("2026-09-09T10:01:00Z")}],""));
 assert.notEqual(before,attendanceFingerprint(["synthetic"],[row],"Pool closed"));
 assert.notEqual(before,attendanceFingerprint(["synthetic"],[{...row,status:"LATE"}],""));
});
test("completion fingerprints ignore row ordering",()=>{
 const second={...row,studentId:"second"};
 assert.equal(attendanceFingerprint(["synthetic","second"],[row,second],""),attendanceFingerprint(["second","synthetic"],[second,row],""));
});
