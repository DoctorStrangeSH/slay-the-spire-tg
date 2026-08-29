// UI карты мира с SVG-визуализацией
const MapUI = {
    render(game) {
        const mapContainer = document.getElementById('map-nodes');
        mapContainer.innerHTML = '';
        
        // Заголовок
        const actInfo = document.createElement('div');
        actInfo.className = 'act-info';
        actInfo.innerHTML = `
            <h2>Акт ${game.act}</h2>
            <p>Этаж: ${game.floor + 1}/${game.mapGenerator.floors}</p>
            <p>❤️ HP: ${game.player.hp}/${game.player.maxHp} | 💰 Золото: ${game.player.gold}</p>
        `;
        mapContainer.appendChild(actInfo);
        
        // Создаём SVG для карты
        const svg = this.createSVG(game);
        mapContainer.appendChild(svg);
        
        // Легенда
        this.renderLegend(mapContainer);
    },
    
    createSVG(game) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        
        const width = 480;
        const height = 600;
        const marginX = 30;
        const marginY = 20;
        const floorHeight = (height - 2 * marginY) / (game.mapGenerator.floors - 1);
        
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        const availableNodes = game.mapGenerator.getAvailableNodes(game.currentNodeId);
        const currentNode = game.mapGenerator.findNodeById(game.currentNodeId);
        const currentFloor = currentNode ? currentNode.floor : 0;
        
        // Рисуем соединения
        game.mapGenerator.paths.forEach((floorNodes) => {
            floorNodes.forEach(node => {
                node.connections.forEach(connId => {
                    const targetNode = game.mapGenerator.findNodeById(connId);
                    if (targetNode) {
                        const line = this.createConnectionLine(node, targetNode, svgNS, width, marginX, marginY, floorHeight);
                        svg.appendChild(line);
                    }
                });
            });
        });
        
        // Рисуем узлы
        game.mapGenerator.paths.forEach((floorNodes, floorIndex) => {
            floorNodes.forEach((node) => {
                const nodeElement = this.createNodeElement(node, floorIndex, svgNS, width, marginX, marginY, floorHeight, availableNodes, currentFloor, game);
                svg.appendChild(nodeElement);
            });
        });
        
        return svg;
    },
    
    createConnectionLine(node1, node2, svgNS, width, marginX, marginY, floorHeight) {
        const line = document.createElementNS(svgNS, 'line');
        
        const x1 = this.getNodeX(node1, width, marginX);
        const y1 = this.getNodeY(node1, marginY, floorHeight);
        const x2 = this.getNodeX(node2, width, marginX);
        const y2 = this.getNodeY(node2, marginY, floorHeight);
        
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        
        const isVisited = node1.visited && node2.visited;
        const isAvailable = node1.visited && !node2.visited;
        
        if (isVisited) {
            line.setAttribute('stroke', '#4a4a5a');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.5');
        } else if (isAvailable) {
            line.setAttribute('stroke', '#4ecdc4');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('opacity', '0.8');
            line.setAttribute('stroke-dasharray', '5,5');
        } else {
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('opacity', '0.3');
        }
        
        return line;
    },
    
    createNodeElement(node, floorIndex, svgNS, width, marginX, marginY, floorHeight, availableNodes, currentFloor, game) {
        const group = document.createElementNS(svgNS, 'g');
        
        const cx = this.getNodeX(node, width, marginX);
        const cy = this.getNodeY(node, marginY, floorHeight);
        
        let radius = 15;
        if (node.type === NODE_TYPES.BOSS) radius = 20;
        if (node.type === NODE_TYPES.START) radius = 18;
        
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', this.getNodeColor(node.type));
        circle.setAttribute('stroke', this.getNodeStroke(node));
        circle.setAttribute('stroke-width', '2');
        
        const isAvailable = availableNodes.includes(node);
        const isVisited = node.visited;
        const isFutureFloor = floorIndex > currentFloor;
        
        if (isVisited) {
            circle.setAttribute('opacity', '0.6');
        } else if (isAvailable && isFutureFloor) {
            circle.setAttribute('stroke', '#4ecdc4');
            circle.setAttribute('stroke-width', '3');
            circle.style.cursor = 'pointer';
            circle.style.pointerEvents = 'all';
            
            const animate = document.createElementNS(svgNS, 'animate');
            animate.setAttribute('attributeName', 'r');
            animate.setAttribute('values', `${radius};${radius + 3};${radius}`);
            animate.setAttribute('dur', '1.5s');
            animate.setAttribute('repeatCount', 'indefinite');
            circle.appendChild(animate);
            
            // Клик по кругу
            circle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });
            
            // Клик по группе
            group.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });
            
            // Touch для мобильных
            circle.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });
            
            group.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });
            
            group.style.pointerEvents = 'all';
        } else if (!isVisited && !isAvailable) {
            circle.setAttribute('opacity', '0.4');
        }
        
        group.appendChild(circle);
        
        // Иконка (не перехватывает клики)
        const icon = document.createElementNS(svgNS, 'text');
        icon.setAttribute('x', cx);
        icon.setAttribute('y', cy + 5);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('font-size', radius > 15 ? '18' : '14');
        icon.setAttribute('pointer-events', 'none');
        icon.textContent = this.getNodeIcon(node.type);
        group.appendChild(icon);
        
        // Подпись для босса и старта
        if (node.type === NODE_TYPES.BOSS || node.type === NODE_TYPES.START) {
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', cx);
            label.setAttribute('y', cy - radius - 8);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', '#fff');
            label.setAttribute('pointer-events', 'none');
            label.textContent = this.getNodeLabel(node.type);
            group.appendChild(label);
        }
        
        return group;
    },
    
    getNodeX(node, width, marginX) {
        const floorNodes = window._currentMapPaths?.[node.floor] || [];
        const maxNodes = Math.max(floorNodes.length, 1);
        const availableWidth = width - 2 * marginX;
        const step = availableWidth / (maxNodes + 1);
        return marginX + step * (node.x + 1);
    },
    
    getNodeY(node, marginY, floorHeight) {
        return marginY + node.floor * floorHeight;
    },
    
    getNodeColor(type) {
        switch (type) {
            case NODE_TYPES.START: return '#4ecdc4';
            case NODE_TYPES.BATTLE: return '#e94560';
            case NODE_TYPES.ELITE: return '#ffd700';
            case NODE_TYPES.REST: return '#4ecdc4';
            case NODE_TYPES.EVENT: return '#a855f7';
            case NODE_TYPES.SHOP: return '#3b82f6';
            case NODE_TYPES.BOSS: return '#ef4444';
            default: return '#666';
        }
    },
    
    getNodeStroke(node) {
        if (node.visited) return '#888';
        return '#fff';
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
    },
    
    renderLegend(container) {
        const legend = document.createElement('div');
        legend.className = 'map-legend';
        legend.innerHTML = `
            <span>⚔️ Бой</span>
            <span>👑 Элита</span>
            <span>🏕️ Отдых</span>
            <span>❓ Событие</span>
            <span>💰 Магазин</span>
            <span>💀 Босс</span>
        `;
        container.appendChild(legend);
    }
};

window._currentMapPaths = null;