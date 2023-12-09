import { Editor /*Node, Connection*/ } from 'editor'; // Importing from your library

const editor = new Editor({
  canvas: document.getElementById('node-editor') as HTMLCanvasElement,
  pixiConfig: {
    autoDensity: true,
    antialias: true,
    backgroundColor: 0x1a1b1c,
    resolution: window.devicePixelRatio || 1,
  },
});

// const node1 = new Node({
//     id: 'node1',
//     title: 'Node 1',
//     position: { x: 100, y: 100 },
//     inputs: [{ id: 'input1', label: 'Input 1' }],
//     outputs: [{ id: 'output1', label: 'Output 1' }],
//     content: 'Content of Node 1' // Could be HTML or plain text
// });

// const node2 = new Node({
//     id: 'node2',
//     title: 'Node 2',
//     position: { x: 300, y: 200 },
//     inputs: [{ id: 'input1', label: 'Input 1' }],
//     outputs: [{ id: 'output1', label: 'Output 1' }],
//     content: 'Content of Node 2'
// });

// editor.addNode(node1);
// editor.addNode(node2);

// const connection = new Connection({
//     source: { nodeId: 'node1', outputId: 'output1' },
//     target: { nodeId: 'node2', inputId: 'input1' }
// });

// editor.addConnection(connection);

// editor.on('node-clicked', (nodeId) => {
//     console.log(`Node ${nodeId} was clicked.`);
// });

// editor.on('connection-created', (connection) => {
//     console.log(`Connection created between ${connection.source.nodeId} and ${connection.target.nodeId}`);
// });

editor.start();
