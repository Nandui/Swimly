import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UserRoundCheck } from 'lucide-react';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { InstructorShell } from '@/components/instructor/instructor-shell';
import { AppShell } from '@/components/ui-kit/app-shell';
import { DeckChecklist } from '@/components/progression/deck-checklist';
import { AwaitingMoves } from '@/components/enrolment/awaiting-moves';
import { AwaitingEnrolment } from '@/components/enrolment/awaiting-enrolment';

const query = new URLSearchParams(location.search);
const skills = ['Enter the water safely', 'Float on the front', 'Float on the back'].map((name, i) => ({ id: `skill-${i}`, name, description: null }));
const club = { id: 'bishopstown', name: 'LeisureWorld Bishopstown' };
const people = [{ id: 'avery', firstName: 'Avery', lastName: 'Example', dateOfBirth: null }, { id: 'jamie', firstName: 'Jamie', lastName: 'Example', dateOfBirth: null }];
const original = people.map((student, i) => ({ student, marks: Object.fromEntries(skills.map((skill, n) => [skill.id, !i || !n ? 'ACHIEVED' : null])), readyAt: null, note: null }));
const course = { id: 'example-class', name: null, level: { id: 'turtles', name: 'Turtles' }, dayOfWeek: 'MONDAY', startMinutes: 900, durationMinutes: 30, location: 'Learner pool', club, instructor: { name: 'Alex Example' } };
const targets = [{ ...course, id: 'next-bishopstown', level: { id: 'dolphins', name: 'Dolphins' }, clubId: club.id, capacity: 12, _count: { enrolments: 8 } },
  { ...course, id: 'next-churchfield', level: { id: 'dolphins', name: 'Dolphins' }, club: { id: 'churchfield', name: 'LeisureWorld Churchfield' }, clubId: 'churchfield', capacity: 12, _count: { enrolments: 9 } }];
window.movePreview = { calls: [], async save() { throw Error('Preview not ready'); } };

function Preview() {
  const [swimmers, setSwimmers] = useState(() => JSON.parse(sessionStorage.getItem('synthetic-swimmer-readiness') || 'null') || original);
  useEffect(() => { sessionStorage.setItem('synthetic-swimmer-readiness', JSON.stringify(swimmers)); }, [swimmers]);
  useEffect(() => {
    window.movePreview.save = async (action, ...args) => {
      window.movePreview.calls.push({ action, args });
      await new Promise(resolve => setTimeout(resolve, 180));
      if (query.has('fail')) return { ok: false, error: 'Synthetic connection failure. Please try again.' };
      const input = args[0];
      if (action === 'confirmLevelCompletion' || action === 'cancelInstructorMoveReadiness') {
        setSwimmers(previous => previous.map(s => s.student.id === input.studentId ? { ...s, readyAt: action === 'confirmLevelCompletion' ? new Date().toISOString() : null, note: input.note ?? null } : s));
      } else if (action === 'saveInstructorAssessment') {
        setSwimmers(previous => previous.map(s => ({ ...s, marks: { ...s.marks, ...Object.fromEntries(input.marks.filter(m => m.studentId === s.student.id).map(m => [m.competencyId, m.status])) } })));
      } else if (action === 'transferEnrolment') {
        if (!args[3]) return { ok: false, error: 'Review this move.', confirmation: { title: 'Confirm the move?', description: 'Move this swimmer to the selected class?', choices: [{ value: 'move', label: 'Confirm move' }], ids: [input, args[1]] } };
        setSwimmers(previous => previous.filter(s => `place-${s.student.id}` !== input));
      }
      return { ok: true };
    };
  }, []);
  const checklist = swimmers.map(s => ({ studentId: s.student.id, name: `${s.student.firstName} ${s.student.lastName}`, offLevel: false, completed: Boolean(s.readyAt), marks: s.marks,
    readyToMoveAt: s.readyAt ? new Date(s.readyAt) : null, readyToMoveByName: s.readyAt ? 'Alex Example' : null,
    moveReadinessCurrent: Boolean(s.readyAt && skills.every(skill => s.marks[skill.id] === 'ACHIEVED')) }));
  const items = swimmers.filter(s => s.readyAt).map(s => ({ id: `place-${s.student.id}`, status: 'ACTIVE', readyToMoveAt: new Date(s.readyAt), readyToMoveByName: 'Alex Example', readyToMoveLevelId: 'turtles', readyToMoveNote: s.note,
    student: { ...s.student, memberNumber: `TEST-${s.student.id}`, contactName: 'Sam Example', contactEmail: 'guardian@example.test', contactPhone: null }, course,
    reviewReason: Object.values(s.marks).some(mark => mark !== 'ACHIEVED') ? 'Progress has changed since confirmation. Ask the instructor to review readiness.' : null,
    completedLevelName: 'Turtles', programmeName: 'Water Safety & Fun', nextLevel: { id: 'dolphins', name: 'Dolphins' } }));
  const result = { items: query.has('empty') ? [] : items.filter(row => !query.get('q') || `${row.student.firstName} ${row.student.lastName}`.toLowerCase().includes(query.get('q').toLowerCase())), total: query.has('empty') ? 0 : items.length, q: query.get('q') ?? '', page: 1, pages: 1 };
  const desk = location.pathname === '/awaiting-enrolment';
  return <ThemeProvider initialMode={query.get('theme') || 'light'}><TooltipProvider>{desk ?
    <AppShell wordmark="Aquatics" userName="Reception Example" groups={[{ id: 'daily', label: 'Daily work', items: [{ href: '/awaiting-enrolment', label: 'Awaiting enrolment', icon: UserRoundCheck }] }]} switcher={<span className="text-sm">{club.name}</span>}>
      {query.get('view') === 'moves' ? <AwaitingMoves result={result} courses={targets} enrol={!query.has('read-only')} profiles={false} /> : <AwaitingEnrolment result={{ items: [], total: 0, page: 1, pages: 1, q: '' }} courses={targets} enrol profiles={false} assessments={false} />}
    </AppShell> :
    <InstructorShell userName="Alex Example" club={club} clubs={[club]}><div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Turtles</h1><p className="text-sm text-ui-muted-foreground">Monday · 15:00–15:30 · Learner pool</p></div>
      <DeckChecklist courseId="example-class" date="2026-09-21" levelId="turtles" competencies={skills} swimmers={checklist} attendance={null} readOnly={query.has('read-only')} teaching moveReadiness={query.has('read-only') ? undefined : { levelName: 'Turtles' }} doneHref="/instructor" doneLabel="classes" />
    </div></InstructorShell>}
  </TooltipProvider></ThemeProvider>;
}
createRoot(document.getElementById('root')).render(<Preview />);
