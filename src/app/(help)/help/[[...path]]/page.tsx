import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HelpFrame } from "@/components/help/help-frame";
import { HelpBrowser } from "@/components/help/help-browser";
import { HelpArticleView } from "@/components/help/help-article";
import { articlesForScope, summarizeArticle } from "@/lib/help/catalogue";
import { helpPage } from "@/lib/help/access";
import { helpFilters } from "@/lib/help/search";
import type { HelpScope } from "@/lib/help/types";

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function resolveHelp({ params, searchParams }: Props) {
  const { path = [] } = await params;
  const query = await searchParams;
  const scope: HelpScope = path[0] === "instructor" ? "instructor" : "desk";
  const segments = scope === "instructor" ? path.slice(1) : path;
  const slug = segments[0];
  const filters = helpFilters(typeof query.q === "string" ? query.q : undefined, typeof query.topic === "string" ? query.topic : undefined);
  const access = await helpPage(scope, slug, filters);
  if (segments.length > 1) notFound();
  const articles = articlesForScope(scope);
  const article = articles.find(item => item.slug === slug);
  if (slug && !article) notFound();
  return { scope, access, filters, articles, article };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { article, scope } = await resolveHelp(props);
  return { title: article ? `${article.title} · Help` : scope === "instructor" ? "Instructor help" : "Help centre" };
}

export default async function HelpPage(props: Props) {
  const { scope, access, filters, articles, article } = await resolveHelp(props);
  return <HelpFrame scope={scope} home={access.home}>
    {article ? <HelpArticleView article={article} related={articles.filter(item => article.related.includes(item.slug))} scope={scope} filters={filters} action={access.action(article)} /> :
      <Suspense fallback={<p role="status">Loading help guides…</p>}><HelpBrowser articles={articles.map(summarizeArticle)} scope={scope} /></Suspense>}
  </HelpFrame>;
}
