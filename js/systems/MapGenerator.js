// Система генерации карты мира
class MapGenerator {
    constructor(act = 1) {
        this.act = act;
        this.floors = 16;

        this.quotas = {
            shops: 3,
            elites: 5,
            rests: { min: 5, max: 7 },
            events: { min: 9, max: 14 },
            treasure: 1,
            battles: this.randomInt(10, 15) // Бои 10-15
        };

        this.floorRestrictions = {
            eliteMinFloor: 5,
            shopMinFloor: 2,
            restMinFloor: 2,
            treasureFloor: null,
            restBeforeBoss: true
        };

        this.paths = [];
        this.allNodes = [];

        this.generateMap();
    }

    generateMap() {
        this.floorRestrictions.treasureFloor = this.floors - 1 - 7;

        this.createLayers();
        this.placeHardNodes();
        this.placeQuotaNodes();
        this.fillRemainingNodes();
        this.connectNodes();
        this.validateMap();
    }

    createLayers() {
        this.paths = [];
        this.allNodes = [];
        for (let floor = 0; floor < this.floors; floor++) {
            this.paths.push([]);
        }
    }

    placeHardNodes() {
        // Стартовый узел (этаж 0)
        this.createNode(0, 0, NODE_TYPES.START, true);

        // Костёр перед боссом (этаж 14)
        const restFloor = this.floors - 2;
        this.createNode(restFloor, 0, NODE_TYPES.REST, false);

        // Сундук (этаж 8)
        const treasureFloor = this.floorRestrictions.treasureFloor;
        this.createNode(treasureFloor, 0, NODE_TYPES.SHOP, false);

        // Босс (этаж 15)
        this.createNode(this.floors - 1, 0, NODE_TYPES.BOSS, false);
    }

    placeQuotaNodes() {
        this.placeShops();
        this.placeRests();
        this.placeElites();
        this.placeEvents();
    }

    placeShops() {
        const targetShops = this.quotas.shops;
        let placed = 0;

        // Считаем сундук
        for (let floor = 0; floor < this.floors; floor++) {
            for (const node of this.paths[floor]) {
                if (node.type === NODE_TYPES.SHOP) placed++;
            }
        }

        // Равномерно по этажам
        const shopFloors = [2, 5, 11, 13];
        shuffleArray(shopFloors);

        for (const floor of shopFloors) {
            if (placed >= targetShops) break;

            const position = this.getFreePosition(floor);
            if (position !== -1) {
                this.createNode(floor, position, NODE_TYPES.SHOP, false);
                placed++;
            }
        }
    }

    placeRests() {
        const targetRests = this.randomInt(this.quotas.rests.min, this.quotas.rests.max);
        let placed = 0;

        for (let floor = 0; floor < this.floors; floor++) {
            for (const node of this.paths[floor]) {
                if (node.type === NODE_TYPES.REST) placed++;
            }
        }

        // Равномерно
        const restFloors = [3, 6, 9, 12];
        shuffleArray(restFloors);

        for (const floor of restFloors) {
            if (placed >= targetRests) break;
            if (this.hasNearbyNodeOfType(floor, NODE_TYPES.REST, 2)) continue;

            const position = this.getFreePosition(floor);
            if (position !== -1) {
                this.createNode(floor, position, NODE_TYPES.REST, false);
                placed++;
            }
        }
    }

    placeElites() {
        const targetElites = this.quotas.elites;
        let placed = 0;

        // Равномерно по этажам 5-13, разные позиции
        const eliteFloors = [5, 7, 9, 11, 13];
        shuffleArray(eliteFloors);

        for (let i = 0; i < eliteFloors.length && placed < targetElites; i++) {
            const floor = eliteFloors[i];

            // Разные позиции для элит
            const position = placed % 3; // 0, 1, 2

            if (this.isPositionFree(floor, position)) {
                this.createNode(floor, position, NODE_TYPES.ELITE, false);
                placed++;
            }
        }
    }

    placeEvents() {
        const targetEvents = this.randomInt(this.quotas.events.min, this.quotas.events.max);
        let placed = 0;

        // Все этажи
        for (let floor = 1; floor < this.floors - 2; floor++) {
            if (placed >= targetEvents) break;
            if (this.hasNearbyNodeOfType(floor, NODE_TYPES.EVENT, 1)) continue;

            const position = this.getFreePosition(floor);
            if (position !== -1) {
                this.createNode(floor, position, NODE_TYPES.EVENT, false);
                placed++;
            }
        }
    }

    fillRemainingNodes() {
        // Считаем сколько боёв уже есть
        let battleCount = 0;
        for (const node of this.allNodes) {
            if (node.type === NODE_TYPES.BATTLE) battleCount++;
        }

        const targetBattles = this.quotas.battles;

        // Добавляем бои на случайные этажи
        let attempts = 0;
        while (battleCount < targetBattles && attempts < 300) {
            attempts++;
            const floor = this.randomInt(1, this.floors - 3);
            const position = this.getFreePosition(floor);

            if (position !== -1) {
                this.createNode(floor, position, NODE_TYPES.BATTLE, false);
                battleCount++;
            }
        }

        // Заполняем пустые этажи хотя бы одним боем
        for (let floor = 1; floor < this.floors - 1; floor++) {
            if (this.paths[floor].length === 0) {
                this.createNode(floor, 0, NODE_TYPES.BATTLE, false);
            }
        }
    }

