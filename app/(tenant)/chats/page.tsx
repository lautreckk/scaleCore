"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatList } from "@/components/chat/chat-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { ContactPanel } from "@/components/chat/contact-panel";

interface Instance {
  id: string;
  name: string;
  color: string | null;
}

export default function ChatsPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [showPanel, setShowPanel] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadInstances = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) return;

      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, name, color")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("status", "connected");

      if (data) {
        setInstances(data);
      }
    };

    loadInstances();
  }, [supabase]);

  return (
    <ChatLayout
      sidebar={
        <ChatList
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          instances={instances}
        />
      }
      main={
        <ChatWindow
          chatId={selectedChatId}
          onTogglePanel={() => setShowPanel(!showPanel)}
          showPanelButton={false}
        />
      }
      panel={
        <ContactPanel chatId={selectedChatId} />
      }
      showPanel={showPanel}
      showSidebar={showSidebar}
      selectedChatId={selectedChatId}
      onBackToList={() => setSelectedChatId(null)}
      onToggleSidebar={() => setShowSidebar(!showSidebar)}
      onTogglePanel={() => setShowPanel(!showPanel)}
    />
  );
}
