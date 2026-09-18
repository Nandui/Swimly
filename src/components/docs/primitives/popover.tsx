'use client';
import { PopoverContent as Content } from '@/components/shadcn/popover';
export * from '@/components/shadcn/popover';
export function PopoverContent(props: React.ComponentProps<typeof Content>) { return <Content {...props} portalClassName="turnfin-docs" />; }
