import React, {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {InstructorShell} from '@/components/instructor/instructor-shell';
import InstructorPage from '@/app/(instructor)/instructor/page';
import {InstructorAssessmentSession} from '@/components/instructor/assessment-session';
import {instructorHomeHref} from '@/lib/attendance/navigation';
import {today,parseDateOnly} from '@/lib/format';

const query=new URLSearchParams(location.search);
// Match the real root layout's server-selected appearance before the first paint.
document.documentElement.dataset.theme=query.get('theme')||'light';
const club={id:'example-site',name:'LeisureWorld Bishopstown'};
const sessions=[
  {id:'example-assessment',startMinutes:600,durationMinutes:30,capacity:8,booked:3,location:'Learner Pool',programmeName:'Water Safety & Fun',typeName:'New swimmer assessment',instructorId:'another-instructor',instructor:{id:'another-instructor',name:'Sam Example'}},
  {id:'unassigned-assessment',startMinutes:720,durationMinutes:30,capacity:null,booked:0,location:null,programmeName:'Swimming Skills',typeName:null,instructorId:null,instructor:null},
];
const bookings=[['avery','Avery','BOOKED'],['jamie','Jamie','BOOKED'],['casey','Casey','ATTENDED'],['morgan','Morgan','NO_SHOW']].map(([id,name,status])=>({
  id,status,bookedByName:'Example Desk',createdAt:new Date(),outcomeLevelId:status==='ATTENDED'?'turtles':null,
  outcomeLevel:status==='ATTENDED'?{id:'turtles',name:'Turtles'}:null,outcomeNote:null,assessedByName:null,assessedOn:null,
  student:{id,firstName:name,lastName:'Example',dateOfBirth:null,medicalNotes:id==='avery'?'Synthetic example: follow the agreed poolside support plan.':null},
}));
const session={...sessions[0],clubId:club.id,club,date:parseDateOnly(today()),notes:'Fictional assessment — no live data.',cancelledAt:null,
  programmeId:'water',programme:{id:'water',name:'Water Safety & Fun',levels:[{id:'starfish',name:'Starfish',sortOrder:0},{id:'turtles',name:'Turtles',sortOrder:2}]},
  typeId:'new',type:{id:'new',name:'New swimmer assessment'},bookings:query.has('empty')?[]:bookings,_count:{bookings:3}};
window.assessmentPreview={sessions:query.has('empty')?[]:sessions,listDates:[],calls:[],fail:false,async save(){throw Error('Not ready')}};
if (query.has('shared')) {
  const level={id:'turtles',name:'Turtles',sortOrder:0,programme:{id:'water',name:'Water Safety & Fun',sortOrder:0}};
  window.assessmentPreview.sessions=[];
  window.assessmentPreview.courses=['shared','deleted','unstarted'].map((id,index)=>({id,name:null,clubId:club.id,level,dayOfWeek:'FRIDAY',startMinutes:600+index*30,durationMinutes:30,location:'Learner Pool',capacity:8,_count:{enrolments:3},instructorId:'example-teacher',instructor:{id:'example-teacher',name:'Alex Example'}}));
  window.assessmentPreview.covers=[['shared',{coverById:'colleague',coverByName:'Sam Example'}],['deleted',{coverById:null,coverByName:'Former Example'}]];
}

function Preview({home}) {
  const [data,setData]=useState(session);
  useEffect(()=>{
    const previous=window.assessmentPreview.save;
    window.assessmentPreview.save=async(action,input)=>{
      window.assessmentPreview.calls.push({action,input});
      if(window.assessmentPreview.fail)return {ok:false,error:'Could not save this assessment. Try again.'};
      if(action==='recordOutcome')setData(old=>({...old,bookings:old.bookings.map(b=>b.id===input.bookingId?{...b,status:'ATTENDED',outcomeLevel:{id:input.levelId,name:input.levelId==='turtles'?'Turtles':'Starfish'},outcomeLevelId:input.levelId,outcomeNote:input.note,assessedByName:'Alex Example'}:b)}));
      else if(action==='markNoShow')setData(old=>({...old,bookings:old.bookings.map(b=>b.id===input?{...b,status:'NO_SHOW'}:b)}));
      else throw Error('Unexpected action');
      return {ok:true};
    };
    return()=>{window.assessmentPreview.save=previous;};
  },[]);
  return <ThemeProvider initialMode={query.get('theme')||'light'}><TooltipProvider><InstructorShell userName="Alex Example" club={club} clubs={[club]}>
    {location.pathname.includes('/assessments/')?<InstructorAssessmentSession session={data} backHref={instructorHomeHref(Object.fromEntries(query))}/>:home}
  </InstructorShell></TooltipProvider></ThemeProvider>;
}
async function mount(){
  const home=await InstructorPage({searchParams:Promise.resolve(Object.fromEntries(query))});
  createRoot(document.getElementById('root')).render(<Preview home={home}/>);
}
mount();
