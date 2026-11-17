// Система генерации карты мира
class MapGenerator {
    constructor(act = 1, seed = null, options = {}) {
        this.act = act;
        // Совместимость с чекпоинтами до появления отдельных сокровищниц.
        this.legacyTreasureShop = options.legacyTreasureShop === true;
        this.legacyLayout = options.legacyLayout === true || this.legacyTreasureShop;
        this.legacyBranchingLayout = options.legacyBranchingLayout === true;
        // Один seed описывает целую карту; пригодится для повтора забега.
        this.seed = seed === null ? Math.floor(Math.random() * 0x100000000) : seed;
        this.random = createMapRandom(this.seed);
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
        if (!this.legacyLayout) {
            if (this.legacyBranchingLayout) this.generateBranchingMap();
            else this.generateOrganicMap();
            return;
        }
        this.floorRestrictions.treasureFloor = this.floors - 1 - 7;

        this.createLayers();
        this.placeHardNodes();
        this.placeQuotaNodes();
        this.fillRemainingNodes();
        this.connectNodes();
        this.validateMap();
    }

    // Новая карта: неровные семь колонок и 3–4 потенциальных направления.
    // В отличие от фиксированных рельс, каждый этаж перестраивает геометрию.
    generateOrganicMap() {
        this.floorRestrictions.treasureFloor = 8;
        this.createLayers();
        this.createNode(0, 0, NODE_TYPES.START, true);
        const special = {
            4: [NODE_TYPES.BATTLE, NODE_TYPES.SHOP, NODE_TYPES.EVENT],
            6: [NODE_TYPES.ELITE, NODE_TYPES.REST, NODE_TYPES.BATTLE],
            8: [NODE_TYPES.TREASURE],
            10: [NODE_TYPES.SHOP, NODE_TYPES.BATTLE, NODE_TYPES.EVENT],
            12: [NODE_TYPES.ELITE, NODE_TYPES.REST, NODE_TYPES.BATTLE],
            14: [NODE_TYPES.REST]
        };
        for (let floor = 1; floor < this.floors - 1; floor++) {
            if (special[floor]?.length === 1) {
                this.createNode(floor, 0, special[floor][0]);
                continue;
            }
            const count = special[floor]?.length || this.randomInt(3, 4);
            const columns = [0, 1, 2, 3, 4, 5, 6];
            shuffleArray(columns, this.random);
            const positions = columns.slice(0, count).sort((a, b) => a - b);
            positions.forEach((position, index) => {
                let type = special[floor]?.[index] || NODE_TYPES.BATTLE;
                if (!special[floor] && floor > 1) {
                    const chance = this.random();
                    if (chance < 0.25) type = NODE_TYPES.EVENT;
                    else if (floor >= 5 && chance < 0.34) type = NODE_TYPES.REST;
                }
                this.createNode(floor, position, type);
            });
        }
        this.createNode(this.floors - 1, 0, NODE_TYPES.BOSS);
        this.connectOrganicRoutes();
    }

    connectOrganicRoutes() {
        for (let floor = 0; floor < this.floors - 1; floor++) {
            const from = this.paths[floor];
            const to = this.paths[floor + 1];
            if (from.length === 1 || to.length === 1) {
                for (const node of from) {
                    for (const target of to) node.connections.push(target.id);
                }
                continue;
            }
            // Основные линии монотонны: соединения сохраняют порядок слева направо.
            from.forEach((node, i) => {
                const targetIndex = Math.round(i * (to.length - 1) / (from.length - 1));
                node.connections.push(to[targetIndex].id);
            });
            // Ни одна комната не остаётся без входа.
            to.forEach((target, j) => {
                if (!from.some(node => node.connections.includes(target.id))) {
                    const sourceIndex = Math.round(j * (from.length - 1) / (to.length - 1));
                    from[sourceIndex].connections.push(target.id);
                }
            });
            // Одна дополнительная развилка на этаж — выбор не превращается в паутину.
            const index = this.randomInt(0, from.length - 2);
            const node = from[index];
            const currentTarget = to.findIndex(target => node.connections.includes(target.id));
            const alt = to[Math.min(to.length - 1, currentTarget + 1)];
            if (alt && !node.connections.includes(alt.id)) node.connections.push(alt.id);
        }
    }

