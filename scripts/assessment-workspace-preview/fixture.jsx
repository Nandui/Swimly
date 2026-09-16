import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import {AppShell} from '@/components/ui-kit/app-shell';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {ToastBridge} from '@/lib/toast';
import {SessionDirectory,sessionView} from '@/components/assessments/session-directory';
import {AwaitingEnrolment} from '@/components/enrolment/awaiting-enrolment';
import {AddSession} from '@/components/assessments/session-actions';
import {NAV_ITEMS} from '@/lib/nav';

const query=new URLSearchParams(location.search);
const theme=query.get('theme')==='dark'?'dark':'light';
document.documentElement.dataset.theme=theme;
const restricted=query.has('restricted');
const programme={id:'demo-programme',name:'Water Safety & Fun'};
const type={id:'demo-type',name:'New swimmers',programmeId:programme.id,description:null};
const site={id:'demo-site',name:'LeisureWorld Bishopstown'};
const session=(id,date,count,capacity=8,cancelledAt=null)=>({id,clubId:site.id,club:site,date:new Date(date),startMinutes:960,durationMinutes:30,location:'Learner Pool',capacity,notes:null,cancelledAt,programmeId:programme.id,programme,typeId:type.id,type,instructorId:'demo-instructor',instructor:{id:'demo-instructor',name:'Sam Example'},_count:{bookings:count}});
const sessions=[session('session-past','2026-09-10',4),session('session-today','2026-09-16',5),session('session-full','2026-09-19',8),session('session-cancelled','2026-09-20',0,8,new Date('2026-09-15'))];
const courses=[{id:'demo-course',name:null,clubId:site.id,club:site,level:{id:'turtles',name:'Turtles'},dayOfWeek:'MONDAY',startMinutes:960,durationMinutes:30,location:'Learner Pool',instructor:{name:'Sam Example'},capacity:8,_count:{enrolments:5}}];
const items=['Avery','Jamie','Morgan'].map((firstName,i)=>({id:`booking-${i}`,student:{id:`swimmer-${i}`,firstName,lastName:'Example',memberNumber:`DEMO-${i+1}`,contactName:'Alex Example',contactPhone:'000 000 0000',contactEmail:'guardian@example.test'},queuedOn:new Date('2026-09-10'),assessedOn:i===2?null:new Date('2026-09-10'),outcomeLevel:i===2?null:{id:'turtles',name:'Turtles'},session:i===2?null:{id:'session-past',date:new Date('2026-09-10'),startMinutes:960,programme},programme,waitlists:i===0?[]:[{id:`waitlist-${i}`,createdAt:new Date('2026-09-10'),course:{...courses[0],archivedAt:null}},...(i===2?[{id:'waitlist-second',createdAt:new Date('2026-09-12'),course:{...courses[0],id:'full-course',dayOfWeek:'FRIDAY',archivedAt:null,_count:{enrolments:8}}}]:[])]}));
window.assessmentWorkspace={calls:[],save:async(action,input)=>{window.assessmentWorkspace.calls.push({action,input});return {ok:false,error:'Synthetic save failed. Your details have been kept.'}}};
const setup=location.pathname.endsWith('/setup');
const awaiting=location.pathname.includes('/awaiting-enrolment');
function Screen(){
  if(awaiting) return <AwaitingEnrolment result={{items:query.has('empty')?[]:items,total:query.has('empty')?0:23,page:1,pages:query.has('empty')?1:2,q:query.get('q')??''}} courses={courses} enrol={!restricted} profiles={!restricted} assessments={!restricted}/>;
  return <SessionDirectory sessions={query.has('empty')?[]:sessions} today="2026-09-16" setup={setup} manage={!restricted} view={sessionView(query.get('view'),setup)}
    createAction={setup&&!restricted?<AddSession programmes={[programme]} types={[type]} instructors={[{id:'demo-instructor',name:'Sam Example'}]} today="2026-09-16"/>:null}/>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><ToastBridge/>
  <AppShell wordmark="Swimly" homeHref="/assessments" userName="Demo staff" groups={[{id:'daily',label:'Daily work',items:NAV_ITEMS.filter(item=>['calendar','students','courses','assessments','awaiting-enrolment'].includes(item.screen))}]}
    switcher={<span className="text-sm">{site.name}</span>}><Screen/></AppShell>
</TooltipProvider></ThemeProvider>);
