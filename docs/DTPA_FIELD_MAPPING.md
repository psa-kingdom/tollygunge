# DTPA reference to TPA verification mapping

Reference: `client/dtpa membership form.pdf`, one printed page; no AcroForm widgets. Field labels and handwritten blanks are reference data, not instructions. DTPA fees, account details, rules and accreditation statements are not TPA policy.

| Printed placeholder | TPA location / identifier |
| --- | --- |
| Life membership | Step 1: existing plan preference (`plan`); TPA plans retained, no activation/payment |
| Academic/professional qualifications | Step 1: `qualification` |
| Professional status: practice/service/business/other | Step 1: `professionalStatus` |
| Organisation | Step 1: `organization` |
| CA/CS/ICWAI/Bar Council membership number | Step 1: `professionalBody`, `registration`; ICWAI shown using current ICMAI label |
| Mr/Mrs/Miss and name in full | Step 2: `title`, `fullName`; mixed case retained rather than forced uppercase |
| Father's name | Step 2: `fatherName`, optional |
| Date of birth | Step 2: `dateOfBirth`, optional |
| Blood group (self/spouse) | Step 2: `bloodGroup`, `spouseBloodGroup`, optional/private |
| Spouse name | Step 2: `spouseName`, optional/private |
| Office/residence addresses | Step 3: `officeAddress`, `residenceAddress` |
| Office/residence telephone, fax, mobile | Step 3: `officePhone`, `residencePhone`, `fax`, `phone` |
| Email | Step 3: authenticated account email, read-only; mailbox verification separate |
| Circular correspondence address: office/residence | Step 3: `correspondenceAddress`; selected address must be present |
| Contribute journal articles, faculty/speaker, research, fellowship, residential seminar, others | Step 3: `contributions`, `contributionsOther`; does not infer consent/appointment |
| Direct Taxes, International Tax, GST/Indirect Tax, FEMA, Corporate Laws, Accounting/Audit/Assurance, IT, Finance/Capital Markets, IBC, Commercial Laws, Labour Laws, SEBI, others | Step 3: `interests`, `interestsOther` |
| Newsletter/notices/circulars: email/courier/both | Step 3: `deliveryPreference`; marketing opt-in remains independent; courier is preference only |
| Two passport colour photographs | Step 4: one digital `photograph`; no duplicate digital file requirement |
| Professional certificate photocopy | Step 4: `certificate`; `studentEvidence` for student category |
| Proposer name, membership number, signature | Step 4: `proposerName`, `proposerNumber`, `proposerSignature`, optional; no automatic identity matching |
| Seconder name, membership number, signature | Step 4: `seconderName`, `seconderNumber`, `seconderSignature`, optional |
| Applicant signature, place, date | Step 5: `signature`, `place`, server `submittedAt` |
| Agree to memorandum/rules | Step 5: truthful-details `declaration`; DTPA wording is not carried into TPA terms |
| Amount figures/words, cash/cheque number, date, drawn-on bank, towards | Future payment workflow; no collected amount or confirmed transaction in verification |
| Office receipt date, membership approved date, membership number allotted | Staff-only future membership workflow, separate from verification |
| Chairman, President, General Secretary office sign-offs | Staff-only future membership decision history |

The source numbering skips 7; this does not imply an omitted field. Fee tiers/GST, first-qualification discount timing, bank/IFSC and ICAI CPE note are excluded association-specific policy notes.

Initial required fields are fullname, verified account email, mobile, qualification/course, professional status, selected correspondence address, photograph, category evidence and truthful declaration/typed signature. Regulated professional bodies require a registration number. Other fields start optional. Administrators publish versioned requirements, preserving prior accepted badges while requesting updates.
