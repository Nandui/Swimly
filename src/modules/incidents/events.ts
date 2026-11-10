/** Events Incidents emits (AGENTS.md, How apps talk, docs/architecture.md). */

declare module "@/platform/events" {
  interface PlatformEvents {
    /** Whoever triages a report linked hazards from the site's risk assessments to it and asked
     *  for their assessments to be looked at again. Emitted after the links are saved. Risk
     *  assessments raises a review request on each assessment. */
    "incidents.hazards.flagged": {
      orgId: string;
      siteId: string;
      incidentId: string;
      /** The report's number as shown: "INC-00042". */
      incident: string;
      /** One per press, so the same announcement heard twice raises nothing twice. */
      operationId: string;
      /** The hazards' ids in the app that keeps them. */
      hazardIds: string[];
      /** Why another look is needed, in the words of whoever asked. No names of the people involved. */
      note: string;
      flaggedById: string;
      flaggedByName: string;
    };
  }
}

export {};
