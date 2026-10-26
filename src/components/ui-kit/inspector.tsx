"use client";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/shadcn/sheet";

/** Detail without leaving the page (DESIGN.md, Inspector): a glass panel that slides in from the
 *  right on desktop, over the page without dimming it, and a sheet that rises from the bottom on
 *  tablets and phones. A status tag over the title (`title-1`), one line under it, the content,
 *  then the actions at the foot. Radix keeps focus inside and returns it to the block that opened
 *  it; Escape and the ✕ close it. The caller decides every word. Which of the two it is follows
 *  the frame's widths, in kit.css. */
export function Inspector({ open, onOpenChange, status, title, description, children, actions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inspector glass glass-panel" portalClassName="inspector-portal">
        {status ? <div className="inspector-status">{status}</div> : null}
        <SheetTitle className="inspector-title">{title}</SheetTitle>
        {description ? <SheetDescription className="inspector-description">{description}</SheetDescription> : <SheetDescription className="sr-only">Details</SheetDescription>}
        {children ? <div className="inspector-body">{children}</div> : null}
        {actions ? <div className="inspector-actions">{actions}</div> : null}
      </SheetContent>
    </Sheet>
  );
}
