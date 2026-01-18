import "./app.css";

import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";

export default function App() {
  return (
    <Router
      root={(props) => (
        <div class="relative min-h-screen bg-[radial-gradient(circle_at_15%_20%,_#192237_0%,_#0b101a_45%,_#050608_100%)] text-[#e7eefb] [color-scheme:dark] font-['Space_Grotesk']">
          <div class="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(91,228,255,0.08),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,179,71,0.08),transparent_40%)]" />
          <Suspense>{props.children}</Suspense>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
