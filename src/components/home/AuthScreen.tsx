import { useState } from "react";
import { FiArrowRight, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import { authConfigured, authMessage, resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from "../../lib/auth";
import { cn } from "../../lib/cn";
import { Logo } from "../TopBar";
import { BRAND } from "../../data/brand";
import { CreatorLink } from "../CreatorLink";
import { TemplatePreview } from "./TemplatePreview";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const SHOWCASE = [
  { t: "sale", frame: { platformId: "instagram", variantId: "square", w: 1080, h: 1080 }, cls: "left-[6%] top-[12%] h-56 w-56 -rotate-6 animate-float" },
  { t: "event", frame: { platformId: "instagram", variantId: "story", w: 1080, h: 1920 }, cls: "right-[8%] top-[6%] h-80 w-44 rotate-6 animate-float-slow" },
  { t: "quote", frame: { platformId: "linkedin", variantId: "square", w: 1200, h: 1200 }, cls: "left-[30%] top-[36%] h-44 w-44 rotate-3 animate-float-slow" },
  { t: "soon", frame: { platformId: "instagram", variantId: "reel", w: 1080, h: 1920 }, cls: "right-[30%] top-[44%] h-48 w-28 -rotate-3 animate-float" },
];

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passOk = password.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!emailOk) return setError("Please enter a valid email address.");
    if (!passOk) return setError("Your password needs at least 8 characters.");
    setBusy("email");
    try {
      if (mode === "signup") await signUpWithEmail(name.trim(), email.trim(), password);
      else await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const forgot = async () => {
    setError(null);
    if (!emailOk) return setError("Type your email above first, then press “Forgot password?”.");
    try {
      await resetPassword(email.trim());
      setInfo(`We sent a reset link to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setError(authMessage(err));
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* form */}
      <div className="thin-scroll flex w-full flex-col overflow-y-auto px-8 py-8 lg:w-[480px] lg:shrink-0 lg:px-14">
        <Logo />
        <div className="my-auto py-10">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-zinc-500">{mode === "signin" ? "Sign in to pick up where you left off." : "Design posts, carousels and reels for every brand you run."}</p>

          {!authConfigured && (
            <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              <b>Local mode.</b> Online accounts aren't connected yet, so your profile and designs are kept only in this browser.
            </p>
          )}

          <button
            type="button"
            onClick={google}
            disabled={!!busy || !authConfigured}
            title={authConfigured ? undefined : "Available once online accounts are connected"}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon />
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="my-6 flex items-center gap-3 text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            <span className="h-px flex-1 bg-zinc-200" /> or with email <span className="h-px flex-1 bg-zinc-200" />
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            {mode === "signup" && (
              <Field icon={<FiUser />} label="Your name">
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Alex Morgan" className="w-full bg-transparent text-sm outline-none" />
              </Field>
            )}
            <Field icon={<FiMail />} label="Email" invalid={!!email && !emailOk}>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@studio.com" className="w-full bg-transparent text-sm outline-none" />
            </Field>
            <Field
              icon={<FiLock />}
              label="Password"
              invalid={!!password && !passOk}
              trailing={
                <button type="button" onClick={() => setShow((s) => !s)} className="text-zinc-400 hover:text-zinc-700" title={show ? "Hide password" : "Show password"}>
                  {show ? <FiEyeOff /> : <FiEye />}
                </button>
              }
            >
              <input
                type={show ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                className="w-full bg-transparent text-sm outline-none"
              />
            </Field>
            {mode === "signup" && password && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="flex flex-1 gap-1">
                  {[8, 12, 16].map((n) => (
                    <span key={n} className={cn("h-1 flex-1 rounded-full", password.length >= n ? "bg-emerald-500" : "bg-zinc-200")} />
                  ))}
                </div>
                {password.length < 8 ? "Too short" : password.length < 12 ? "OK" : "Strong"}
              </div>
            )}
            {mode === "signin" && (
              <div className="flex justify-end">
                <button type="button" onClick={forgot} disabled={!authConfigured} className="text-xs font-medium text-violet-600 hover:underline disabled:text-zinc-300 disabled:no-underline">
                  Forgot password?
                </button>
              </div>
            )}
            {error && <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">{info}</p>}
            <button
              disabled={!!busy}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95 disabled:opacity-70"
            >
              {busy === "email" ? "One moment…" : mode === "signin" ? "Continue with email" : "Create account"}
              <FiArrowRight className="transition group-hover:translate-x-0.5" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-violet-600 hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="text-[11px] text-zinc-400">Delulu Craft — designed & built by Manisha Baroliya.</p>
      </div>
      <CreatorLink />

      {/* showcase */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-400 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.25),transparent_50%)]" />
        {SHOWCASE.map((s) => (
          <div key={s.t} className={cn("absolute rounded-3xl bg-white/20 p-2 shadow-2xl backdrop-blur", s.cls)}>
            <TemplatePreview templateId={s.t} frame={s.frame} className="h-full w-full" rounded={18} />
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-10 pt-24 text-white">
          <img src={BRAND.pill} alt={`${BRAND.name} ${BRAND.by}`} className="mb-4 h-28 w-auto drop-shadow-2xl" />
          <p className="text-xs font-semibold tracking-[0.25em] text-white/70 uppercase">Design · Animate · Publish</p>
          <p className="mt-2 max-w-md text-3xl leading-tight font-black">Every post for every brand — planned by date, ready for every platform.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, children, trailing, invalid }: { icon: React.ReactNode; label: string; children: React.ReactNode; trailing?: React.ReactNode; invalid?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      <span
        className={cn(
          "flex items-center gap-2.5 rounded-xl border bg-white px-3.5 py-3 transition focus-within:ring-4",
          invalid ? "border-red-300 focus-within:ring-red-100" : "border-zinc-200 focus-within:border-violet-400 focus-within:ring-violet-100",
        )}
      >
        <span className="text-zinc-400">{icon}</span>
        {children}
        {trailing}
      </span>
    </label>
  );
}
