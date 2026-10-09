/** Rota's public API (CLAUDE.md section 6): the only file other modules, Core
 *  and front may import. Turnfin Me's staff API reads a person's own days
 *  through it. */
export { myDays, type MyDay } from "@/modules/rota/features/me";
