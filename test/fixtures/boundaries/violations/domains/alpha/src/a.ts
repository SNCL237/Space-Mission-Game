// VIOLATION RI1 : un domaine importe un autre domaine.
import { b } from "../../beta/src/b.js";

export const a = b;
