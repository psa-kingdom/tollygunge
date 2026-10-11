"use client";
export class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? "Unable to complete request.",
      data.fieldErrors,
      data.code,
    );
  return data as T;
}
