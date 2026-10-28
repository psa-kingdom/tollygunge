"use client";
import { usePathname } from "next/navigation";
import Link from "./navigation-link";
import { diagnosticRoute } from "@/domain/issue-report";
export function ReportIssueLink({ member = false }: { member?: boolean }) {
  const path = diagnosticRoute(usePathname());
  return <Link href={`${member ? "/member/inquiries" : "/contact"}?type=issue&from=${encodeURIComponent(path)}`}>Report an issue</Link>;
}
