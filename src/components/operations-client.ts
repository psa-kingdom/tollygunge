"use client";
export class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string> = {},
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  }); } catch {
    throw new ApiError("Unable to connect. Check your connection and try again. Before resubmitting a change, check whether it was saved.", {}, "network_unavailable", 0);
  }
  let data;
  try { data = await response.json(); } catch {
    throw new ApiError("The service is temporarily unavailable. Please try again later. Before resubmitting a change, check whether it was saved.", {}, "service_unavailable", response.status);
  }
  if (!response.ok)
    throw new ApiError(
      response.status === 401 ? "Your session has expired or you are signed out. Sign in again to continue."
        : response.status === 403 ? "Your account does not have permission to perform this action."
        : response.status >= 500 ? "The service is temporarily unavailable. Before resubmitting a change, check whether it was saved."
        : typeof data?.error === "string" ? data.error : "Unable to complete request.",
      data?.fieldErrors,
      data?.code,
      response.status,
    );
  return data as T;
}
