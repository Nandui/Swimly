import type { Metadata } from "next";
import { cache } from "react";
import { AssignTraining, CancelTraining } from "@/modules/training/components/manage-actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { TRAINING_STATUS_META } from "@/modules/training/lib/constants";
import { formatDate } from "@/lib/format";
import { AuthorizationError } from "@/lib/authz";
import { listCourses, personTraining } from "@/modules/training/lib/data";

/** One read per request, shared by the page and its tab title. personTraining
 *  is the guard: it 404s anyone the reader's Training role does not cover. */
const load = cache(personTraining);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    return { title: (await load((await params).id)).person.name };
  } catch (error) {
    // No Training access: the layout turns the page into a 404, so the title is the 404 page's.
    if (error instanceof AuthorizationError) return { title: "Page not found" };
    throw error;
  }
}

/** One person's training and qualifications, for someone whose Training role
 *  covers them. Anyone else is a 404. */
export default async function TrainingPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(id);
  const courses = data.canAssign ? (await listCourses()).courses : [];
  const person = { id: data.person.id, name: data.person.name, jobTitle: data.person.jobTitle };
  return (
    <>
      <PageHeader
        back={{ href: "/training", label: "Training" }}
        title={data.person.name}
        description={data.person.jobTitle || "Training record"}
        actions={data.canAssign && courses.length > 0 ? <AssignTraining courses={courses} people={[person]} userIds={[person.id]} /> : null}
      />
      <div className="pc-grid">
        <section className="pc-panel" aria-labelledby="training-history">
          <div className="pc-panel-head"><h2 id="training-history">Training</h2></div>
          {data.assignments.length === 0 ? <EmptyState compact icon="graduation" title="No training assigned yet" /> : (
            <ul className="pc-rows">
              {data.assignments.map((a) => (
                <li key={a.id} className="pc-row">
                  <div className="pc-row-body">
                    <span className="pc-row-title">{a.course.title}</span>
                    <p className="pc-row-hint">
                      {a.state === "completed" && a.completedAt
                        ? `Completed ${formatDate(a.completedAt)}${a.signedOffByName ? ` · signed off by ${a.signedOffByName}` : ""}`
                        : a.state === "cancelled" ? `Cancelled: ${a.cancelReason}`
                        : `Assigned by ${a.assignedByName} ${formatDate(a.assignedAt)} · ${a.dueOn ? `due ${formatDate(a.dueOn)}` : "no deadline"}`}
                    </p>
                    {a.signoffNote && a.state !== "cancelled" ? <p className="pc-row-hint">Trainer: {a.signoffNote}</p> : null}
                  </div>
                  <div className="pc-row-trail">
                    <Tag meta={TRAINING_STATUS_META[a.state]} />
                    {data.canAssign && (a.state === "assigned" || a.state === "overdue" || a.state === "submitted") ? <CancelTraining id={a.id} name={data.person.name} title={a.course.title} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="pc-panel" aria-labelledby="training-qualifications">
          <div className="pc-panel-head"><h2 id="training-qualifications">Qualifications</h2></div>
          {data.qualifications.length === 0 ? <EmptyState compact icon="award" title="No qualifications recorded" /> : (
            <ul className="pc-rows">
              {data.qualifications.map((q) => (
                <li key={q.id} className="pc-row">
                  <div className="pc-row-body">
                    <span className="pc-row-title">{q.type.name}</span>
                    <p className="pc-row-hint">{q.issuedOn ? `Issued ${formatDate(q.issuedOn)}` : "No issue date"}{q.expiresOn ? ` · expires ${formatDate(q.expiresOn)}` : " · does not expire"}{q.reference ? ` · ${q.reference}` : ""}</p>
                  </div>
                  <div className="pc-row-trail"><Tag meta={QUALIFICATION_STATE_META[q.state]} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
