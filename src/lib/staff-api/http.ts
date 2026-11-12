import { z } from "zod";
import { publicApi } from "@/lib/public-api/http";
import { staffApiConfig } from "@/lib/staff-api/config";

/** Request and response plumbing for the staff API: Core's public-API kit
 *  (src/lib/public-api/http.ts), worded for Turnfin Me. */

export { idSchema, json } from "@/lib/public-api/http";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const { readBody, parseInput, respond: staffResponse } = publicApi({
  name: "Staff API",
  origins: () => staffApiConfig().origins,
  methods: "GET,POST,PATCH,PUT,OPTIONS",
  messages: { originDenied: "This app is not allowed to connect.", tooLarge: "That is too large to send.", invalid: "Check the request fields." },
});
