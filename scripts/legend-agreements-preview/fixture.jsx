import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import {AppShell} from '@/components/ui-kit/app-shell';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {ToastBridge} from '@/lib/toast';
import {LegendAgreements} from '@/components/enrolment/legend-agreements';
import {ManageProfileEnrolments} from '@/components/students/profile-enrolments';
import {EnrolIntoCourse, EnrolInCourseForStudent, PromoteFromWaitlist} from '@/components/enrolment/enrolment-actions';
import {NAV_ITEMS} from '@/lib/nav';

const query=new URLSearchParams(location.search), theme=query.get('theme')==='dark'?'dark':'light';
document.documentElement.dataset.theme=theme;
const site={id:'demo-site',name:'LeisureWorld Bishopstown'};
const student={id:'swimmer-avery',firstName:'Avery',lastName:'Example',memberNumber:'DEMO-001'};
const courses=[
  {id:'demo-course',name:null,clubId:site.id,club:site,level:{id:'turtles',name:'Turtles'},dayOfWeek:'MONDAY',startMinutes:960,durationMinutes:30,location:'Learner Pool',instructor:{name:'Sam Example'},capacity:8,_count:{enrolments:5},archivedAt:null},
  {id:'other-course',name:null,clubId:'demo-other',club:{id:'demo-other',name:'LeisureWorld Churchfield'},level:{id:'turtles',name:'Turtles'},dayOfWeek:'THURSDAY',startMinutes:990,durationMinutes:30,location:'Main Pool',instructor:{name:'Robin Example'},capacity:8,_count:{enrolments:4},archivedAt:null},
  {id:'full-course',name:'Turtles Saturday',clubId:site.id,club:site,level:{id:'turtles',name:'Turtles'},dayOfWeek:'SATURDAY',startMinutes:630,durationMinutes:30,location:'Learner Pool',instructor:null,capacity:8,_count:{enrolments:8},archivedAt:null},
];
const records=['Avery','Jamie','Morgan','Casey'].map((firstName,i)=>({id:`place-${i}`,student:{...student,id:`swimmer-${i}`,firstName,memberNumber:`DEMO-00${i+1}`},course:{...courses[0],startMinutes:960+i*30},startedOn:new Date('2026-09-01'),legendAgreementStatus:i===3?'DONE':i===1?'PENDING':'NEEDS_CHECK',legendAgreementUpdatedAt:i===1||i===3?new Date('2026-09-17T10:00:00Z'):null,legendAgreementUpdatedByName:i===1||i===3?'Sam Example':null}));
const active={id:'active-place',student,status:'ACTIVE',course:courses[0],level:courses[0].level,startedOn:new Date('2026-09-01'),scheduledEndOn:null};
const waiting={...active,id:'waiting-place',status:'WAITLISTED',course:courses[1]};
window.agreementsPreview={calls:[],fail:false,save:async()=>({ok:false,error:'Not ready'})};
function Screen(){
  const [rows,setRows]=useState(query.has('empty')?[]:records);
  useEffect(()=>{ window.agreementsPreview.save=async(action,...args)=>{
    if(action==='searchStudents') return [{...student,status:'ACTIVE',dateOfBirth:null},{...student,id:'swimmer-jamie',firstName:'Jamie',status:'ACTIVE',dateOfBirth:null}];
    window.agreementsPreview.calls.push({action,args});
    if(window.agreementsPreview.fail||action!=='confirmLegendAgreement') return {ok:false,error:'Synthetic save failed. Your details have been kept.'};
    setRows(previous=>previous.map(row=>row.id===args[0]?{...row,legendAgreementStatus:'DONE',legendAgreementUpdatedAt:new Date('2026-09-17T12:30:00Z'),legendAgreementUpdatedByName:'Demo staff'}:row));
    return {ok:true};
  }; },[]);
  if(location.pathname==='/enrol') return <div className="space-y-6"><h1 className="text-2xl font-semibold">Enrolment preview</h1><p>Fictional swimmer: Avery Example</p>
    <div className="flex flex-wrap gap-3"><ManageProfileEnrolments studentId={student.id} active enrolments={[active,waiting]} targets={courses}/>
      <EnrolIntoCourse course={courses[0]} taken={5}/>
      <EnrolInCourseForStudent student={student} courses={courses} label="Enrol from class list"/>
      <PromoteFromWaitlist enrolment={waiting} classLabel="Turtles · Thursday 16:30" variant="button"/></div></div>;
  const q=query.get('q')??'',view=query.get('view')==='done'?'done':'outstanding';
  const matching=rows.filter(row=>`${row.student.firstName} ${row.student.lastName} ${row.student.memberNumber}`.toLowerCase().includes(q.toLowerCase()));
  const items=matching.filter(row=>view==='done'?row.legendAgreementStatus==='DONE':row.legendAgreementStatus!=='DONE');
  const restricted=query.has('restricted');
  return <LegendAgreements result={{items,q,view,total:items.length,pages:1,page:1,outstandingCount:matching.filter(row=>row.legendAgreementStatus!=='DONE').length,doneCount:matching.filter(row=>row.legendAgreementStatus==='DONE').length,siteName:site.name}} canConfirm={!restricted} profiles={!restricted} classes={!restricted}/>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><ToastBridge/>
  <AppShell wordmark="Swimly" homeHref="/legend-agreements" userName="Demo staff" groups={[{id:'daily',label:'Daily work',items:NAV_ITEMS.filter(item=>['calendar','students','courses','assessments','awaiting-enrolment','legend-agreements'].includes(item.screen))}]}
    switcher={<span className="text-sm">{site.name}</span>}><Screen/></AppShell>
</TooltipProvider></ThemeProvider>);
