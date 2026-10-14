import { authorized, operation } from '@/lib/operation-api';
import { getDatabase } from '@/lib/database';
import { memberEventJourney } from '@/lib/event-engagement';
export const runtime='nodejs';
export async function GET(request:Request) { return operation(async()=>memberEventJourney(getDatabase(),(await authorized(request)).id)); }
