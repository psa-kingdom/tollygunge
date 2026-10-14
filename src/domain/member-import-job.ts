export const strictMemberJobPolicy = {
 version: 1, preserveExisting: true, allowDistrictDerivation: false,
 provisionAccounts: false, invitationDelivery: 'none', createOnly: true,
} as const;
export type MemberJobStatus = 'pending'|'retry'|'created'|'skipped'|'conflict'|'invalid'|'failed';
export function transientImportError(code: unknown) {
 return typeof code==='string' && (code.startsWith('08') || ['40001','40P01','55P03','57014','57P01','ECONNRESET','ETIMEDOUT','ECONNREFUSED'].includes(code));
}
export function memberJobTotals(rows: {status:string}[]) {
 return Object.fromEntries(['pending','retry','created','skipped','conflict','invalid','failed'].map(status=>[status,rows.filter(r=>r.status===status).length]));
}
