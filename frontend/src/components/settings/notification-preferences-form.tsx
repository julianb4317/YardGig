"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { fetchPreferences, updatePreferences, unsubscribeAll } from "@/lib/api/notifications";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import { hasRole } from "@/lib/auth";

const EVENT_GROUPS = [
  {
    label: "Job Updates",
    events: [
      { type: "vendor.requested", label: "Vendor requests your job", roles: ["Customer"] },
      { type: "job.assigned", label: "Job assigned to you", roles: ["Vendor"] },
      { type: "job.started", label: "Vendor started work", roles: ["Customer"] },
      { type: "job.completed", label: "Job marked completed", roles: ["Customer"] },
      { type: "job.cancelled", label: "Job cancelled", roles: ["Customer", "Vendor"] },
      { type: "job.rescheduled", label: "Schedule changed", roles: ["Vendor"] },
    ],
  },
  {
    label: "Payments",
    events: [
      { type: "payment.captured", label: "Payment processed", roles: ["Customer"] },
      { type: "payment.released", label: "Payment received", roles: ["Vendor"] },
      { type: "payout.completed", label: "Payout to bank", roles: ["Vendor"] },
      { type: "refund.issued", label: "Refund issued", roles: ["Customer"] },
    ],
  },
  {
    label: "Engagement",
    events: [
      { type: "rating.received", label: "New rating received", roles: ["Vendor"] },
      { type: "nudge.unresponsive", label: "Reminder to respond", roles: ["Customer", "Vendor"] },
      { type: "chat.message", label: "New chat message", roles: ["Customer", "Vendor"] },
    ],
  },
];

const CHANNELS = ["email", "push"] as const;

export function NotificationPreferencesForm() {
  const queryClient = useQueryClient();
  const [unsubOpen, setUnsubOpen] = useState(false);

  const { data: prefs, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifPrefs"],
    queryFn: fetchPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      toast.success("Preferences saved.");
      queryClient.invalidateQueries({ queryKey: ["notifPrefs"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to save."),
  });

  const unsubMutation = useMutation({
    mutationFn: unsubscribeAll,
    onSuccess: () => {
      toast.success("Unsubscribed from all non-critical notifications.");
      setUnsubOpen(false);
      queryClient.invalidateQueries({ queryKey: ["notifPrefs"] });
    },
  });

  const isEnabled = (eventType: string, channel: string): boolean => {
    if (!prefs) return true; // Default on
    const pref = prefs.find((p) => p.eventType === eventType && p.channel === channel);
    if (pref) return pref.enabled;
    // Check wildcard
    const wildcard = prefs.find((p) => p.eventType === "*" && p.channel === channel);
    if (wildcard) return wildcard.enabled;
    return true; // Default enabled
  };

  const togglePref = (eventType: string, channel: string) => {
    const current = isEnabled(eventType, channel);
    updateMutation.mutate([{ eventType, channel, enabled: !current }]);
  };

  if (isLoading) return <Spinner className="mx-auto" />;
  if (isError) return <ErrorState message="Failed to load preferences." onRetry={() => refetch()} />;

  return (
    <div className="space-y-8">
      <p className="text-sm text-gray-500">
        Choose how you'd like to be notified. Security and payment failure alerts cannot be disabled.
      </p>

      {EVENT_GROUPS.map((group) => {
        const visibleEvents = group.events.filter((evt) =>
          evt.roles.some((r) => hasRole(r))
        );
        if (visibleEvents.length === 0) return null;

        return (
          <section key={group.label}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{group.label}</h3>
            <div className="space-y-2">
              {visibleEvents.map((evt) => (
                <div key={evt.type} className="flex items-center justify-between rounded-md border border-gray-100 p-3">
                  <span className="text-sm text-gray-700">{evt.label}</span>
                  <div className="flex gap-4">
                    {CHANNELS.map((ch) => (
                      <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled(evt.type, ch)}
                          onChange={() => togglePref(evt.type, ch)}
                          disabled={updateMutation.isPending}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          aria-label={`${evt.label} via ${ch}`}
                        />
                        <span className="text-xs text-gray-500 capitalize">{ch}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="border-t pt-6">
        <button
          onClick={() => setUnsubOpen(true)}
          className="text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Unsubscribe from all non-critical notifications
        </button>
      </div>

      <ConfirmDialog
        open={unsubOpen}
        title="Unsubscribe from all?"
        description="You'll still receive security alerts and payment failure notifications. You can re-enable channels individually later."
        confirmLabel="Unsubscribe All"
        variant="danger"
        isPending={unsubMutation.isPending}
        onConfirm={() => unsubMutation.mutate()}
        onCancel={() => setUnsubOpen(false)}
      />
    </div>
  );
}
