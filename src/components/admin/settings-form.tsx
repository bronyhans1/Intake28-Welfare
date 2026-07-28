"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { updateSettingsAction, type SettingsActionState } from "@/actions/settings";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SystemInformation } from "@/lib/system-settings/info";
import { SETTINGS_CURRENCY_LABELS, SettingsCurrency } from "@/types/enums";
import type { SerializedSystemSettings } from "@/types/settings";

interface SettingsFormProps {
  settings: SerializedSystemSettings;
  systemInfo: SystemInformation;
}

type SettingsFormState = {
  organizationName: string;
  portalName: string;
  supportEmail: string;
  supportPhone: string;
  monthlyDuesAmount: string;
  currency: SettingsCurrency;
  defaultAnnouncementExpiryDays: string;
};

const initialState: SettingsActionState = {};

function buildSettingsFormState(settings: SerializedSystemSettings): SettingsFormState {
  return {
    organizationName: settings.organizationName,
    portalName: settings.portalName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    monthlyDuesAmount: String(settings.monthlyDuesAmount),
    currency: settings.currency,
    defaultAnnouncementExpiryDays: String(settings.defaultAnnouncementExpiryDays),
  };
}

function mapFieldErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

export function SettingsForm({ settings, systemInfo }: SettingsFormProps) {
  const { showSuccess } = useToast();
  const [form, setForm] = useState<SettingsFormState>(() => buildSettingsFormState(settings));
  const [state, formAction, isPending] = useActionState(updateSettingsAction, initialState);

  useEffect(() => {
    setForm(buildSettingsFormState(settings));
  }, [settings]);

  useEffect(() => {
    if (state.success) {
      showSuccess("Settings saved successfully.");
    }
  }, [state.success, showSuccess]);

  function updateField<K extends keyof SettingsFormState>(
    field: K,
    value: SettingsFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
      <form action={formAction} className="space-y-6">
        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Portal branding and member support contact details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!state.fieldErrors?.organizationName}>
                <FieldLabel htmlFor="organizationName">Organization Name</FieldLabel>
                <Input
                  id="organizationName"
                  name="organizationName"
                  value={form.organizationName}
                  onChange={(event) => updateField("organizationName", event.target.value)}
                  required
                />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.organizationName)} />
              </Field>

              <Field data-invalid={!!state.fieldErrors?.portalName}>
                <FieldLabel htmlFor="portalName">Portal Name</FieldLabel>
                <Input
                  id="portalName"
                  name="portalName"
                  value={form.portalName}
                  onChange={(event) => updateField("portalName", event.target.value)}
                  required
                />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.portalName)} />
              </Field>

              <Field data-invalid={!!state.fieldErrors?.supportEmail}>
                <FieldLabel htmlFor="supportEmail">Support Email (optional)</FieldLabel>
                <Input
                  id="supportEmail"
                  name="supportEmail"
                  type="email"
                  value={form.supportEmail}
                  onChange={(event) => updateField("supportEmail", event.target.value)}
                  placeholder="support@example.com"
                />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.supportEmail)} />
              </Field>

              <Field data-invalid={!!state.fieldErrors?.supportPhone}>
                <FieldLabel htmlFor="supportPhone">Support Phone</FieldLabel>
                <Input
                  id="supportPhone"
                  name="supportPhone"
                  type="tel"
                  value={form.supportPhone}
                  onChange={(event) => updateField("supportPhone", event.target.value)}
                  placeholder="+233XXXXXXXXX"
                />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.supportPhone)} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Finance</CardTitle>
            <CardDescription>
              Monthly dues and currency used across finance modules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!state.fieldErrors?.monthlyDuesAmount}>
                <FieldLabel htmlFor="monthlyDuesAmount">Monthly Dues Amount</FieldLabel>
                <Input
                  id="monthlyDuesAmount"
                  name="monthlyDuesAmount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={form.monthlyDuesAmount}
                  onChange={(event) => updateField("monthlyDuesAmount", event.target.value)}
                  required
                />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.monthlyDuesAmount)} />
              </Field>

              <Field data-invalid={!!state.fieldErrors?.currency}>
                <FieldLabel>Currency</FieldLabel>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    updateField("currency", value ?? SettingsCurrency.GHS)
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {SETTINGS_CURRENCY_LABELS[form.currency]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SettingsCurrency).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SETTINGS_CURRENCY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="currency" value={form.currency} />
                <FieldError errors={mapFieldErrors(state.fieldErrors?.currency)} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Communications</CardTitle>
            <CardDescription>
              Defaults for portal announcements and notices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field data-invalid={!!state.fieldErrors?.defaultAnnouncementExpiryDays}>
              <FieldLabel htmlFor="defaultAnnouncementExpiryDays">
                Default Announcement Expiry Days
              </FieldLabel>
              <Input
                id="defaultAnnouncementExpiryDays"
                name="defaultAnnouncementExpiryDays"
                type="number"
                min={1}
                value={form.defaultAnnouncementExpiryDays}
                onChange={(event) =>
                  updateField("defaultAnnouncementExpiryDays", event.target.value)
                }
                required
              />
              <FieldError
                errors={mapFieldErrors(state.fieldErrors?.defaultAnnouncementExpiryDays)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Application version and branding.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-foreground">
            <p>{systemInfo.versionLabel}</p>
            <p className="text-muted-foreground">{systemInfo.poweredByLabel}</p>
          </CardContent>
        </Card>

        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="bg-[#166534] text-white hover:bg-[#14532d]"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </form>
  );
}
