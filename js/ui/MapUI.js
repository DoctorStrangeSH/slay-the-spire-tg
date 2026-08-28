// UI карты мира
const MapUI = {
    render(game) {
        const mapContainer = document.getElementById('map-nodes');
        mapContainer.innerHTML = '';
        
        const actInfo = document.createElement('div');
        actInfo.className = 'act-info';
        actInfo.innerHTML = `
            <h2>Акт ${game.act}</h2>
            <p>Этаж: ${game.floor + 1}/${game.mapGenerator.floors}</p>
            <p>❤️ HP: ${game.player.hp}/${game.player.maxHp} | 💰 Золото: ${game.player.gold}</p>
        `;
        mapContainer.appendChild(actInfo);
        
        const mapWrapper = document.createElement('div');
        mapWrapper.className = 'map-wrapper';
        
        const availableNodes = game.mapGenerator.getAvailableNodes(game.currentNodeId);
        const currentNode = game.mapGenerator.findNodeById(game.currentNodeId);
        const currentFloor = currentNode ? currentNode.floor : 0;
        
        game.mapGenerator.paths.forEach((floorNodes, floorIndex) => {
            const floorRow = document.createElement('div');
            floorRow.className = 'floor-row';
            
            const floorLabel = document.createElement('div');
            floorLabel.className = 'floor-label';
            floorLabel.textContent = `${floorIndex + 1}`;
            floorRow.appendChild(floorLabel);
            
            floorNodes.forEach((node) => {
                const nodeElement = this.createMapNodeElement(node, availableNodes, floorIndex, currentFloor, game);
                floorRow.appendChild(nodeElement);
            });
            
            mapWrapper.appendChild(floorRow);
        });
        
        mapContainer.appendChild(mapWrapper);
    },
    
    createMapNodeElement(node, availableNodes, floorIndex, currentFloor, game) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'map-node-container';
        
        const isAvailable = availableNodes.includes(node);
        const isVisited = node.visited;
        const isFutureFloor = floorIndex > currentFloor;
        const isPastFloor = floorIndex < currentFloor;
        const isCurrentFloor = floorIndex === currentFloor;
        
        const button = document.createElement('button');
        button.className = `map-node-btn ${isVisited ? 'visited' : ''} ${isAvailable ? 'available' : ''} ${isPastFloor ? 'past' : ''} ${isFutureFloor ? 'future' : ''} ${isCurrentFloor ? 'current' : ''}`;
        button.setAttribute('data-type', node.type);
        button.innerHTML = `
            <span class="node-icon">${this.getNodeIcon(node.type)}</span>
            <span class="node-label">${this.getNodeLabel(node.type)}</span>
        `;
        
        if (isAvailable && !isVisited && isFutureFloor) {
            button.onclick = () => game.selectMapNode(node);
            button.style.cursor = 'pointer';
        } else if (isVisited) {
            button.disabled = true;
            button.style.cursor = 'default';
        } else {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'default';
        }
        
        nodeDiv.appendChild(button);
        return nodeDiv;
    },
    
    getNodeIcon(type) {
        switch (type) {
            case NODE_TYPES.START: return '🏠';
            case NODE_TYPES.BATTLE: return '⚔️';
            case NODE_TYPES.ELITE: return '👑';
            case NODE_TYPES.REST: return '🏕️';
            case NODE_TYPES.EVENT: return '❓';
            case NODE_TYPES.SHOP: return '💰';
            case NODE_TYPES.BOSS: return '💀';
            default: return '•';
        }
    },
    
    getNodeLabel(type) {
        switch (type) {
            case NODE_TYPES.START: return 'Старт';
            case NODE_TYPES.BATTLE: return 'Бой';
            case NODE_TYPES.ELITE: return 'Элита';
            case NODE_TYPES.REST: return 'Отдых';
            case NODE_TYPES.EVENT: return 'Событие';
            case NODE_TYPES.SHOP: return 'Магазин';
            case NODE_TYPES.BOSS: return 'Босс';
            default: return '';
        }
    }
};