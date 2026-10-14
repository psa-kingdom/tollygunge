/** Shared by web APIs and standalone workers; no request-context imports. */
export class OperationError extends Error {
 constructor(message:string,public status=400,public code?:string,public fieldErrors?:Record<string,string>){super(message);}
}
