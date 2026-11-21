import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantChat } from "@/components/site/assistant-chat";
import { getI18n } from "@/lib/i18n/server";
import { getSuggestedQuestions } from "@/lib/public-api";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.meta.assistant,
    description: t.meta.assistantDesc,
    openGraph: { title: t.meta.assistant, description: t.meta.assistantDesc, url: "/assistant" },
  };
}

export default async function AssistantPage() {
  const suggestions = await getSuggestedQuestions();
  return (
    <Suspense>
      <AssistantChat suggestions={suggestions} />
    </Suspense>
  );
}
