import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import {AnalyticsDashboard} from '@/components/analytics/dashboard';
import {ReceptionReport} from '@/components/analytics/reception-report';
import {InstructorReport} from '@/components/analytics/instructor-report';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {AppShell} from '@/components/ui-kit/app-shell';
import {analyticsPeriod, activityTotals} from '@/lib/analytics/rules';
import {instructorAttendanceTotals, staffActivityTotals} from '@/lib/analytics/reports';
import {ChartNoAxesCombined} from 'lucide-react';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = theme;
const now = new Date('2026-09-17T12:00:00Z');
const period = analyticsPeriod(now);
const common = {siteName: 'Example Pool', period, updatedAt: now.toISOString()};
const staffRows = [
  {actorId: 'alex', actorName: 'Alex Example', day: period.days[0], enrolled: 8, withdrawn: 2},
  {actorId: 'alex', actorName: 'Alex Example', day: period.days[2], enrolled: 3, withdrawn: 0},
  {actorId: 'robin', actorName: 'Robin Example', day: period.days[1], enrolled: 5, withdrawn: 1},
  {actorId: null, actorName: 'Scheduled unenrolment', day: period.days[3], enrolled: 0, withdrawn: 2},
];
const occurrence = {courseId: 'example-class', date: period.days[0], className: 'Starfish', location: 'Learner pool', startMinutes: 930, durationMinutes: 30,
  instructorId: 'jamie', instructorName: 'Jamie Example', scheduledName: 'Jamie Example', started: true, cancelled: false,
  expected: 8, marked: 8, present: 6, absent: 1, late: 1, savedBy: ['Jamie Example'], lastSavedAt: new Date('2026-09-14T15:00:00Z')};
const classes = [
  occurrence,
  {...occurrence, courseId: 'missing', className: 'Penguins', date: period.days[1], marked: 0, started: false, savedBy: [], lastSavedAt: null},
  {...occurrence, courseId: 'partial', className: 'Turtles', date: period.days[2], marked: 4, present: 3, absent: 1, late: 0, instructorId: 'casey', instructorName: 'Casey Example', savedBy: ['Alex Example', 'Casey Example']},
  {...occurrence, courseId: 'cancelled', className: 'Dolphins', date: period.days[2], marked: 0, cancelled: true, savedBy: [], lastSavedAt: null},
  {...occurrence, courseId: 'empty', className: 'Sharks 1', date: period.days[2], expected: 0, marked: 0, savedBy: [], lastSavedAt: null},
  {...occurrence, courseId: 'running', className: 'Sharks 2', date: period.days[3], startMinutes: 770, marked: 0, instructorId: 'casey', instructorName: 'Casey Example', scheduledName: 'Casey Example', savedBy: [], lastSavedAt: null},
  {...occurrence, courseId: 'future', className: 'Starfish (Saturday)', date: period.days[5], marked: 0, savedBy: [], lastSavedAt: null},
];
const empty = params.has('empty');
const people = staffActivityTotals(period.days, empty ? [] : staffRows);
const dailyRows = period.days.map(day => ({day, enrolled: staffRows.filter(row => row.day === day).reduce((sum,row) => sum + row.enrolled, 0), withdrawn: staffRows.filter(row => row.day === day).reduce((sum,row) => sum + row.withdrawn, 0)}));
const dashboard = {...common, swimmers: 24, places: 26, ...activityTotals(period.days, empty ? [] : dailyRows), canOpenCancellations: true,
  cancellations: {sessions: 3, pending: 2, notified: 1, affectedPlaces: 24}, groups: [{id:'water-safety',name:'Water Safety & Fun',levels: ['Starfish','Penguins','Turtles','Dolphins'].map((name,index) => ({id:name,name,count:6+index,capacity:16,percentage:(6+index)/16*100,classes:2,archived:false}))}]};
const instructors = {...common, ...instructorAttendanceTotals(empty ? [] : classes, now), canOpenClasses: !params.has('restricted')};
const content = location.pathname.endsWith('/reception') ? <ReceptionReport data={{...common,people}} />
  : location.pathname.endsWith('/instructors') ? <InstructorReport data={instructors} /> : <AnalyticsDashboard data={dashboard} />;
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider>
  <AppShell wordmark="Swimly" homeHref="/analytics" groups={[{id:'monitoring',label:'Monitoring',items:[{label:'Analytics',href:'/analytics',icon:ChartNoAxesCombined}]}]} userName="Alex Example">{content}</AppShell>
</TooltipProvider></ThemeProvider>);
