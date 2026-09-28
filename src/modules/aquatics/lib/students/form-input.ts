import type { StudentInput } from "./actions/students";

export function readStudentInput(formData: FormData): StudentInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    memberNumber: text("memberNumber"), firstName: text("firstName"), lastName: text("lastName"),
    dateOfBirth: text("dateOfBirth"), status: (text("status") || "ACTIVE") as StudentInput["status"],
    contactName: text("contactName"), contactEmail: text("contactEmail"), contactPhone: text("contactPhone"),
    emergencyName: text("emergencyName"), emergencyPhone: text("emergencyPhone"), emergencyRelationship: text("emergencyRelationship"),
    medicalNotes: text("medicalNotes"), notes: text("notes"), photoConsent: formData.get("photoConsent") === "on",
  };
}
