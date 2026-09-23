import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import {ThemeProvider} from '@/components/theme-provider';
import {TooltipProvider} from '@/components/shadcn/tooltip';
import {AppShell} from '@/components/ui-kit/app-shell';
import {AwaitingEnrolment} from '@/components/enrolment/awaiting-enrolment';
import {AwaitingMoves} from '@/components/enrolment/awaiting-moves';
import {FollowUpHistory} from '@/components/enrolment/follow-up-history';
import {Notice} from '@/components/ui-kit/notice';
import {NAV_ITEMS} from '@/lib/nav';

const params = new URLSearchParams(location.search), theme=params.get('theme')==='dark'?'dark':'light';
document.documentElement.dataset.theme=theme;
const reader=params.has('reader');
const profileName=({'example-avery':'Avery Example','example-jamie':'Jamie Example','example-morgan':'Morgan Example'})[location.pathname.split('/').at(-1)];
window.followUpPreview={async action(name,...args){while(args.length&&args.at(-1)===undefined)args.pop();const response=await fetch('/preview/action',{method:'POST',headers:{'Content-Type':'application/json','X-Preview-Role':reader?'reader':'reception'},body:JSON.stringify({name,args})});const data=await response.json();if(!response.ok)throw Error(data.error);return data;},refresh(){window.dispatchEvent(new Event('follow-up-refresh'));}};
function Preview(){
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{const load=()=>fetch('/preview/queue'+location.search).then(response=>response.json()).then(payload=>setData(JSON.parse(JSON.stringify(payload),(key,value)=>['queuedOn','assessedOn','createdAt','date','readyToMoveAt'].includes(key)&&typeof value==='string'?new Date(value):value))).catch(()=>setError('Could not load the example queue.'));load();window.addEventListener('follow-up-refresh',load);return()=>window.removeEventListener('follow-up-refresh',load);},[]);
  return <AppShell wordmark="Swimly" homeHref="/awaiting-enrolment" userName="Alex Example" groups={[{id:'daily',label:'Daily work',items:NAV_ITEMS.filter(item=>['awaiting-enrolment'].includes(item.screen))}]} switcher={<span className="text-sm">LeisureWorld Bishopstown</span>}>
    <p className="mb-6 text-xs text-ui-muted-foreground">Follow-up preview · fictional swimmers · isolated database · no messages sent · {reader?'Read-only staff':'Reception'}</p>
    {error?<Notice tone="error" title={error}/>:!data?<p role="status">Loading example swimmers…</p>:profileName?<div className="space-y-6"><h1 className="text-2xl font-semibold">{profileName}</h1><p>Follow-up history remains available from a swimmer’s profile.</p><FollowUpHistory studentId={location.pathname.split('/').at(-1)} name={profileName} canRecord={!reader}/></div>:params.get('view')==='moves'?<AwaitingMoves result={data} courses={[]} enrol={!reader} profiles/>:<AwaitingEnrolment result={data} courses={[]} enrol={!reader} profiles assessments={false}/>}
  </AppShell>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={theme}><TooltipProvider><Preview/></TooltipProvider></ThemeProvider>);
