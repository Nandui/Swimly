import { Tag } from "@/components/ui-kit/tag";
import { TASK_STATE_META, type TaskState } from "@/modules/tasks/lib/rules";

/** A task's state: the meta gives its words, tone and icon. */
export function TaskStateTag({ state }: { state: TaskState }) {
  return <Tag meta={TASK_STATE_META[state]} />;
}
