import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { Button } from '@/components/shadcn/button';
import { InstructorShell } from '@/components/instructor/instructor-shell';
import { DeckChecklist } from '@/components/progression/deck-checklist';

const query = new URLSearchParams(location.search);
const skills = [
  'Enter the water safely', 'Blow bubbles with face in water',
  'Float on the front', 'Float on the back',
  'Swim five metres on the front', 'Exit the water safely',
].map((name, i) => ({ id: `skill-${i + 1}`, name, description: null }));
if (query.has('long')) {
  skills[4] = { ...skills[4], name: 'Swim five metres on the front with a controlled breathing pattern and a safe finish', description: 'Demonstrate the whole competency confidently, without support. Give the swimmer time to practise each part before recording achievement.' };
}
const people = [
  ['avery', 'Avery Example', 2], ['jamie', 'Jamie Example', 4],
  ['casey', 'Casey Example', 2], ['riley', 'Riley Example', 1],
  ['morgan', 'Morgan Example', 3],
].map(([studentId, name, count]) => ({studentId, name,
  offLevel: studentId === 'riley', completed: false,
  marks: Object.fromEntries(skills.map((c, i) => [c.id, i < count ? 'ACHIEVED' : null])),
}));
if (query.has('long')) people[1].name = 'Jamie Alexandra Example-Montgomery';
const attendance = {avery:'PRESENT',jamie:'PRESENT',casey:'LATE',riley:'PRESENT',morgan:'ABSENT'};
const club = {id:'example-site',name:'LeisureWorld Bishopstown'};
window.swimmerPreview = {calls:[],saveMode:'success', async save(){throw Error('Preview not ready');}};

function Preview() {
  const [swimmers, setSwimmers] = useState(people);
  useEffect(() => {
    const previousSave = window.swimmerPreview.save;
    window.swimmerPreview.save = async (action, input) => {
    window.swimmerPreview.calls.push({action, input});
    if (!['saveInstructorAssessment','saveClassAssessment'].includes(action)) throw Error('Unexpected action');
    await new Promise(resolve => setTimeout(resolve, window.swimmerPreview.saveMode === 'slow' ? 1000 : 100));
    if (window.swimmerPreview.saveMode === 'error') return {ok:false,error:'Could not save these marks. Your changes are still here. Try again.'};
    if (window.swimmerPreview.saveMode === 'offline') throw Error('Synthetic connection failure');
    setSwimmers(previous => previous.map(s => ({...s,marks:{...s.marks,...Object.fromEntries(input.marks.filter(m=>m.studentId===s.studentId).map(m=>[m.competencyId,m.status]))}})));
    return {ok:true};
    };
    return () => { window.swimmerPreview.save = previousSave; };
  }, []);
  return <ThemeProvider initialMode={query.get('theme') || 'light'}><TooltipProvider>
    <InstructorShell userName="Alex Example" club={club} clubs={[club]}>
      <div className="flex flex-col gap-6">
        <div className="space-y-1"><h1 className="text-2xl font-semibold">Turtles</h1>
          <p className="text-sm text-ui-muted-foreground">Saturday 19 September · 10:10–10:40 · Lane 4</p>
          <p className="text-sm text-ui-muted-foreground">Preview with fictional swimmers · No live changes</p>
        </div>
        <nav aria-label="Class steps" className="flex gap-2 border-b border-ui-border pb-3">
          <Button variant="ghost">1. Attendance</Button><Button variant="secondary" aria-current="step">2. Competencies</Button>
        </nav>
        <DeckChecklist courseId={query.get('course') || 'example-class'} date="2026-09-19" levelId="example-level"
          competencies={query.get('empty') === 'competencies' ? [] : skills}
          swimmers={query.get('empty') === 'roster' ? [] : swimmers}
          attendance={query.has('no-attendance') ? null : attendance}
          readOnly={query.has('read-only')} teaching={!query.has('desk')}
          doneHref="/instructor" doneLabel="classes" />
      </div>
    </InstructorShell>
  </TooltipProvider></ThemeProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
