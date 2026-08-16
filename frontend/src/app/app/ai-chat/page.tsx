import { PageHeader } from "@/components/shared/page-header";
import { ChatThread } from "@/features/ai-chat/components/chat-thread";

export default function AIChatPage() {
  return (
    <div>
      <PageHeader title="AI Chat" description="Record a transaction by describing it in natural language." />
      <ChatThread />
    </div>
  );
}
