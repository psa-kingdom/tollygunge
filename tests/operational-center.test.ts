import test from "node:test";
import assert from "node:assert/strict";
import { eventInput } from "../src/domain/operations";
const event = {
  version: 0,
  title: "Operational workshop",
  description: "",
  location: "Online joining instructions",
  startsAt: "2026-12-12T12:00:00Z",
  endsAt: "2026-12-12T14:00:00Z",
  capacity: 200,
};
test("event booking windows close before event starts, with explicit currency precision and visibility", () => {
  const paid = eventInput({
    ...event,
    feePaise: 75000,
    visibility: "members",
    deliveryMode: "online",
    registrationStartsAt: "2026-12-01T12:00:00Z",
    registrationEndsAt: "2026-12-11T12:00:00Z",
  });
  assert.equal(paid.feePaise, 75000);
  assert.equal(paid.visibility, "members");
  for (const change of [
    { feePaise: -1 },
    { feePaise: 1.5 },
    { feePaise: 100000001 },
    { visibility: "staff" },
    { registrationEndsAt: "2026-12-13T12:00:00Z" },
    { registrationStartsAt: "2026-12-12T12:00:00Z" },
    {
      registrationStartsAt: "2026-12-10T12:00:00Z",
      registrationEndsAt: "2026-12-09T12:00:00Z",
    },
  ])
    assert.throws(() => eventInput({ ...event, ...change }));
  assert.equal(eventInput(event).feePaise, 0);
});
