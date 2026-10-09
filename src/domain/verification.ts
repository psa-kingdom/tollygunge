export type VerificationField = {
  id: string;
  label: string;
  type:
    | "text"
    | "multiline"
    | "date"
    | "number"
    | "select"
    | "multiselect"
    | "checkbox"
    | "document";
  step: number;
  required: boolean;
  visible: boolean;
  categories: string[];
  options?: string[];
  help?: string;
  maxLength?: number;
  regulated?: boolean;
  documentKind?: string;
};
export const verificationSteps = [
  "Membership & professional details",
  "Personal details",
  "Contact & preferences",
  "Evidence & referrals",
  "Review & declaration",
];
const field = (
  id: string,
  label: string,
  step: number,
  required = false,
  type: VerificationField["type"] = "text",
  options?: string[],
): VerificationField => ({
  id,
  label,
  step,
  required,
  type,
  visible: true,
  categories: ["Professional", "Student"],
  options,
  maxLength:
    id === "fullName"
      ? 120
      : ["organization", "fatherName", "spouseName", "signature"].includes(id)
        ? 200
        : ["phone", "officePhone", "residencePhone", "fax"].includes(id)
          ? 32
          : 1000,
});
export const initialFields: VerificationField[] = [
  field("qualification", "Qualification / course", 0, true),
  field("professionalStatus", "Professional status", 0, true, "select", [
    "In Practice",
    "In Service",
    "In Business",
    "Other",
  ]),
  field("organization", "Organisation / institution", 0),
  field("professionalBody", "Professional body", 0, false, "select", [
    "None",
    "CA",
    "CS",
    "ICMAI",
    "Bar Council",
    "Other",
  ]),
  {
    ...field("registration", "Professional registration number", 0),
    regulated: true,
  },
  field("title", "Title", 1, false, "select", [
    "Mr",
    "Mrs",
    "Miss",
    "Ms",
    "Dr",
    "Other",
  ]),
  field("fullName", "Full name", 1, true),
  field("fatherName", "Father’s name", 1),
  field("dateOfBirth", "Date of birth", 1, false, "date"),
  field("spouseName", "Spouse name", 1),
  field("bloodGroup", "Blood group (self)", 1),
  field("spouseBloodGroup", "Blood group (spouse)", 1),
  field("phone", "Mobile number", 2, true),
  field("officeAddress", "Office address", 2, false, "multiline"),
  field("residenceAddress", "Residence address", 2, false, "multiline"),
  field("correspondenceAddress", "Correspondence address", 2, true, "select", [
    "Office",
    "Residence",
  ]),
  field("officePhone", "Office phone", 2),
  field("residencePhone", "Residence phone", 2),
  { ...field("fax", "Fax", 2), visible: false, required: false },
  field("deliveryPreference", "Preferred delivery", 2, false, "select", [
    "Email",
    "Courier",
    "Both",
  ]),
  field("contributions", "Contribution activities", 2, false, "multiselect", [
    "Journal articles",
    "Faculty / speaker",
    "Research",
    "Fellowship",
    "Residential seminar",
    "Other",
  ]),
  field("contributionsOther", "Other contribution", 2),
  field("interests", "Professional interests", 2, false, "multiselect", [
    "Direct Taxes",
    "International Tax",
    "GST & Indirect Tax",
    "FEMA",
    "Corporate Laws",
    "Accounting, Audit & Assurances",
    "Information Technology",
    "Finance & Capital Markets",
    "Insolvency & Bankruptcy Code",
    "Commercial Laws",
    "Labour Laws",
    "SEBI",
    "Other",
  ]),
  field("interestsOther", "Other professional interest", 2),
  {
    ...field("photograph", "Passport photograph", 3, true, "document"),
    documentKind: "photograph",
  },
  {
    ...field("certificate", "Professional certificate", 3, true, "document"),
    categories: ["Professional"],
    documentKind: "certificate",
  },
  {
    ...field("studentEvidence", "Student evidence", 3, true, "document"),
    categories: ["Student"],
    documentKind: "student_evidence",
  },
  field("proposerName", "Proposer name", 3),
  field("proposerNumber", "Proposer membership number", 3),
  {
    ...field("proposerSignature", "Proposer signature", 3, false, "document"),
    documentKind: "supporting",
  },
  field("seconderName", "Seconder name", 3),
  field("seconderNumber", "Seconder membership number", 3),
  {
    ...field("seconderSignature", "Seconder signature", 3, false, "document"),
    documentKind: "supporting",
  },
  field(
    "declaration",
    "I confirm these details are truthful and submit them for TPA profile review.",
    4,
    true,
    "checkbox",
  ),
  field("signature", "Typed applicant signature", 4, true),
  field("place", "Place", 4),
];
export function applicable(f: VerificationField, category: string) {
  return f.visible && f.categories.includes(category);
}
export function validateFields(
  value: unknown,
  previous: VerificationField[] = initialFields,
): VerificationField[] {
  if (!Array.isArray(value) || value.length > 100 || value.length < 1)
    throw Error("Use 1–100 fields.");
  const ids = new Set<string>();
  return value.map((v) => {
    const f = v as VerificationField;
    if (
      !f ||
      !/^[a-z][a-zA-Z0-9_]{0,59}$/.test(f.id) ||
      ids.has(f.id) ||
      ![
        "text",
        "multiline",
        "date",
        "number",
        "select",
        "multiselect",
        "checkbox",
        "document",
      ].includes(f.type) ||
      !Number.isInteger(f.step) ||
      f.step < 0 ||
      f.step > 4 ||
      typeof f.label !== "string" ||
      !f.label.trim() ||
      f.label.length > 200 ||
      typeof f.visible !== "boolean" ||
      typeof f.required !== "boolean" ||
      !Array.isArray(f.categories) ||
      f.categories.some((c) => !["Professional", "Student"].includes(c)) ||
      (f.required && !f.visible)
    )
      throw Error("Check field configuration.");
    ids.add(f.id);
    const old = previous.find((x) => x.id === f.id);
    if (old && old.type !== f.type)
      throw Error("Create a new field identifier to change its type.");
    if (
      f.options &&
      (!Array.isArray(f.options) ||
        f.options.length > 50 ||
        f.options.some((x) => typeof x !== "string" || x.length > 200))
    )
      throw Error("Check field options.");
    if (["select", "multiselect"].includes(f.type) && !f.options?.length)
      throw Error("Choice fields need options.");
    if (
      f.maxLength !== undefined &&
      (!Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 5000)
    )
      throw Error("Use a character limit from 1 to 5,000.");
    if (
      f.type === "document" &&
      !["certificate", "photograph", "student_evidence", "supporting"].includes(
        f.documentKind ?? "",
      )
    )
      throw Error("Choose a supported document kind.");
    return {
      ...f,
      label: f.label.trim(),
      help: typeof f.help === "string" ? f.help.slice(0, 500) : "",
    };
  });
}
export function validateAnswers(
  input: unknown,
  fields: VerificationField[],
): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Check form answers.");
  const result: Record<string, string> = {};
  for (const [id, v] of Object.entries(input)) {
    if (typeof v !== "string" || v.length > 5000)
      throw Error("Check answer length.");
    const f = fields.find((x) => x.id === id);
    if (!f) {
      result[id] = v;
      continue;
    }
    if (v.length > (f.maxLength ?? 1000))
      throw Error(`${f.label} is too long.`);
    if (
      v &&
      f.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v)
    )
      throw Error(`Check ${f.label}.`);
    if (v && f.type === "number" && !Number.isFinite(Number(v)))
      throw Error(`Check ${f.label}.`);
    if (v && f.type === "select" && !f.options?.includes(v))
      throw Error(`Check ${f.label}.`);
    if (v && f.type === "checkbox" && !["true", "false"].includes(v))
      throw Error(`Check ${f.label}.`);
    if (v && f.type === "multiselect") {
      const a = JSON.parse(v);
      if (!Array.isArray(a) || a.some((x) => !f.options?.includes(x)))
        throw Error(`Check ${f.label}.`);
      result[id] = JSON.stringify(a);
      continue;
    }
    result[id] = v;
  }
  return result;
}
export function missingFields(
  fields: VerificationField[],
  answers: Record<string, string>,
  category: string,
  emailVerified: boolean,
) {
  const missing = fields
    .filter(
      (f) =>
        applicable(f, category) &&
        (f.required ||
          (f.regulated &&
            ["CA", "CS", "ICMAI", "Bar Council"].includes(
              answers.professionalBody,
            ))) &&
        (!answers[f.id]?.trim() ||
          (f.type === "checkbox" && answers[f.id] !== "true") ||
          (f.type === "multiselect" && answers[f.id] === "[]")),
    )
    .map((f) => f.label);
  if (!emailVerified) missing.push("Verify your account email");
  if (
    (answers.correspondenceAddress === "Office" &&
      !answers.officeAddress?.trim()) ||
    (answers.correspondenceAddress === "Residence" &&
      !answers.residenceAddress?.trim())
  )
    missing.push("Selected correspondence address");
  return missing;
}

export function requirementUpdateNeeded(
  fields: VerificationField[],
  previous: VerificationField[],
  answers: Record<string, string>,
  category: string,
) {
  const newlyRequired = fields.filter((field) => {
    const old = previous.find((f) => f.id === field.id);
    return (
      (field.required || field.regulated) &&
      (!old ||
        !old.visible ||
        (!old.required && field.required) ||
        (!old.regulated && field.regulated) ||
        !old.categories.includes(category))
    );
  });
  return missingFields(newlyRequired, answers, category, true).length > 0;
}
