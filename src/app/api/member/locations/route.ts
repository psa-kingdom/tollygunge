import { authorized, operation, OperationError } from "@/lib/operation-api";
import { getDatabase } from "@/lib/database";
import { postalVersion } from "@/lib/member-address";
export const runtime = "nodejs";
export async function GET(r: Request) {
  return operation(async () => {
    await authorized(r);
    const p = new URL(r.url).searchParams, db = getDatabase(), version = await postalVersion(db);
    const pin = p.get("pin") || "", state = p.get("state") || "", district = p.get("district") || "";
    if ((pin && !/^[1-9]\d{5}$/.test(pin)) || state.length > 200 || district.length > 200)
      throw new OperationError("Check the postal filters.", 400, "postal_validation");
    const where = "version_id=$1 AND ($2='' OR pin=$2) AND ($3='' OR lower(state)=lower($3)) AND ($4='' OR lower(district)=lower($4))";
    const values = [version.id, pin, state, district];
    const states = (await db.query("SELECT DISTINCT state FROM tpa.postal_locations WHERE version_id=$1 ORDER BY state", [version.id])).rows.map((x) => x.state);
    const districts = state || pin ? (await db.query("SELECT DISTINCT district FROM tpa.postal_locations WHERE version_id=$1 AND ($2='' OR lower(state)=lower($2)) AND ($3='' OR pin=$3) ORDER BY district", [version.id,state,pin])).rows.map((x) => x.district) : [];
    const localities = pin || (state && district) ? (await db.query(`SELECT pin,state,district,locality FROM tpa.postal_locations WHERE ${where} ORDER BY pin,locality`, values)).rows : [];
    const cities = state && district ? (await db.query("SELECT DISTINCT city FROM tpa.postal_city_aliases WHERE version_id=$1 AND lower(state)=lower($2) AND lower(district)=lower($3) ORDER BY city", [version.id,state,district])).rows.map((x) => x.city) : [];
    return { version, states, districts, cities, localities, exactLocation: false };
  });
}
