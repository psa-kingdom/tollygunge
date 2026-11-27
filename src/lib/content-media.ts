import "server-only";
import type { PoolClient } from "pg";
import { OperationError } from "./operation-api";
export async function requireContentMedia(client: PoolClient, body: unknown, publishedOnly: boolean) {
 const ids=new Set<string>();
 function collect(value:unknown){if(!value||typeof value!=="object")return;for(const [key,item] of Object.entries(value)){if(/mediaId$/i.test(key)&&typeof item==="string"&&item)ids.add(item);else collect(item);}}
 collect(body);if(!ids.size)return;
 const found=await client.query("SELECT id FROM tpa.public_media WHERE id=ANY($1::uuid[]) AND (NOT $2::boolean OR published IS NOT NULL)",[[...ids],publishedOnly]);
 if(found.rowCount!==ids.size)throw new OperationError(publishedOnly?"Publish the selected images before publishing this page.":"A selected image is unavailable. Choose another image.");
}
