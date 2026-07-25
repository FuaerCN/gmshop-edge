import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Input, Password } from "#/components/pro/base/fields/input";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { authClient } from "#/features/auth/auth-client";
import { useAuthAnimation } from "#/features/auth/components/auth-animation-context";
import { signInErrorMessage } from "#/features/auth/error-message";
import { listPublicAuthProvidersFn } from "#/features/auth/server/provider-admin";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
	redirectTo?: string;
}

export function UserAuthForm({
	className,
	redirectTo = "/",
	...props
}: UserAuthFormProps) {
	const [isLoading, setIsLoading] = useState(false);
	const animation = useAuthAnimation();
	const navigate = useNavigate();
	const providers = useQuery({
		queryKey: ["public", "auth-providers"],
		queryFn: () => listPublicAuthProvidersFn(),
		staleTime: 30_000,
	});
	const externalProviders =
		providers.data?.filter(
			(provider) => provider.providerType !== "email_password",
		) ?? [];
	const formSchema = z.object({
		email: z.email({
			error: (iss) => (iss.input === "" ? m.auth_email_required() : undefined),
		}),
		password: z
			.string()
			.min(1, m.auth_password_required())
			.min(12, m.auth_password_min()),
	});

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: { onSubmit: formSchema },
		onSubmit: ({ value }) => signIn(value),
	});

	function signIn(data: z.infer<typeof formSchema>) {
		setIsLoading(true);
		if (typeof window !== "undefined") {
			window.sessionStorage.setItem("gmshop.post_auth_redirect", redirectTo);
		}

		toast.promise(
			authClient.signIn.email({
				email: data.email,
				password: data.password,
				callbackURL: redirectTo,
			}),
			{
				loading: m.auth_signingIn(),
				success: (result) => {
					setIsLoading(false);
					if (result.error) throw result.error;
					navigate({ to: redirectTo, replace: true });
					return m.auth_welcomeBack({ email: data.email });
				},
				error: (error) => {
					setIsLoading(false);
					return signInErrorMessage(error);
				},
			},
		);
	}

	return (
		<div className="grid gap-4">
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
				className={cn("grid gap-3", className)}
				{...props}
			>
				<form.Field name="email">
					{(field) => {
						const error = field.state.meta.errors[0]?.message;
						return (
							<div className="grid gap-2">
								<Label htmlFor="sign-in-email">{m.common_email()}</Label>
								<Input
									id="sign-in-email"
									name={field.name}
									value={field.state.value}
									aria-describedby={error ? "sign-in-email-error" : undefined}
									aria-invalid={Boolean(error)}
									placeholder="name@example.com"
									onBlur={() => {
										animation.setIsTyping(false);
										field.handleBlur();
									}}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									onFocus={() => animation.setIsTyping(true)}
								/>
								{error ? (
									<p
										className="text-sm text-destructive"
										id="sign-in-email-error"
									>
										{error}
									</p>
								) : null}
							</div>
						);
					}}
				</form.Field>
				<form.Field name="password">
					{(field) => {
						const error = field.state.meta.errors[0]?.message;
						return (
							<div className="relative grid gap-2">
								<Label htmlFor="sign-in-password">{m.common_password()}</Label>
								<Password
									id="sign-in-password"
									name={field.name}
									value={field.state.value}
									aria-describedby={
										error ? "sign-in-password-error" : undefined
									}
									aria-invalid={Boolean(error)}
									placeholder="********"
									onBlur={() => {
										animation.setIsTyping(false);
										field.handleBlur();
									}}
									onChange={(event) => {
										animation.setPasswordLength(event.target.value.length);
										field.handleChange(event.currentTarget.value);
									}}
									onFocus={() => animation.setIsTyping(true)}
									onVisibilityChange={animation.setShowPassword}
								/>
								{error ? (
									<p
										className="text-sm text-destructive"
										id="sign-in-password-error"
									>
										{error}
									</p>
								) : null}
								<div className="flex justify-end">
									<Button
										asChild
										className="h-auto px-0 py-0"
										size="sm"
										variant="link"
									>
										<Link to="/forgot-password">
											{m.auth_forgot_password()}
										</Link>
									</Button>
								</div>
							</div>
						);
					}}
				</form.Field>
				<Button className="mt-2" disabled={isLoading}>
					{isLoading ? <Loader2 className="animate-spin" /> : <LogIn />}
					{m.auth_submit()}
				</Button>
			</form>
			{externalProviders.length ? (
				<>
					<div className="flex items-center gap-3 text-muted-foreground text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
						{m.auth_or_continue_with()}
					</div>
					<div className="grid gap-2">
						{externalProviders.map((provider) => (
							<Button
								key={provider.providerId}
								type="button"
								variant="outline"
								onClick={() => void signInWithProvider(provider)}
							>
								{provider.icon?.startsWith("/") ? (
									<img
										alt=""
										className="size-5 rounded-sm object-contain"
										src={provider.icon}
									/>
								) : null}
								{m.auth_continue_with({ provider: provider.displayName })}
							</Button>
						))}
					</div>
				</>
			) : null}
			<Button asChild variant="link">
				<Link to="/register">{m.auth_create_account()}</Link>
			</Button>
			<TelegramMiniAppSignIn
				providers={providers.data ?? []}
				redirectTo={redirectTo}
			/>
		</div>
	);

	async function signInWithProvider(provider: {
		providerId: string;
		providerType: string;
	}) {
		if (typeof window !== "undefined")
			window.sessionStorage.setItem("gmshop.post_auth_redirect", redirectTo);
		if (provider.providerType === "social") {
			await authClient.signIn.social({
				provider: provider.providerId as
					| "apple"
					| "discord"
					| "github"
					| "google"
					| "line"
					| "microsoft"
					| "telegram"
					| "wechat",
				callbackURL: redirectTo,
			});
			return;
		}
		throw new Error("unsupported_auth_provider");
	}
}

function TelegramMiniAppSignIn({
	providers,
	redirectTo,
}: {
	providers: Array<{
		providerId: string;
		providerType: string;
		telegramMiniAppEnabled: boolean;
	}>;
	redirectTo: string;
}) {
	const navigate = useNavigate();
	const provider = providers.find(
		(item) => item.providerId === "telegram" && item.telegramMiniAppEnabled,
	);
	useEffect(() => {
		const telegram = (
			window as typeof window & {
				Telegram?: { WebApp?: { initData?: string } };
			}
		).Telegram?.WebApp;
		if (!provider || !telegram?.initData) return;
		const controller = new AbortController();
		void authClient
			.signInWithMiniApp(telegram.initData, {
				signal: controller.signal,
			})
			.then((result) => {
				if (!result.error) void navigate({ to: redirectTo, replace: true });
			});
		return () => controller.abort();
	}, [navigate, provider, redirectTo]);
	return null;
}
