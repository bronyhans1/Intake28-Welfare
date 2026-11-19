"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword } from "firebase/auth";
import { createAuthSession } from "@/actions/auth";
import { ServiceNumberInput } from "@/components/forms/service-number-input";
import { PasswordInput } from "@/components/forms/password-input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { AUTH_VERSION_LABEL } from "@/lib/branding/auth";
import { getAuthEmailFromServiceNumber } from "@/lib/auth/auth-email";
import {
  ACCOUNT_INELIGIBLE_ERROR,
  GENERIC_LOGIN_ERROR,
} from "@/lib/auth/login";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginInput } from "@/lib/validators/login";
import { RequestAccessDialog } from "@/components/forms/request-access-dialog";

const inputClassName = cn(
  "h-10",
  "focus-visible:border-[#166534] focus-visible:ring-[#166534]/25",
);

const loginButtonClassName = cn(
  "h-11 w-full rounded-lg bg-[#166534] text-sm font-semibold text-white shadow-sm shadow-[#166534]/20",
  "hover:bg-[#14532d] active:translate-y-0",
  "focus-visible:border-[#14532d] focus-visible:ring-[#166534]/30",
);

const footerLinkClassName = cn(
  "text-muted-foreground underline-offset-4 transition-colors",
  "hover:text-[#166534] hover:underline",
);

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      serviceNumberSuffix: "",
      password: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const serviceNumberInvalid = !!(errors.serviceNumberSuffix || serverError);
  const passwordInvalid = !!(errors.password || serverError);

  function onSubmit(values: LoginInput) {
    if (isPending) return;
    setServerError(null);

    startTransition(async () => {
      const email = getAuthEmailFromServiceNumber(values.serviceNumberSuffix);
      const auth = getFirebaseAuth();

      try {
        const credential = await signInWithEmailAndPassword(
          auth,
          email,
          values.password,
        );
        const idToken = await credential.user.getIdToken(true);
        const session = await createAuthSession(idToken);

        if (!session.success) {
          await auth.signOut();
          setServerError(session.error);
          return;
        }

        router.push(session.redirectTo);
        router.refresh();
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: string }).code)
            : null;

        if (code === "auth/user-disabled") {
          setServerError(ACCOUNT_INELIGIBLE_ERROR);
          return;
        }

        setServerError(GENERIC_LOGIN_ERROR);
      }
    });
  }

  return (
    <Card className="gap-0 rounded-2xl border border-black/[0.08] bg-white shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(7)]">
      <CardContent className="pb-3">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Welcome Back
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage your welfare contributions.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="text-left">
          <FieldGroup className="gap-6">
            <Field data-invalid={serviceNumberInvalid ? true : undefined}>
              <FieldLabel htmlFor="serviceNumberSuffix">Service Number</FieldLabel>
              <ServiceNumberInput
                id="serviceNumberSuffix"
                invalid={serviceNumberInvalid ? true : undefined}
                disabled={isPending}
                {...register("serviceNumberSuffix")}
              />
              <FieldError errors={[errors.serviceNumberSuffix]} />
            </Field>

            <Field data-invalid={passwordInvalid ? true : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-invalid={passwordInvalid ? true : undefined}
                disabled={isPending}
                className={inputClassName}
                {...register("password")}
              />
              <FieldDescription>Minimum 8 characters</FieldDescription>
              <FieldError errors={[errors.password]} />
            </Field>

            {serverError ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                {serverError}
              </div>
            ) : null}

            <div>
              <LoadingButton
                type="submit"
                className={loginButtonClassName}
                loading={isPending}
                loadingText="Signing In..."
              >
                Sign In
              </LoadingButton>

              <p className="mt-3 text-center text-xs leading-none text-muted-foreground">
                {AUTH_VERSION_LABEL}
              </p>

              <p className="mt-2.5 text-center text-xs leading-tight text-muted-foreground">
                New member?{" "}
                <button
                  type="button"
                  onClick={() => setRequestAccessOpen(true)}
                  className="font-medium text-[#166534] underline-offset-4 transition-colors hover:underline"
                >
                  Request Access
                </button>
              </p>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col items-center border-t border-black/[0.08] bg-white py-2.5 text-center text-xs text-muted-foreground">
        <p>
          <Link href="/activate-account" className={footerLinkClassName}>
            Activate Account
          </Link>
          <span aria-hidden className="mx-2 text-muted-foreground/60">
            •
          </span>
          <Link href="/forgot-password" className={footerLinkClassName}>
            Forgot Password
          </Link>
        </p>
      </CardFooter>

      <RequestAccessDialog
        open={requestAccessOpen}
        onOpenChange={setRequestAccessOpen}
      />
    </Card>
  );
}
