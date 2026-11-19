"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { createAnnouncementAction, type AnnouncementsActionState } from "@/actions/announcements";
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
import { formatAnnouncementAudienceLabel } from "@/lib/announcements/labels";
import { AnnouncementAudience, AnnouncementStatus } from "@/types/enums";

const initialState: AnnouncementsActionState = {};

function mapFieldErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

export function AnnouncementsNewForm() {
  const [audience, setAudience] = useState<string>(AnnouncementAudience.ALL_MEMBERS);
  const [publishNow, setPublishNow] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createAnnouncementAction,
    initialState,
  );

  return (
    <form action={formAction}>
      <AdminBackLink href="/admin/announcements" label="Back to announcements" />
      <Card className="rounded-2xl border border-black/[0.08] bg-white shadow-sm">
        <CardContent className="pt-6">
          <FieldGroup>
            <Field data-invalid={!!state.fieldErrors?.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" name="title" placeholder="Announcement title" required />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.title)} />
            </Field>

            <Field data-invalid={!!state.fieldErrors?.message}>
              <FieldLabel htmlFor="message">Message</FieldLabel>
              <textarea
                id="message"
                name="message"
                rows={6}
                placeholder="Write the announcement message"
                required
                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <FieldError errors={mapFieldErrors(state.fieldErrors?.message)} />
            </Field>

            <Field data-invalid={!!state.fieldErrors?.audience}>
              <FieldLabel>Audience</FieldLabel>
              <Select
                value={audience}
                onValueChange={(value) => setAudience(value ?? AnnouncementAudience.ALL_MEMBERS)}
              >
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

            <input type="hidden" name="status" value={AnnouncementStatus.DRAFT} />

            <Field>
              <FieldLabel htmlFor="expiresAt">Expires At (optional)</FieldLabel>
              <Input id="expiresAt" name="expiresAt" type="datetime-local" />
            </Field>

            <div className="flex items-center gap-2">
              <input
                id="publishNow"
                type="checkbox"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
                className="size-4 rounded border border-input"
              />
              <input type="hidden" name="publishNow" value={String(publishNow)} />
              <FieldLabel htmlFor="publishNow" className="font-normal">
                Publish Now
              </FieldLabel>
            </div>

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
                  Creating…
                </>
              ) : (
                "Create Announcement"
              )}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
