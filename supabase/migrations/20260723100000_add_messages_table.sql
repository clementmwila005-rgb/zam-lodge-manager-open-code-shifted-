-- Create message_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE public.message_type AS ENUM ('preorder');
  END IF;
END
$$;

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        public.message_type NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  metadata    jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_business_id ON public.messages(business_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Sender can insert messages for their business
CREATE POLICY "Sender can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.has_business_access(business_id)
  );

-- Recipient can read their own messages
CREATE POLICY "Recipient can read own messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = recipient_id
    AND public.has_business_access(business_id)
  );

-- Sender can read messages they sent (to see delivery status)
CREATE POLICY "Sender can read own sent messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() = sender_id
    AND public.has_business_access(business_id)
  );

-- Recipient can mark messages as read (update read_at)
CREATE POLICY "Recipient can mark as read"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() = recipient_id
    AND public.has_business_access(business_id)
  )
  WITH CHECK (
    auth.uid() = recipient_id
    AND public.has_business_access(business_id)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
