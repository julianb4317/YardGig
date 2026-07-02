"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DisputeDetail {
  id: string;
  disputeNumber: string;
  status: string;
  reason: string;
  description: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  vendorName: string;
  createdAt: string;
  evidence?: string[];
}

interface ChatMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  isMe: boolean;
}

export default function DisputeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [resolution, setResolution] = useState("");
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: dispute, isLoading } = useQuery({
    queryKey: ["admin-dispute", id],
    queryFn: () => apiClient<DisputeDetail>(`/api/admin/disputes/${id}`),
  });

  const { data: messages } = useQuery({
    queryKey: ["admin-dispute-messages", id],
    queryFn: () => apiClient<ChatMessage[]>(`/api/disputes/${id}/messages`),
    refetchInterval: 5000,
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiClient(`/api/admin/disputes/${id}/resolve`, {
        method: "POST",
        body: { resolution },
      }),
    onSuccess: () => {
      toast.success("Dispute resolved.");
      queryClient.invalidateQueries({ queryKey: ["admin-dispute", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: string) =>
      apiClient(`/api/disputes/${id}/messages`, { method: "POST", body: { body } }),
    onSuccess: () => {
      setChatInput("");
      queryClient.invalidateQueries({ queryKey: ["admin-dispute-messages", id] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessageMutation.mutate(chatInput.trim());
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!dispute) {
    return <p className="text-gray-500">Dispute not found.</p>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/disputes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Disputes
      </Link>

      {/* Dispute Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Dispute #{dispute.disputeNumber}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {dispute.status} &middot; Filed {new Date(dispute.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            dispute.status === "Open" ? "bg-amber-50 text-amber-700" :
            dispute.status === "Resolved" ? "bg-green-50 text-green-700" :
            "bg-gray-100 text-gray-600"
          )}>
            {dispute.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Job</p>
            <p className="font-medium text-gray-900">{dispute.jobTitle}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Reason</p>
            <p className="font-medium text-gray-900">{dispute.reason}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Customer</p>
            <p className="font-medium text-gray-900">{dispute.customerName}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Vendor</p>
            <p className="font-medium text-gray-900">{dispute.vendorName}</p>
          </div>
        </div>

        {dispute.description && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{dispute.description}</p>
          </div>
        )}

        {dispute.evidence && dispute.evidence.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Evidence</p>
            <div className="flex flex-wrap gap-2">
              {dispute.evidence.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resolve */}
      {dispute.status !== "Resolved" && dispute.status !== "Closed" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">Resolve Dispute</h3>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Enter resolution notes..."
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <button
            onClick={() => resolveMutation.mutate()}
            disabled={!resolution.trim() || resolveMutation.isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            Resolve
          </button>
        </div>
      )}

      {/* Chat */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-800">Dispute Chat</h3>
        </div>
        <div className="h-64 overflow-y-auto p-4 space-y-3">
          {messages?.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No messages yet.</p>
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
        <div className="border-t bg-gray-50 p-3">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
              }}
              placeholder="Type a message..."
              maxLength={2000}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || sendMessageMutation.isPending}
              className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {sendMessageMutation.isPending ? <Spinner className="h-4 w-4 border-white border-t-transparent" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
