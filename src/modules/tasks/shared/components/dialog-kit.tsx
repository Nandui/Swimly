"use client";


export const THEME = "turnfin-module turnfin-tasks";
export const text = (form: FormData, key: string) => String(form.get(key) ?? "");
