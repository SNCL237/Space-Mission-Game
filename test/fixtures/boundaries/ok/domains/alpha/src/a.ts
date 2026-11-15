// Fixture VALIDE : un domaine importe son propre module + le noyau.
import { local } from "./local.js";
import { seed } from "../../../kernel/util.js";

export const ok = local && seed > 0;
