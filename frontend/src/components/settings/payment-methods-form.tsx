"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CreditCard, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface PaymentMethod {
  id: string;
  cardLast4: string;
  cardBrand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const cardSchema = z.object({
  cardNumber: z.string().min(13, "Card number required").max(19),
  expMonth: z.number().min(1).max(12),
  expYear: z.number().min(2024).max(2040),
  cvc: z.string().min(3).max(4),
  nameOnCard: z.string().min(2, "Name required"),
});

type CardForm = z.infer<typeof cardSchema>;

export function PaymentMethodsForm() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: methods, isLoading } = useQuery({
    queryKey: ["paymentMethods"],
    queryFn: () => apiClient<PaymentMethod[]>("/api/payments/methods"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/api/payments/methods/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Card removed.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to remove card."),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CardForm>({
    resolver: zodResolver(cardSchema),
  });

  const addMutation = useMutation({
    mutationFn: (data: CardForm) =>
      apiClient<{ id: string; cardLast4: string; cardBrand: string }>("/api/payments/methods", {
        method: "POST",
        body: {
          cardNumber: data.cardNumber.replace(/\s/g, ""),
          expMonth: data.expMonth,
          expYear: data.expYear,
          nameOnCard: data.nameOnCard,
        },
      }),
    onSuccess: () => {
      toast.success("Payment method saved.");
      setShowAddForm(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["paymentMethods"] });
      queryClient.invalidateQueries({ queryKey: ["customerProfile"] });
    },
    onError: (err: ApiError) => toast.error(err.errors[0] ?? "Failed to save card."),
  });

  const brandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case "visa": return "💳 Visa";
      case "mastercard": return "💳 Mastercard";
      case "amex": return "💳 Amex";
      default: return "💳 Card";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Payment Methods</h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus className="h-4 w-4" /> Add Card
          </button>
        )}
      </div>

      {isLoading && <Spinner className="mx-auto" />}

      {methods && methods.length === 0 && !showAddForm && (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No payment methods on file.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700"
          >
            Add Payment Method
          </button>
        </div>
      )}

      {methods && methods.length > 0 && (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm">{brandIcon(m.cardBrand)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">•••• {m.cardLast4}</p>
                  <p className="text-xs text-gray-400">Expires {m.expMonth}/{m.expYear}</p>
                </div>
                {m.isDefault && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Default</span>
                )}
              </div>
              <button
                onClick={() => setDeleteTarget(m.id)}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove card"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <label htmlFor="nameOnCard" className="block text-xs font-medium text-gray-600">Name on Card</label>
            <input id="nameOnCard" {...register("nameOnCard")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="John Doe" />
            {errors.nameOnCard && <p className="mt-0.5 text-xs text-red-600">{errors.nameOnCard.message}</p>}
          </div>
          <div>
            <label htmlFor="cardNumber" className="block text-xs font-medium text-gray-600">Card Number</label>
            <input id="cardNumber" {...register("cardNumber")} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="4242 4242 4242 4242" maxLength={19} />
            {errors.cardNumber && <p className="mt-0.5 text-xs text-red-600">{errors.cardNumber.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="expMonth" className="block text-xs font-medium text-gray-600">Month</label>
              <input id="expMonth" type="number" {...register("expMonth", { valueAsNumber: true })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="12" min={1} max={12} />
            </div>
            <div>
              <label htmlFor="expYear" className="block text-xs font-medium text-gray-600">Year</label>
              <input id="expYear" type="number" {...register("expYear", { valueAsNumber: true })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="2027" min={2024} max={2040} />
            </div>
            <div>
              <label htmlFor="cvc" className="block text-xs font-medium text-gray-600">CVC</label>
              <input id="cvc" {...register("cvc")} type="password" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="123" maxLength={4} />
            </div>
          </div>
          <p className="text-xs text-gray-400">Card details are not stored on our servers. Full Stripe integration coming soon.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {addMutation.isPending && <Spinner className="h-4 w-4 border-white border-t-transparent" />}
              Save Card
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="rounded-md border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this card?"
        description="You'll need to add a new payment method before paying for future jobs."
        confirmLabel="Remove"
        variant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
