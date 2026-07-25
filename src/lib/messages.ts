import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export async function sendInAppMessage(data: {
  businessId: string;
  senderId: string;
  recipientId: string;
  title: string;
  body: string;
  metadata?: Record<string, Json>;
}) {
  const { error } = await supabase.from("messages").insert({
    business_id: data.businessId,
    sender_id: data.senderId,
    recipient_id: data.recipientId,
    type: "preorder",
    title: data.title,
    body: data.body,
    metadata: data.metadata ?? null,
  });
  if (error) throw error;
}
