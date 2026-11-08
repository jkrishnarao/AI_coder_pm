"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

type AuthStatus = "checking" | "signed-out" | "signed-in";

export const AuthGate = () => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (active) {
          setStatus(response.ok ? "signed-in" : "signed-out");
        }
      })
      .catch(() => {
        if (active) {
          setError("Unable to check your session. Please try signing in again.");
          setStatus("signed-out");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401) {
        setError("Username or password is incorrect.");
        return;
      }
      if (!response.ok) {
        setError("Sign-in is unavailable. Please try again.");
        return;
      }

      setPassword("");
      setStatus("signed-in");
    } catch {
      setError("Sign-in is unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("Unable to sign out. Please try again.");
        return;
      }
      setStatus("signed-out");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  };

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6" aria-busy="true">
        <p role="status" className="text-sm font-medium text-[var(--gray-text)]">
          Checking your session...
        </p>
      </main>
    );
  }

  if (status === "signed-out") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_rgba(32,157,215,0.12),_transparent_48%),linear-gradient(145deg,_#f7f8fb,_#eef4f7)] px-6 py-12">
        <section className="w-full max-w-sm border-t-4 border-[var(--accent-yellow)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Project Management
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Sign in
          </h1>
          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-md border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary-blue)]"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary-blue)]"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="flex justify-end px-6 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-[var(--stroke)] px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
        >
          Sign out
        </button>
      </div>
      {error && <p role="alert" className="px-6 text-right text-sm text-red-700">{error}</p>}
      <KanbanBoard />
    </>
  );
};