    // Маршруты строятся до назначения комнат: на каждом обычном этаже
    // три осмысленные альтернативы, а ключевые комнаты имеют фиксированную роль.
    generateBranchingMap() {
        this.floorRestrictions.treasureFloor = 8;
        this.createLayers();
        this.createNode(0, 0, NODE_TYPES.START, true);
        const specialFloors = {
            4: [NODE_TYPES.BATTLE, NODE_TYPES.SHOP, NODE_TYPES.EVENT],
            6: [NODE_TYPES.ELITE, NODE_TYPES.REST, NODE_TYPES.BATTLE],
            8: [NODE_TYPES.TREASURE],
            10: [NODE_TYPES.SHOP, NODE_TYPES.BATTLE, NODE_TYPES.EVENT],
            12: [NODE_TYPES.ELITE, NODE_TYPES.REST, NODE_TYPES.BATTLE],
            14: [NODE_TYPES.REST]
        };
        for (let floor = 1; floor < this.floors - 1; floor++) {
            const fixed = specialFloors[floor];
            if (fixed) {
                fixed.forEach((type, position) => this.createNode(floor, position, type));
                continue;
            }
            for (let position = 0; position < 3; position++) {
                let type = NODE_TYPES.BATTLE;
                if (floor >= 2 && this.random() < 0.34) type = NODE_TYPES.EVENT;
                if (floor >= 5 && this.random() < 0.12) type = NODE_TYPES.REST;
                this.createNode(floor, position, type);
            }
        }
        this.createNode(this.floors - 1, 0, NODE_TYPES.BOSS);
        this.connectBranchingRoutes();
    }

    connectBranchingRoutes() {
        for (let floor = 0; floor < this.floors - 1; floor++) {
            const current = this.paths[floor];
            const next = this.paths[floor + 1];
            if (current.length === 1 || next.length === 1) {
                for (const node of current) {
                    for (const target of next) node.connections.push(target.id);
                }
                continue;
            }
            // Каждая колонка продолжает собственную линию; соседние развилки
            // предлагают дополнительный выбор, не допуская пересечений.
            current.forEach((node, index) => {
                node.connections.push(next[index].id);
            });
            const branch = this.randomInt(0, current.length - 2);
            current[branch].connections.push(next[branch + 1].id);
        }
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
        this.createNode(treasureFloor, 0,
            this.legacyTreasureShop ? NODE_TYPES.SHOP : NODE_TYPES.TREASURE, false);

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

        // Магазины считаются отдельно от сокровищницы.
        for (let floor = 0; floor < this.floors; floor++) {
            for (const node of this.paths[floor]) {
                if (node.type === NODE_TYPES.SHOP) placed++;
            }
        }

        // Равномерно по этажам
        const shopFloors = [2, 5, 11, 13];
        shuffleArray(shopFloors, this.random);

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
        shuffleArray(restFloors, this.random);

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
        shuffleArray(eliteFloors, this.random);

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
                if (index > 0 && index - 1 < nextNodes.length && this.random() < 0.5) {
                    if (nextNodes[index - 1]) {
                        node.connections.push(nextNodes[index - 1].id);
                    }
                }

                // Иногда с соседним справа
                if (index + 1 < nextNodes.length && this.random() < 0.5) {
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
        return Math.floor(this.random() * (max - min + 1)) + min;
    }
}

function shuffleArray(array, random = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Детерминированный PRNG: одинаковый seed и версия генератора дают одинаковую карту.
function createMapRandom(seed) {
    const value = String(seed);
    let state = 2166136261;
    for (let i = 0; i < value.length; i++) {
        state = Math.imul(state ^ value.charCodeAt(i), 16777619) >>> 0;
    }
    return function random() {
        state = (state + 0x6D2B79F5) >>> 0;
        let x = state;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}
