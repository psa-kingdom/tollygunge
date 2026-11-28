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

export function matchesOrganiserUpiQr(payload: string | undefined, upiId: string) {
  if (!payload) return false;
  try {
    const uri = new URL(payload);
    const params = uri.searchParams;
    const payees = params.getAll("pa");
    const amounts = params.getAll("am");
    return uri.protocol === "upi:" && uri.hostname === "pay" &&
      !uri.username && !uri.password && !uri.port && !uri.pathname &&
      payees.length === 1 && payees[0].toLowerCase() === upiId.toLowerCase() &&
      amounts.length <= 1 && (!amounts.length || Number(amounts[0]) === 0) &&
      (!params.has("cu") || params.getAll("cu").every((currency) => currency === "INR"));
  } catch {
    return false;
  }
}
