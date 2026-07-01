"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  isMe: boolean;
}

interface DisputeChatProps {
  disputeId: string;
}

export function DisputeChat({ disputeId }: DisputeChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["disputeMessages", disputeId],
    queryFn: () => apiClient<ChatMessage[]>(`/api/disputes/${disputeId}/messages`),
    enabled: isOpen,
    refetchInterval: isOpen ? 5000 : false,
    staleTime: 0,
    gcTime: 0,
  });

  // Poll for unread count even when chat is closed
  const { data: unreadMessages } = useQuery({
    queryKey: ["disputeMessagesUnread", disputeId],
    queryFn: () => apiClient<ChatMessage[]>(`/api/disputes/${disputeId}/messages?limit=50`),
    enabled: !isOpen,
    refetchInterval: 15000,
    staleTime: 0,
    gcTime: 0,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiClient(`/api/disputes/${disputeId}/messages`, { method: "POST", body: { body } }),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["disputeMessages", disputeId] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to send message."),
  });

  useEffect(() => {
    if (messages && isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMutation.mutate(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadCount = isOpen
    ? (messages?.filter((m) => !m.isMe && !m.isRead).length ?? 0)
    : (unreadMessages?.filter((m) => !m.isMe && !m.isRead).length ?? 0);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        <MessageCircle className="h-4 w-4" />
        Dispute Chat
        {unreadCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">{unreadCount}</span>
        )}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-semibold text-gray-800">Dispute Chat</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">
          Minimize
        </button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-white">
        {isLoading && (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}

        {messages && messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. An admin will respond to your dispute here.</p>
        )}

        {messages?.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.isMe ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[75%] rounded-xl px-3 py-2",
              msg.isMe ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-800"
            )}>
              {!msg.isMe && (
                <p className="text-xs font-medium opacity-70 mb-0.5">{msg.senderName}</p>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <p className={cn("text-xs mt-1 opacity-60", msg.isMe ? "text-right" : "")}>
                {new Date(msg.createdAt.endsWith("Z") ? msg.createdAt : msg.createdAt + "Z").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-gray-50 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={2000}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {sendMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
