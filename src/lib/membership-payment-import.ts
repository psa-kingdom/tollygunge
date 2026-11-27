import { createHash } from "node:crypto";
import { clean, email, mobile } from "@/domain/member-foundation";

export const membershipPaymentHeaders = [
  "Name",
  "Email",
  "Mobile",
  "Membership plan",
  "Amount paid",
];
export type MembershipPaymentRow = {
  row: number;
  name: string;
  email: string;
  mobile: string;
  plan: string;
  amountPaise: number;
  fingerprint: string;
  error?: string;
};

export function membershipPaymentRows(
  cells: string[][],
  sourceRows?: number[],
  plans: { code: string; name: string; active?: boolean }[] = [
    "Free",
    "Life",
    "Patron",
  ].map((code) => ({ code, name: code })),
) {
  if (cells.length < 2 || cells.length > 1001)
    throw Error("Use between 1 and 1,000 payment rows.");
  if (
    cells[0].length !== 5 ||
    cells[0].some(
      (cell, i) =>
        cell.trim().toLowerCase() !== membershipPaymentHeaders[i].toLowerCase(),
    )
  )
    throw Error(
      "Use the five columns in the downloadable template, in the same order.",
    );
  return cells.slice(1).map((cells, i): MembershipPaymentRow => {
    const row: MembershipPaymentRow = {
      row: sourceRows?.[i + 1] ?? i + 2,
      name: "",
      email: "",
      mobile: "",
      plan: "",
      amountPaise: 0,
      fingerprint: "",
    };
    try {
      if (cells.slice(5).some((cell) => cell.trim()))
        throw Error("Use only the five template columns.");
      row.name = clean(cells[0], "name", 120);
      if (row.name.length < 2)
        throw Error("Enter a name of at least two characters.");
      row.email = email(cells[1], true);
      row.mobile = mobile(cells[2]);
      if (!row.mobile) throw Error("Enter a mobile number.");
      const plan = clean(cells[3], "membership plan", 30).toLowerCase();
      const codeMatch = plans.find(
        (value) => value.code.toLowerCase() === plan,
      );
      const names = plans.filter((value) => value.name.toLowerCase() === plan);
      const activeNames = names.filter((value) => value.active !== false);
      const matches = codeMatch
        ? [codeMatch]
        : activeNames.length
          ? activeNames
          : names;
      row.plan = matches.length === 1 ? matches[0].code : "";
      if (!row.plan)
        throw Error("Choose a membership plan configured in Settings.");
      const amount = String(cells[4] ?? "").trim();
      if (!/^\d+(\.\d{1,2})?$/.test(amount))
        throw Error("Enter an amount in rupees with up to two decimal places.");
      row.amountPaise = Math.round(Number(amount) * 100);
      if (
        !Number.isSafeInteger(row.amountPaise) ||
        row.amountPaise <= 0 ||
        row.amountPaise > 999999999
      )
        throw Error("Enter an amount between ₹0.01 and ₹99,99,999.99.");
      row.fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            row.name.toLowerCase(),
            row.email,
            row.mobile,
            row.plan,
            row.amountPaise,
          ]),
        )
        .digest("hex");
    } catch (error) {
      row.error =
        error instanceof Error && "fieldErrors" in error
          ? Object.values(error.fieldErrors as Record<string, string>).join(" ")
          : (error as Error).message;
    }
    return row;
  });
}
