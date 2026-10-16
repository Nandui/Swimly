import { formatCount } from "@/lib/format";
import type { TeacherInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { reportQuery, type RangeKey } from "@/modules/activities/features/analytics/server/period";
import { Kpi, Panel, percent, ReportShell, scopeOf } from "@/modules/activities/features/analytics/components/insights/kit";
import { TeacherTable } from "@/modules/activities/features/analytics/components/insights/teacher-table";

export function TeachersReport({ data }: { data: TeacherInsights }) {
  const t = data.teachers;
  const school = t.school;
  return <ReportShell ctx={data} page="teachers" path="/analytics/teachers" title="Teachers" footnotes={[
    "A lesson belongs to whoever started it on the pool deck, so cover and the rota's plan count for the person who taught. Not started means a finished lesson with swimmers that nobody started; it counts against whoever was planned.",
    `On time means started no more than 5 minutes after the start time. Skills ticked and passes are the ones each teacher marked. Left after counts swimmers who left the swim school, against the teacher of the last lesson they came to, as a share of the swimmers they taught.`,
    "Figures in gold are more than 10 points worse than the school's. Small numbers move a lot: read a teacher with few lessons with care.",
  ]}>
    <ul className="ins-kpis" aria-label="Teaching at a glance">
      <Kpi label="Lessons taught" value={formatCount(t.lessons - t.notStarted)} note={`${formatCount(t.teachers.length)} teachers`} />
      <Kpi label="Not started" value={formatCount(t.notStarted)} note="Finished lessons with no start record" />
      <Kpi label="Attendance" value={percent(school.attendance)} note="Across every lesson taught" />
      <Kpi label="Started on time" value={percent(school.onTime)} note="Within 5 minutes" />
      <Kpi label="Registers complete" value={percent(school.registers)} note="Every swimmer marked" />
      <Kpi label="Left after" value={percent(school.leaverRate)} note="Of swimmers taught, across the school" />
    </ul>
    <Panel id="teachers" title="Every teacher" sub="Open a teacher for their week-by-week figures, their classes and the swimmers who left after their lessons.">
      <TeacherTable teachers={t.teachers} school={school} query={reportQuery(data.period.key as RangeKey, scopeOf(data))} />
    </Panel>
  </ReportShell>;
}
