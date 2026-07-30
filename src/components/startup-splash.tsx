import { useEffect, useState } from "react";
import { useSiteBrand } from "#/context/site-brand-provider";
import { m } from "#/paraglide/messages";

const MINIMUM_VISIBLE_MS = 1_000;
const RANDOM_VISIBLE_MS = 1_500;
const FADE_DURATION_MS = 350;

type SplashPhase = "visible" | "fading" | "hidden";

export function StartupSplash() {
	const brand = useSiteBrand();
	const [phase, setPhase] = useState<SplashPhase>("visible");

	useEffect(() => {
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		let fadeTimer: ReturnType<typeof setTimeout> | undefined;
		let hideTimer: ReturnType<typeof setTimeout> | undefined;

		const hideImmediately = () => {
			if (fadeTimer) clearTimeout(fadeTimer);
			if (hideTimer) clearTimeout(hideTimer);
			setPhase("hidden");
		};

		const handleMotionPreference = () => {
			if (reducedMotion.matches) hideImmediately();
		};

		if (reducedMotion.matches) {
			hideImmediately();
		} else {
			const visibleFor = MINIMUM_VISIBLE_MS + Math.random() * RANDOM_VISIBLE_MS;
			fadeTimer = setTimeout(() => {
				setPhase("fading");
				hideTimer = setTimeout(() => setPhase("hidden"), FADE_DURATION_MS);
			}, visibleFor);
			reducedMotion.addEventListener("change", handleMotionPreference);
		}

		return () => {
			if (fadeTimer) clearTimeout(fadeTimer);
			if (hideTimer) clearTimeout(hideTimer);
			reducedMotion.removeEventListener("change", handleMotionPreference);
		};
	}, []);

	if (phase === "hidden") return null;

	return (
		<output
			aria-label={`${brand.name} ${m.common_loading()}`}
			aria-live="polite"
			className="startup-splash"
			data-phase={phase}
		>
			<img
				alt={brand.name}
				className="startup-splash-logo"
				draggable={false}
				height={144}
				src={brand.logoUrl}
				width={144}
			/>
			<div aria-hidden="true" className="startup-splash-track">
				<span className="startup-splash-bar" />
			</div>
		</output>
	);
}
