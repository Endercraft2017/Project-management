import { apiErrorMessage } from '@/lib/api-error';
/**
 * Accept Invitation Page
 * Public page for accepting team invitations and creating accounts
 */

import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useValidateInvite, useAcceptInvite } from '@/hooks/useInvites';
import { cn } from '@/lib/utils';

// Form validation schema
const acceptInviteFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
});

type AcceptInviteFormData = z.infer<typeof acceptInviteFormSchema>;

interface AcceptInvitePageProps {
  token: string;
  onSuccess?: () => void;
}

export default function AcceptInvitePage({ token, onSuccess }: AcceptInvitePageProps) {
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const { data: inviteData, isLoading: isValidating, error: validationError } = useValidateInvite(token);
  const acceptInviteMutation = useAcceptInvite();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (data: AcceptInviteFormData) => {
    try {
      await acceptInviteMutation.mutateAsync({
        token,
        name: data.name,
      });

      setAcceptSuccess(true);

      // Redirect to login after success
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/api/auth/google';
        }
      }, 2000);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleGoogleSignIn = () => {
    // Store token in session storage for Google OAuth flow
    sessionStorage.setItem('invite_token', token);
    sessionStorage.setItem('invite_email', inviteData?.email || '');
    window.location.href = '/api/auth/google';
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-8 shadow-lg">
          <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-4 text-xl font-semibold">Validating invitation...</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please wait while we verify your invitation
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid invitation
  if (validationError || !inviteData || !inviteData.isValid) {
    const errorMessage = inviteData?.status === 'EXPIRED'
      ? 'This invitation has expired'
      : inviteData?.status === 'REVOKED'
      ? 'This invitation has been revoked'
      : inviteData?.status === 'ACCEPTED'
      ? 'This invitation has already been accepted'
      : 'Invalid invitation token';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-red-200 bg-card p-8 shadow-lg">
          <div className="text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h2 className="mt-4 text-2xl font-bold text-red-600">Invalid Invitation</h2>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please contact your team administrator for a new invitation.
            </p>
          </div>
          <div className="pt-4">
            <a
              href="/"
              className="block w-full rounded-md border border-input bg-background px-4 py-2 text-center text-sm font-medium hover:bg-accent"
            >
              Return to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (acceptSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-green-200 bg-card p-8 shadow-lg">
          <div className="text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="mt-4 text-2xl font-bold text-green-600">
              Welcome to {BRAND.name}!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account has been created successfully.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Redirecting you to sign in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Accept invitation form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <Mail className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">Join {BRAND.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You've been invited to join the team!
          </p>
        </div>

        <div className="rounded-md bg-muted p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{inviteData.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>
              Role: <span className="font-medium">{inviteData.role}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Invited by {inviteData.invitedBy}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Choose how to join
              </span>
            </div>
          </div>

          {/* Google Sign-In (Recommended) */}
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google (Recommended)
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Manual Account Creation */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Your Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  {...register('name')}
                  className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    errors.name && 'border-red-500'
                  )}
                />
              </div>
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            {acceptInviteMutation.error && (
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {apiErrorMessage(acceptInviteMutation.error) ||
                        'Failed to accept invitation. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={acceptInviteMutation.isPending}
              className="w-full inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {acceptInviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By joining, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
