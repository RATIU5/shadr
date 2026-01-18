import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="mx-auto max-w-2xl px-6 py-12 text-center text-[#e7eefb]">
      <h1 class="my-12 text-5xl font-light uppercase tracking-[0.08em] text-[#7df2ff] md:text-6xl">
        Not Found
      </h1>
      <p class="mt-8">
        Visit{" "}
        <a
          href="https://solidjs.com"
          target="_blank"
          class="text-[#5be4ff] underline-offset-4 transition hover:text-[#ffb347] hover:underline"
        >
          solidjs.com
        </a>{" "}
        to learn how to build Solid apps.
      </p>
      <p class="my-4">
        <A
          href="/"
          class="text-[#5be4ff] underline-offset-4 transition hover:text-[#ffb347] hover:underline"
        >
          Home
        </A>
        {" - "}
        <A
          href="/about"
          class="text-[#5be4ff] underline-offset-4 transition hover:text-[#ffb347] hover:underline"
        >
          About Page
        </A>
      </p>
    </main>
  );
}
