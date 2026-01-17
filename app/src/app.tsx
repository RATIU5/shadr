import { lazy, Suspense } from "solid-js";
import "./app.css";

const ClientEditor = lazy(() => import("./components/editor.client"));

export default function App() {
	return (
		<Suspense
			fallback={
				<div class="flex h-dvh items-center justify-center text-sm text-[#8c96a3]">
					Loading Pixi...
				</div>
			}
		>
			<ClientEditor />
		</Suspense>
	);
}
