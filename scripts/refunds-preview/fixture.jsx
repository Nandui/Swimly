import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/shadcn/tooltip';
import { RefundShell } from '@/components/refunds/shell';
import '@/app/docs/docs.css';
import '@/app/docs/integration.css';
import '@/app/docs/brand.css';
import '@/app/refunds/refunds.css';
import './preview.css';
import { RefundQueue } from '@/components/refunds/queue';
import { RefundDetail } from '@/components/refunds/detail';
import { RefundRequestForm } from '@/components/refunds/request-form';
import { RefundSelect } from '@/components/refunds/fields';
import { Notice } from '@/components/ui-kit/notice';

const role = sessionStorage.getItem('refund-preview-role') || 'reception';
const initialTheme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.dataset.theme = initialTheme;
window.refundPreview = { role, async action(name, ...args) {
  return (await fetch('/preview/action', { method:'POST', headers:{'Content-Type':'application/json','X-Preview-Role':role}, body:JSON.stringify({name,args}) })).json();
}};
// Receipt uploads use the same isolated API transport as their app component.
const fetchOriginal = window.fetch.bind(window);
window.fetch = (url, options={}) => fetchOriginal(url, { ...options, headers:{...options.headers,'X-Preview-Role':role} });
function Preview() {
  const [data,setData] = useState(null), [error,setError] = useState('');
  useEffect(()=>{ fetch(`/preview/data?href=${encodeURIComponent(location.pathname+location.search)}`).then(async response=>{const payload=await response.json();if(!response.ok)throw Error(payload.error);setData(payload)}).catch(error=>setError(error.message));},[]);
  return <div className="refund-preview"><div className="refund-preview-controls flex flex-wrap items-end justify-between gap-3 border-b border-ui-border bg-ui-background p-4"><p className="text-sm text-ui-muted-foreground">Refunds preview · fictional customers · isolated database · no real emails</p><div className="w-56"><RefundSelect id="preview-role" label="Preview as" value={role} onChange={next=>{sessionStorage.setItem('refund-preview-role',next);location.reload()}} options={[{value:'reception',label:'Reception — Alex Example'},{value:'finance',label:'Finance — Riley Example'},{value:'reader',label:'Read-only staff'}]} /></div></div>
    <RefundShell who={data?.who || {id:'preview-'+role,name:'Example staff',request:role==='reception',review:role==='finance',process:role==='finance'}}>
      {error ? <Notice tone="error" title={error} /> : !data ? <p role="status">Loading the example workspace…</p> : data.kind==='queue' ? <RefundQueue data={data.queue} /> : data.kind==='new' ? <div className="refund-new"><div className="refund-heading"><h1 className="text-2xl font-semibold">New refund request</h1><p className="text-sm text-ui-muted-foreground">Send the details to finance. They will review the request and record the refund once paid.</p></div><RefundRequestForm id={data.id} sites={data.sites} /></div> : <RefundDetail data={data.detail} sites={data.sites} who={data.who} />}
    </RefundShell></div>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider initialMode={initialTheme}><TooltipProvider><Preview /></TooltipProvider></ThemeProvider>);
