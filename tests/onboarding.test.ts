import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  initialFields,
  validateFields,
  validateAnswers,
  missingFields,
  requirementUpdateNeeded,
} from "../src/domain/verification";
import {
  parseCsv,
  importCells,
  mapImport,
} from "../src/domain/onboarding-import";
import {
  onboardingEmail,
  sealMail,
  openMail,
  hashToken,
} from "../src/lib/onboarding-mail";
test("versioned fields preserve identity/type and enforce configuration", () => {
  assert.throws(() =>
    validateFields(
      initialFields.map((f) =>
        f.id === "fullName" ? { ...f, type: "number" } : f,
      ),
    ),
  );
  assert.throws(() => validateFields([...initialFields, initialFields[0]]));
  assert.throws(() =>
    validateFields([{ ...initialFields[0], visible: false, required: true }]),
  );
  assert.equal(
    validateFields([
      ...initialFields,
      {
        id: "custom",
        label: "Custom",
        type: "text",
        step: 2,
        visible: true,
        required: false,
        categories: ["Professional"],
      },
    ]).length,
    initialFields.length + 1,
  );
});
test("incomplete drafts save; required evidence and category are enforced only on submission", () => {
  assert.deepEqual(validateAnswers({ fullName: "Test" }, initialFields), {
    fullName: "Test",
  });
  const values = {
    fullName: "Test",
    phone: "1234567890",
    qualification: "Course",
    professionalStatus: "Other",
    correspondenceAddress: "Residence",
    residenceAddress: "Kolkata",
    photograph: "photo",
    studentEvidence: "evidence",
    declaration: "true",
    signature: "Test",
  };
  assert.deepEqual(missingFields(initialFields, values, "Student", true), []);
  assert.ok(
    missingFields(initialFields, values, "Professional", true).includes(
      "Professional certificate",
    ),
  );
  assert.ok(
    missingFields(
      initialFields,
      { ...values, professionalBody: "CA" },
      "Professional",
      true,
    ).includes("Professional registration number"),
  );
  assert.ok(
    missingFields(initialFields, values, "Student", false).includes(
      "Verify your account email",
    ),
  );
  assert.throws(() =>
    validateAnswers({ dateOfBirth: "2026-02-30" }, initialFields),
  );
  assert.throws(() =>
    validateAnswers({ professionalStatus: "Invalid" }, initialFields),
  );
});
test("CSV/XLSX onboarding normalises emails, detects duplicates and rejects privilege fields/formulas", async () => {
  const csv =
    'name,email,organization\n"Test, Person",User@Example.com,TPA\nSecond,user@example.com,Other';
  const cells = parseCsv(csv),
    mapping = { name: "name", email: "email", organization: "organization" };
  const rows = mapImport(cells, mapping, ["organization"]);
  assert.equal(rows[0].email, "user@example.com");
  assert.equal(rows[0].name, "Test, Person");
  assert.equal(rows[1].error, "Duplicate email in file.");
  assert.throws(() =>
    mapImport(
      [
        ["name", "email", "password"],
        ["A", "a@example.com", "x"],
      ],
      mapping,
      ["organization"],
    ),
  );
  assert.throws(() => parseCsv('name,email\n"bad'));
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Users");
  cells.forEach((r) => sheet.addRow(r));
  assert.deepEqual(
    await importCells(
      new Uint8Array(await book.xlsx.writeBuffer()),
      "users.xlsx",
    ),
    cells,
  );
  sheet.getCell("A2").value = { formula: "1+1", result: 2 };
  await assert.rejects(async () =>
    importCells(new Uint8Array(await book.xlsx.writeBuffer()), "users.xlsx"),
  );
  assert.ok(
    mapImport(
      [
        ["name", "email"],
        ["=1+1", "a@example.com"],
      ],
      { name: "name", email: "email" },
      [],
    )[0].error,
  );
});
test("transactional templates escape HTML and encrypted outbox does not retain raw action tokens", () => {
  const value = onboardingEmail(
    "invitation",
    "https://tpassociation.org/invitation#token=<secret>",
  );
  assert.ok(value.html.includes("&lt;secret&gt;"));
  const encrypted = sealMail(value, "test-only-secret");
  assert.ok(!JSON.stringify(encrypted).includes("<secret>"));
  assert.deepEqual(openMail(encrypted, "test-only-secret"), value);
  assert.throws(() => openMail(encrypted, "wrong-secret"));
  assert.equal(hashToken("x").length, 64);
  assert.throws(() => onboardingEmail("campaign", "url"));
});

test("only new requirements prompt legacy approvals and unreviewed drafts cannot satisfy them", () => {
  assert.equal(
    requirementUpdateNeeded(initialFields, initialFields, {}, "Professional"),
    false,
  );
  const added = {
    id: "newEvidence",
    label: "New evidence",
    type: "text" as const,
    step: 1,
    required: true,
    visible: true,
    categories: ["Professional"],
  };
  assert.equal(
    requirementUpdateNeeded(
      [...initialFields, added],
      initialFields,
      {},
      "Professional",
    ),
    true,
  );
  assert.equal(
    requirementUpdateNeeded(
      [...initialFields, added],
      initialFields,
      { newEvidence: "Approved value" },
      "Professional",
    ),
    false,
  );
  assert.equal(
    requirementUpdateNeeded(
      [...initialFields, added],
      initialFields,
      {},
      "Student",
    ),
    false,
  );
});

test("required multiselects reject empty arrays even with JSON whitespace", () => {
  const field = {
    id: "choices",
    label: "Required choices",
    type: "multiselect" as const,
    step: 1,
    required: true,
    visible: true,
    categories: ["Professional"],
    options: ["A"],
  };
  const answers = validateAnswers({ choices: " [ ] " }, [field]);
  assert.deepEqual(missingFields([field], answers, "Professional", true), [
    "Required choices",
  ]);
});

test("archived Fax preserves stored answers and can be restored without changing identity", () => {
  const fax = initialFields.find((f) => f.id === "fax")!;
  assert.equal(fax.visible, false);
  assert.equal(fax.required, false);
  assert.deepEqual(validateAnswers({ fax: "12345678" }, initialFields), {
    fax: "12345678",
  });
  const restored = validateFields(
    initialFields.map((f) => (f.id === "fax" ? { ...f, visible: true } : f)),
    initialFields,
  );
  assert.equal(restored.find((f) => f.id === "fax")?.visible, true);
  assert.equal(restored.find((f) => f.id === "fax")?.type, fax.type);
});
