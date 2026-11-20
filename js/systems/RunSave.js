// Сохранение безопасного чекпоинта между комнатами, без сериализации боевых классов.
class RunSave {
    static get KEY() { return 'slay-and-spire-run-v1'; }
    static get VERSION() { return 1; }

    constructor(storage = typeof localStorage === 'undefined' ? null : localStorage) {
        this.storage = storage;
    }

    mapSignature(map) {
        return JSON.stringify(map.allNodes.map(node => [
            node.id, node.type, ...node.connections
        ]));
    }

    createSnapshot(game) {
        if (!game.player || !game.mapGenerator || game.gameState !== 'map') return null;
        return {
            version: RunSave.VERSION,
            savedAt: new Date().toISOString(),
            runId: game.runId || null,
            act: game.act,
            floor: game.floor,
            currentNodeId: game.currentNodeId,
            player: JSON.parse(JSON.stringify(game.player)),
            map: {
                seed: game.mapGenerator.seed,
                signature: this.mapSignature(game.mapGenerator),
                visited: game.mapGenerator.allNodes.filter(n => n.visited).map(n => n.id)
            }
        };
    }

    save(game) {
        try {
            // Snapshot construction is part of persistence too: player state may
            // contain unexpected non-serializable data (e.g. a circular reference).
            const snapshot = this.createSnapshot(game);
            if (!snapshot || !this.storage) return false;
            this.storage.setItem(RunSave.KEY, JSON.stringify(snapshot));
            return true;
        } catch (error) {
            // Storage may be unavailable/full, or snapshot data may be invalid.
            // A failed checkpoint must never interrupt the current run.
            console.warn('Не удалось сохранить забег:', error);
            return false;
        }
    }

    read() {
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(RunSave.KEY);
            if (!raw) return null;
            const value = JSON.parse(raw);
            if (!value || value.version !== RunSave.VERSION) return null;
            return value;
        } catch (error) {
            return null;
        }
    }

    restore(game) {
        const data = this.read();
        if (!data || !data.player || !data.map || !Array.isArray(data.map.visited)) return false;
        if (!Number.isInteger(data.act) || data.act < 1 || data.act > GAME_CONFIG.maxActs) return false;
        if (!Number.isInteger(data.floor) || data.floor < 0) return false;
        if (typeof data.player.heroId !== 'string' || !HEROES[data.player.heroId]) return false;
        if (!Array.isArray(data.player.deck) || !Array.isArray(data.player.relics)) return false;
        if (!Number.isFinite(data.player.hp) || data.player.hp <= 0 ||
            !Number.isFinite(data.player.maxHp) || data.player.maxHp <= 0 ||
            data.player.hp > data.player.maxHp ||
            !Number.isFinite(data.player.gold) || data.player.gold < 0) return false;
        if (!['string', 'number'].includes(typeof data.map.seed)) return false;
        if (typeof data.currentNodeId !== 'string') return false;

        let map = new MapGenerator(data.act, data.map.seed);
        if (this.mapSignature(map) !== data.map.signature) {
            // Сохранения прежних версий содержали другую геометрию и типы комнат.
            // Проверяем старые варианты прежде, чем отвергнуть чекпоинт.
            const legacyOptions = [
                { enableSecretRooms: false },
                { legacyCrossingLayout: true, enableSecretRooms: false },
                { legacyOrganicLayout: true, enableSecretRooms: false },
                { legacyBranchingLayout: true, enableSecretRooms: false },
                { legacyLayout: true, enableSecretRooms: false },
                { legacyLayout: true, legacyTreasureShop: true, enableSecretRooms: false }
            ];
            let recovered = false;
            for (const options of legacyOptions) {
                const candidate = new MapGenerator(data.act, data.map.seed, options);
                if (this.mapSignature(candidate) === data.map.signature) {
                    map = candidate;
                    recovered = true;
                    break;
                }
            }
            if (!recovered) return false;
        }
        const current = map.findNodeById(data.currentNodeId);
        const visitedIds = data.map.visited;
        if (!current || current.floor !== data.floor ||
            !Array.isArray(visitedIds) || visitedIds.length === 0 ||
            visitedIds.length > map.allNodes.length ||
            visitedIds.some(id => typeof id !== 'string') ||
            new Set(visitedIds).size !== visitedIds.length ||
            !visitedIds.includes('floor_0_node_0') ||
            !visitedIds.includes(data.currentNodeId)) return false;

        // A checkpoint must describe one reachable route, not an arbitrary set
        // of visited flags. Secret-room shortcuts may skip a floor, so validate
        // graph reachability instead of requiring consecutive floor numbers.
        const visitedSet = new Set(visitedIds);
        if (visitedIds.some(id => {
            const node = map.findNodeById(id);
            return !node || node.floor > current.floor;
        })) return false;

        const reachable = new Set(['floor_0_node_0']);
        const orderedVisited = visitedIds
            .map(id => map.findNodeById(id))
            .sort((a, b) => a.floor - b.floor);
        for (const node of orderedVisited) {
            if (!reachable.has(node.id)) return false;
            node.connections.forEach(id => {
                if (visitedSet.has(id)) reachable.add(id);
            });
            node.visited = true;
        }

        // The current node must be the latest visited point; multiple visited
        // nodes on the same floor would indicate a malformed checkpoint.
        if (orderedVisited[orderedVisited.length - 1]?.id !== current.id ||
            orderedVisited.some((node, index) =>
                index > 0 && node.floor === orderedVisited[index - 1].floor)) return false;

        // Применять восстановление только после всех проверок.
        game.player = JSON.parse(JSON.stringify(data.player));
        game.act = data.act;
        game.floor = data.floor;
        game.currentNodeId = data.currentNodeId;
        game.mapGenerator = map;
        game.currentBattle = null;
        game.currentEvent = null;
        game.offeredCards = [];
        return true;
    }

    clear() {
        if (!this.storage) return;
        try { this.storage.removeItem(RunSave.KEY); } catch (error) { /* storage denied */ }
    }
}
