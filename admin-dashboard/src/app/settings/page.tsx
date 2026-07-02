"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Settings, CheckCircle2, XCircle, Key, DollarSign, UserPlus } from "lucide-react";

interface ApiKeyStatus {
  name: string;
  description: string;
  configured: boolean;
  maskedValue: string;
}

const API_KEYS: ApiKeyStatus[] = [
  { name: "Stripe Secret Key", description: "Payment processing", configured: true, maskedValue: "sk_****...7a3f" },
  { name: "Google Places API Key", description: "Address autocomplete", configured: false, maskedValue: "—" },
  { name: "Google Maps API Key", description: "Map rendering", configured: false, maskedValue: "—" },
  { name: "Google OAuth Client ID", description: "Social login", configured: true, maskedValue: "****...apps.googleusercontent.com" },
  { name: "SendGrid API Key", description: "Transactional email", configured: false, maskedValue: "—" },
];

const ALL_ROLES = ["Customer", "Vendor", "Admin", "Owner"] as const;

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["Customer"]);

  // Scroll to #create-user section on mount if hash is present
  useEffect(() => {
    if (window.location.hash === "#create-user") {
      const el = document.getElementById("create-user");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const createUserMutation = useMutation({
    mutationFn: () => {
      const [firstName, ...lastParts] = displayName.trim().split(" ");
      const lastName = lastParts.join(" ") || firstName;
      return apiClient("/api/auth/register", {
        method: "POST",
        body: {
          email,
          password,
          firstName,
          lastName,
          roles: selectedRoles,
        },
        skipAuth: false,
      });
    },
    onSuccess: () => {
      toast.success("User created successfully.");
      setEmail("");
      setDisplayName("");
      setPassword("");
      setSelectedRoles(["Customer"]);
    },
    onError: (err: ApiError) => toast.error(err.errors[0]),
  });

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || !password) {
      toast.error("All fields are required.");
      return;
    }
    if (selectedRoles.length === 0) {
      toast.error("Select at least one role.");
      return;
    }
    createUserMutation.mutate();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
      </div>

      {/* Platform Configuration */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Platform Configuration</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          API keys and service integrations status.
        </p>

        <div className="divide-y divide-gray-100">
          {API_KEYS.map((key) => (
            <div key={key.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{key.name}</p>
                <p className="text-xs text-gray-500">{key.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400">{key.maskedValue}</span>
                {key.configured ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Configured
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                    <XCircle className="h-4 w-4 text-red-400" />
                    Not configured
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Fees */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Platform Fees</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Current fee structure applied to all transactions.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Trust & Escrow Fee</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">10%</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Payment Processing</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">2.9% + $0.30</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Total for $100 Job</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">$113.49</p>
            <p className="text-xs text-gray-400 mt-1">$100 + $10 escrow + $3.19 processing + $0.30</p>
          </div>
        </div>
      </section>

      {/* Create Admin User */}
      <section id="create-user" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Create Admin User</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Create a new user with specific roles. The user will appear in the Users list.
        </p>

        <form onSubmit={handleCreateUser} className="space-y-4 max-w-lg">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Smith"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const isSelected = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      isSelected
                        ? "bg-brand-50 border-brand-300 text-brand-700"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={createUserMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {createUserMutation.isPending ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>
    </div>
  );
}
