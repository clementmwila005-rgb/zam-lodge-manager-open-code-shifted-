import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, primaryRole } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Mail, MailOpen, MessageCircle, Pencil } from "lucide-react";

export const Route = createFileRoute("/app/messages")({ component: Messages });

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

function Messages() {
  const { data: me } = useMe();
  const role = primaryRole(me?.roles);
  const isOwner = role === "owner";
  const bizId = me?.profile?.business_id;
  const userId = me?.profile?.id;
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", bizId, userId],
    enabled: !!bizId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("business_id", bizId!)
        .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    if (!bizId || !userId) return;
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", bizId, userId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bizId, userId, qc]);

  const markRead = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", msgId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", bizId, userId] });
      qc.invalidateQueries({ queryKey: ["unread-messages"] });
    },
  });

  function openMessage(msg: Message) {
    setSelected(msg.id);
    if (!msg.read_at) {
      markRead.mutate(msg.id);
    }
  }

  const unreadCount = messages?.filter((m) => !m.read_at).length ?? 0;
  const selectedMsg = messages?.find((m) => m.id === selected);

  return (
    <div className="p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
          {isOwner && <ComposeDialog />}
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-1 rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : messages?.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              No messages yet.
            </div>
          ) : (
            messages?.map((msg) => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-accent/40 ${
                  selected === msg.id ? "bg-accent/60" : ""
                }`}
              >
                {msg.read_at ? (
                  <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${!msg.read_at ? "font-semibold" : ""}`}>
                      {msg.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {msg.body.split("\n")[0]}
                  </div>
                </div>
                {!msg.read_at && <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          {selectedMsg ? (
            <div className="p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{selectedMsg.type}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(selectedMsg.created_at).toLocaleString()}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{selectedMsg.title}</h2>
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                {selectedMsg.body}
              </pre>
            </div>
          ) : (
            <div className="grid h-full min-h-[300px] place-items-center p-8 text-center text-sm text-muted-foreground">
              <div>
                <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                Select a message to read
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeDialog() {
  const { data: me } = useMe();
  const bizId = me?.profile?.business_id;
  const userId = me?.profile?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const staff = useQuery({
    queryKey: ["staff-for-messages", bizId],
    enabled: open && !!bizId,
    queryFn: async () => {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("business_id", bizId!)
        .eq("is_active", true);
      return (profs ?? []).filter((p) => p.id !== userId);
    },
  });

  function toggleStaff(id: string) {
    setSelectedStaff((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (!staff.data) return;
    setSelectedStaff(staff.data.map((s) => s.id));
  }

  async function send() {
    if (!bizId || !userId || !title.trim() || !body.trim() || selectedStaff.length === 0) {
      return toast.error("Title, message, and at least one recipient required");
    }
    setSending(true);
    try {
      let sent = 0;
      for (const rid of selectedStaff) {
        const { error } = await supabase.from("messages").insert({
          business_id: bizId!,
          sender_id: userId!,
          recipient_id: rid,
          type: "custom" as never,
          title: title.trim(),
          body: body.trim(),
        });
        if (!error) sent++;
      }
      if (sent === 0) throw new Error("Failed to send message");
      toast.success(`Message sent to ${sent} staff member${sent > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["unread-messages"] });
      setOpen(false);
      setTitle("");
      setBody("");
      setSelectedStaff([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Pencil className="mr-1 h-3.5 w-3.5" />Compose</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Send message to staff</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Shift reminder" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Type your message..." />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Recipients</Label>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>Select all</Button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {staff.isLoading && <p className="text-xs text-muted-foreground">Loading staff...</p>}
              {staff.data?.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedStaff.includes(s.id)}
                    onChange={() => toggleStaff(s.id)}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  {s.full_name || s.username || "Staff"}
                </label>
              ))}
              {staff.data?.length === 0 && (
                <p className="text-xs text-muted-foreground">No other staff found.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={send} disabled={sending || !title.trim() || !body.trim() || selectedStaff.length === 0}>
            {sending ? "Sending..." : `Send to ${selectedStaff.length || ""} staff`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