    isPositionFree(floor, position) {
        return !this.paths[floor].some(node => node.x === position);
    }

    getFreePosition(floor) {
        // Ищем свободную позицию
        for (let pos = 0; pos < 5; pos++) {
            if (!this.paths[floor].some(node => node.x === pos)) {
                return pos;
            }
        }
        return -1;
    }

    getNodeCountForFloor(floor) {
        if (floor === 0) return 1;
        if (floor === this.floors - 1) return 1;
        if (floor === this.floors - 2) return 1;
        if (floor <= 3) return this.randomInt(2, 3);
        if (floor <= 10) return this.randomInt(2, 4);
        return this.randomInt(2, 3);
    }

    getAvailableFloorsForType(type) {
        const floors = [];
        for (let floor = 1; floor < this.floors - 1; floor++) {
            switch (type) {
                case NODE_TYPES.SHOP:
                    if (floor >= this.floorRestrictions.shopMinFloor && floor <= this.floors - 3) floors.push(floor);
                    break;
                case NODE_TYPES.REST:
                    if (floor >= this.floorRestrictions.restMinFloor && floor !== this.floors - 2) floors.push(floor);
                    break;
                case NODE_TYPES.ELITE:
                    if (floor >= this.floorRestrictions.eliteMinFloor && floor <= this.floors - 3) floors.push(floor);
                    break;
                case NODE_TYPES.EVENT:
                    floors.push(floor);
                    break;
            }
        }
        return floors;
    }

    hasNearbyNodeOfType(floor, type, distance) {
        for (let f = Math.max(0, floor - distance); f <= Math.min(this.floors - 1, floor + distance); f++) {
            if (f === floor) continue;
            if (this.paths[f].some(node => node.type === type)) return true;
        }
        return false;
    }

    createNode(floor, position, type, visited = false) {
        const node = {
            id: `floor_${floor}_node_${position}`,
            floor: floor,
            x: position,
            type: type,
            connections: [],
            visited: visited
        };
        this.paths[floor].push(node);
        this.allNodes.push(node);
        return node;
    }

    connectNodes() {
        // Старт соединяется со всеми узлами первого этажа
        const startNode = this.paths[0][0];
        const firstLayer = this.paths[1];

        if (startNode && firstLayer && firstLayer.length > 0) {
            firstLayer.forEach(node => {
                startNode.connections.push(node.id);
            });
        }

        // Соединяем этажи
        for (let floor = 1; floor < this.floors - 1; floor++) {
            const currentNodes = this.paths[floor] || [];
            const nextNodes = this.paths[floor + 1] || [];

            if (currentNodes.length === 0 || nextNodes.length === 0) continue;

            currentNodes.forEach((node, index) => {
                // Соединяем с ближайшим узлом
                const nearestIndex = Math.min(index, nextNodes.length - 1);
                if (nextNodes[nearestIndex]) {
                    node.connections.push(nextNodes[nearestIndex].id);
                }

                // Иногда с соседним слева
                if (index > 0 && index - 1 < nextNodes.length && Math.random() < 0.5) {
                    if (nextNodes[index - 1]) {
                        node.connections.push(nextNodes[index - 1].id);
                    }
                }

                // Иногда с соседним справа
                if (index + 1 < nextNodes.length && Math.random() < 0.5) {
                    if (nextNodes[index + 1]) {
                        node.connections.push(nextNodes[index + 1].id);
                    }
                }
            });
        }
    }

    validateMap() {
        for (let floor = 1; floor < this.floors; floor++) {
            this.paths[floor].forEach(node => {
                if (!this.hasIncomingConnection(node.id)) {
                    this.addIncomingConnection(node);
                }
            });
        }
    }

    hasIncomingConnection(nodeId) {
        for (let floor = 0; floor < this.floors - 1; floor++) {
            for (const node of this.paths[floor]) {
                if (node.connections.includes(nodeId)) return true;
            }
        }
        return false;
    }

    addIncomingConnection(node) {
        const previousFloor = node.floor - 1;
        if (previousFloor < 0) return;

        const previousNodes = this.paths[previousFloor];
        if (previousNodes.length === 0) return;

        const nearestIndex = Math.min(node.x, previousNodes.length - 1);
        previousNodes[nearestIndex].connections.push(node.id);
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

        const currentFloorNodes = this.paths[currentNode.floor];
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
        if (node) node.visited = true;
    }

    getCurrentNodeId() {
        let lastVisited = null;
        for (let floorNodes of this.paths) {
            for (let node of floorNodes) {
                if (node.visited) lastVisited = node;
            }
        }
        return lastVisited ? lastVisited.id : null;
    }

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}