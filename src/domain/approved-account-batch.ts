/** Explicit exception for the unchanged, human-approved source workbook only. */
export const approvedAccountSourceHash =
  "0031124b1557fcd3bce3a03201733aabda212ff95494adcd66ace3df607f1ecd";
export const approvedAccountPolicy = {
  approval: "source-211-held-invitations-v1",
  allowIncompleteAddresses: true,
  allowDistrictDerivation: false,
  preserveExisting: true,
  provisionAccounts: true,
  invitationDelivery: "held",
  duplicateEmail: "first-source-row",
  updateRows: [] as number[],
} as const;
