// Система генерации карты мира
class MapGenerator {
    constructor(act = 1) {
        this.act = act;
        this.floors = GAME_CONFIG.floorsPerAct;
        this.paths = this.generatePaths();
    }
    
    generatePaths() {
        const paths = [];
        
        for (let floor = 0; floor < this.floors; floor++) {
            const nodeCount = this.getNodeCountForFloor(floor);
            const floorNodes = [];
            
            for (let i = 0; i < nodeCount; i++) {
                floorNodes.push({
                    id: `floor_${floor}_node_${i}`,
                    floor: floor,
                    x: i,
                    y: floor,
                    type: this.getNodeType(floor),
                    connections: [],
                    visited: false
                });
            }
            
            paths.push(floorNodes);
        }
        
        this.connectNodes(paths);
        return paths;
    }
    
    connectNodes(paths) {
        for (let floor = 0; floor < this.floors - 1; floor++) {
            const currentNodes = paths[floor];
            const nextNodes = paths[floor + 1];
            
            currentNodes.forEach((node, index) => {
                const possibleConnections = this.getPossibleConnections(index, nextNodes.length, floor, paths);
                
                possibleConnections.forEach(nextIndex => {
                    if (nextIndex >= 0 && nextIndex < nextNodes.length) {
                        node.connections.push(nextNodes[nextIndex].id);
                    }
                });
            });
        }
    }
    
    getPossibleConnections(currentIndex, nextCount, floor, paths) {
        const connections = new Set();
        
        // Для первого этажа (старт) - соединяем со ВСЕМИ узлами
        if (floor === 0 && paths[0].length === 1) {
            for (let i = 0; i < nextCount; i++) {
                connections.add(i);
            }
            return Array.from(connections);
        }
        
        // Всегда добавляем ближайший узел
        connections.add(Math.min(currentIndex, nextCount - 1));
        
        // Добавляем соседние узлы
        const leftNeighbor = currentIndex - 1;
        const rightNeighbor = currentIndex + 1;
        
        if (leftNeighbor >= 0) connections.add(leftNeighbor);
        if (rightNeighbor < nextCount) connections.add(rightNeighbor);
        
        // Иногда добавляем дальний узел
        if (Math.random() < 0.3) {
            const farNode = Math.floor(Math.random() * nextCount);
            if (farNode !== currentIndex) {
                connections.add(farNode);
            }
        }
        
        return Array.from(connections).sort((a, b) => a - b);
    }
    
    getNodeCountForFloor(floor) {
        if (floor === 0 || floor === this.floors - 1) return 1;
        
        const midPoint = this.floors / 2;
        const distanceFromMid = Math.abs(floor - midPoint);
        const baseCount = 5 - Math.floor(distanceFromMid / 3);
        
        return Math.max(3, Math.min(5, baseCount + Math.floor(Math.random() * 2)));
    }
    
    getNodeType(floor) {
        if (floor === 0) return NODE_TYPES.START;
        if (floor === this.floors - 1) return NODE_TYPES.BOSS;
        
        const rand = Math.random();
        
        if (floor < 3) {
            if (rand < 0.7) return NODE_TYPES.BATTLE;
            if (rand < 0.8) return NODE_TYPES.ELITE;
            if (rand < 0.9) return NODE_TYPES.REST;
            return NODE_TYPES.EVENT;
        } else if (floor < 10) {
            if (rand < 0.5) return NODE_TYPES.BATTLE;
            if (rand < 0.6) return NODE_TYPES.ELITE;
            if (rand < 0.75) return NODE_TYPES.REST;
            if (rand < 0.85) return NODE_TYPES.EVENT;
            return NODE_TYPES.SHOP;
        } else {
            if (rand < 0.4) return NODE_TYPES.BATTLE;
            if (rand < 0.55) return NODE_TYPES.ELITE;
            if (rand < 0.65) return NODE_TYPES.REST;
            if (rand < 0.8) return NODE_TYPES.EVENT;
            return NODE_TYPES.SHOP;
        }
    }
    
    getAvailableNodes(currentNodeId) {
        const available = new Set();
        const currentNode = this.findNodeById(currentNodeId);
        
        if (!currentNode) return [];
        
        currentNode.connections.forEach(connId => {
            const connectedNode = this.findNodeById(connId);
            if (connectedNode && !connectedNode.visited) {
                available.add(connectedNode);
            }
        });
        
        const currentFloor = currentNode.floor;
        const currentFloorNodes = this.paths[currentFloor];
        
        if (currentFloorNodes) {
            currentFloorNodes.forEach(node => {
                if (node.visited) {
                    node.connections.forEach(connId => {
                        const connectedNode = this.findNodeById(connId);
                        if (connectedNode && !connectedNode.visited) {
                            available.add(connectedNode);
                        }
                    });
                }
            });
        }
        
        return Array.from(available);
    }
    
    findNodeById(id) {
        for (let floorNodes of this.paths) {
            for (let node of floorNodes) {
                if (node.id === id) return node;
            }
        }
        return null;
    }
    
    visitNode(nodeId) {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.visited = true;
        }
    }
    
    getCurrentNodeId() {
        let lastVisited = null;
        for (let floorNodes of this.paths) {
            for (let node of floorNodes) {
                if (node.visited) {
                    lastVisited = node;
                }
            }
        }
        return lastVisited ? lastVisited.id : null;
    }
}