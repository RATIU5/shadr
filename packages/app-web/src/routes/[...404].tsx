import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="mx-auto max-w-2xl px-6 py-12 text-center text-[color:var(--app-text)]">
      <h1 class="my-12 text-5xl font-light uppercase tracking-[0.08em] text-[color:var(--status-info-text)] md:text-6xl">
        Not Found
      </h1>
      <p class="mt-8">
        Visit{" "}
        <a
          href="https://solidjs.com"
          target="_blank"
          class="text-[color:var(--status-info-text)] underline-offset-4 transition hover:text-[color:var(--status-warn-text)] hover:underline"
        >
          solidjs.com
        </a>{" "}
        to learn how to build Solid apps.
      </p>
      <p class="my-4">
        <A
          href="/"
          class="text-[color:var(--status-info-text)] underline-offset-4 transition hover:text-[color:var(--status-warn-text)] hover:underline"
        >
          Home
        </A>
        {" - "}
        <A
          href="/about"
          class="text-[color:var(--status-info-text)] underline-offset-4 transition hover:text-[color:var(--status-warn-text)] hover:underline"
        >
          About Page
        </A>
      </p>
    </main>
  );
}
