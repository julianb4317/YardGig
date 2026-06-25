"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { hasRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { VendorProfileForm } from "@/components/settings/vendor-profile-form";
import { CustomerProfileForm } from "@/components/settings/customer-profile-form";
import { PaymentMethodsForm } from "@/components/settings/payment-methods-form";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const isVendor = hasRole("Vendor");
  const isCustomer = hasRole("Customer");

  return (
    <AuthGuard>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Tab navigation */}
        <nav className="mt-6 flex border-b" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition",
                activeTab === tab.id
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab panels */}
        <div className="mt-6">
          {activeTab === "profile" && (
            <div id="panel-profile" role="tabpanel" aria-labelledby="tab-profile">
              {isVendor && (
                <section className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">Vendor Profile</h2>
                  <VendorProfileForm />
                </section>
              )}
              {isCustomer && (
                <section className="mb-8">
                  <h2 className="text-lg font-semibold mb-4">Customer Profile</h2>
                  <CustomerProfileForm />
                </section>
              )}
              {isCustomer && (
                <section>
                  <PaymentMethodsForm />
                </section>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications">
              <NotificationPreferencesForm />
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
