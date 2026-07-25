import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, MessageCircle, Mail, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { loadReceipt, printReceiptWindow, whatsappReceipt, emailReceipt } from "@/lib/receipt";

export function ReceiptActions({
  orderId,
  compact = false,
}: {
  orderId: string;
  compact?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function withReceipt(fn: (r: Awaited<ReturnType<typeof loadReceipt>>) => void) {
    setLoading(true);
    try {
      const r = await loadReceipt(orderId);
      if (!r) return toast.error("Receipt not found");
      fn(r);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size={compact ? "sm" : "default"} variant="outline" className="gap-1.5">
          <ReceiptIcon className="h-3.5 w-3.5" />
          {compact ? "" : "Receipt"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Send receipt</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={loading}
            onClick={() => withReceipt((r) => r && printReceiptWindow(r))}
          >
            <Printer className="h-4 w-4" /> Print
          </Button>
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp phone (with country code)</Label>
            <div className="flex gap-1.5">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="260977..."
                className="h-8"
              />
              <Button
                size="sm"
                disabled={loading}
                onClick={() => withReceipt((r) => r && whatsappReceipt(r, phone))}
                className="shrink-0"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <div className="flex gap-1.5">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guest@example.com"
                className="h-8"
                type="email"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => withReceipt((r) => r && emailReceipt(r, email))}
                className="shrink-0"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
