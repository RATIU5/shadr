const addNodeButton = document.querySelector("[data-testid='add-node']");
const connectButton = document.querySelector("[data-testid='connect-nodes']");
const canvas = document.getElementById("canvas");
const status = document.getElementById("status");
const connectionsList = document.getElementById("connections");

const selectedNodes = new Set();
const connections = new Set();
let nextNodeId = 1;

const setStatus = (message) => {
	status.textContent = message;
};

const renderConnection = (fromId, toId) => {
	const item = document.createElement("li");
	item.dataset.testid = "connection";
	item.textContent = `Node ${fromId} -> Node ${toId}`;
	connectionsList.appendChild(item);
};

const clearSelection = () => {
	for (const node of selectedNodes) {
		node.classList.remove("selected");
	}
	selectedNodes.clear();
};

const toggleSelection = (node) => {
	if (selectedNodes.has(node)) {
		node.classList.remove("selected");
		selectedNodes.delete(node);
		setStatus("Node deselected.");
		return;
	}

	if (selectedNodes.size >= 2) {
		clearSelection();
	}

	node.classList.add("selected");
	selectedNodes.add(node);
	setStatus(`Selected ${selectedNodes.size} node(s).`);
};

addNodeButton.addEventListener("click", () => {
	const node = document.createElement("button");
	const nodeId = nextNodeId;
	nextNodeId += 1;

	node.type = "button";
	node.className = "node";
	node.dataset.testid = "node";
	node.dataset.nodeId = String(nodeId);
	node.textContent = `Node ${nodeId}`;
	node.addEventListener("click", () => toggleSelection(node));

	canvas.appendChild(node);
	setStatus(`Created Node ${nodeId}.`);
});

connectButton.addEventListener("click", () => {
	if (selectedNodes.size !== 2) {
		setStatus("Select exactly two nodes to connect.");
		return;
	}

	const [fromNode, toNode] = Array.from(selectedNodes);
	const fromId = fromNode.dataset.nodeId;
	const toId = toNode.dataset.nodeId;

	if (!fromId || !toId) {
		setStatus("Unable to connect nodes.");
		return;
	}

	const key = `${fromId}->${toId}`;
	if (connections.has(key)) {
		setStatus("Connection already exists.");
		return;
	}

	connections.add(key);
	renderConnection(fromId, toId);
	setStatus(`Connected Node ${fromId} to Node ${toId}.`);
	clearSelection();
});

setStatus("Ready.");
