import { uuid } from "./operations";

export function portraitObjectKey(id: string) {
  return `tpa/portraits/${uuid(id)}.webp`;
}
