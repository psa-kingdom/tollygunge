export const eventOrganisers = ["TPA", "CA CP Study Circle"] as const;
export type OrganiserUpi = {
  id: string;
  version: number;
  details: {
    method: "upi";
    label: string;
    organiser: string;
    payee: string;
    upiId: string;
    phone: string;
    qrId: string | null;
  };
};
