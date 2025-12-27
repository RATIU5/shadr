import { lazy, Suspense } from "solid-js";
import "./app.css";

const ClientEditor = lazy(() => import("./components/editor.client"));

export default function App() {
	return (
		<Suspense fallback={<div>Loading WebGPU...</div>}>
			<ClientEditor />
		</Suspense>
	);
}
