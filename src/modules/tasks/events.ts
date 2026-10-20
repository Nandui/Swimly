/** Events Tasks emits (CLAUDE.md section 6, docs/architecture/events.md). */

declare module "@/platform/events" {
  interface PlatformEvents {
    /** A task was completed with readings outside their range. Emitted after the completion is
     *  saved. Site Monitoring raises an action for the site's managers from each reading. */
    "tasks.reading.out_of_range": {
      orgId: string;
      siteId: string;
      taskId: string;
      /** The task's title: "Pool water test". */
      task: string;
      recordedById: string;
      recordedByName: string;
      /** ISO time it was completed. */
      recordedAt: string;
      readings: {
        /** Stable within the task: "<record>:<field>". */
        key: string;
        reading: string;
        value: string;
        unit: string;
        allowed: string;
        guidance: string;
      }[];
    };
  }
}

export {};
