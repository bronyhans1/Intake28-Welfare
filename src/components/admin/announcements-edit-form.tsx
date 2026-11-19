"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { updateAnnouncementAction, type AnnouncementsActionState } from "@/actions/announcements";
import { AdminBackLink } from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  formatAnnouncementAudienceLabel,
  formatAnnouncementStatusLabel,
} from "@/lib/announcements/labels";
import { AnnouncementAudience, AnnouncementStatus } from "@/types/enums";
import type { SerializedAnnouncement } from "@/types/announcement";

function toDateTimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface AnnouncementsEditFormProps {
  record: SerializedAnnouncement;
  canArchive: boolean;
}

const initialState: AnnouncementsActionState = {};

function mapFieldErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

export function AnnouncementsEditForm({
  record,
  canArchive,
}: AnnouncementsEditFormProps) {
  const [audience, setAudience] = useState(record.audience);
  const [status, setStatus] = useState(record.status);
  const boundAction = updateAnnouncementAction.bind(null, record.id);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const statusOptions = Object.values(AnnouncementStatus).filter(
    (value) => canArchive || value !== AnnouncementStatus.ARCHIVED,
  );

  return (
    <form action={formAction}>
      <AdminBackLink
        href={`/admin/announcements/${record.id}`}
        label="Back to announcement"
      />
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <FieldGroup>
            <Field data-invalid={!!state.fieldErrors?.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                name="title"
                defaultValue={record.title}
                required
              />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.title)} />
            </Field>

            <Field data-invalid={!!state.fieldErrors?.message}>
              <FieldLabel htmlFor="message">Message</FieldLabel>
              <textarea
                id="message"
                name="message"
                rows={6}
                defaultValue={record.message}
                required
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.message)} />
            </Field>

            <Field data-invalid={!!state.fieldErrors?.audience}>
              <FieldLabel>Audience</FieldLabel>
              <Select value={audience} onValueChange={(value) => setAudience(value ?? record.audience)}>
                <SelectTrigger>
                  <SelectValue>
                    {formatAnnouncementAudienceLabel(audience)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AnnouncementAudience).map((value) => (
                    <SelectItem key={value} value={value}>
                      {formatAnnouncementAudienceLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="audience" value={audience} />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.audience)} />
            </Field>

            <Field data-invalid={!!state.fieldErrors?.status}>
              <FieldLabel>Status</FieldLabel>
              <Select value={status} onValueChange={(value) => setStatus(value ?? record.status)}>
                <SelectTrigger>
                  <SelectValue>
                    {formatAnnouncementStatusLabel(status)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {formatAnnouncementStatusLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="status" value={status} />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.status)} />
            </Field>

            <Field>
              <FieldLabel htmlFor="expiresAt">Expires At</FieldLabel>
              <Input
                id="expiresAt"
                name="expiresAt"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(record.expiresAt)}
              />
            </Field>

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
                "Save Changes"
              )}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
