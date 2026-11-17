// UI карты мира с SVG-визуализацией
const MapUI = {
    getActTheme(act) {
        const themes = {
            1: { name: 'Заброшенные сады', subtitle: 'Там, где корни хранят древние клятвы', sigil: '❧', style: 'garden' },
            2: { name: 'Пепельные глубины', subtitle: 'Под каменными сводами не гаснет жар', sigil: '◆', style: 'depths' },
            3: { name: 'Проклятая цитадель', subtitle: 'Последняя ступень к сердцу шпиля', sigil: '✧', style: 'citadel' }
        };
        return themes[act] || { name: 'Неизведанные пределы', subtitle: 'Путь ещё не окончен', sigil: '✦', style: 'unknown' };
    },

    render(game) {
        const mapContainer = document.getElementById('map-nodes');
        mapContainer.innerHTML = '';
        const theme = this.getActTheme(game.act);
        const screen = document.getElementById('map-screen');
        if (screen) screen.dataset.actTheme = theme.style;
        
        // Заголовок
        const actInfo = document.createElement('div');
        actInfo.className = 'act-info cathedral-act-banner';
        const floor = Math.min(Math.max(Number(game.floor) + 1 || 1, 1), game.mapGenerator.floors);
        const progress = Math.round((floor / game.mapGenerator.floors) * 100);
        actInfo.innerHTML = `
            <div class="act-banner-sigil" aria-hidden="true">${theme.sigil}</div>
            <div class="act-banner-copy">
                <span class="act-banner-kicker">АКТ ${game.act} · ВОСХОЖДЕНИЕ</span>
                <h2>${theme.name}</h2>
                <p class="act-banner-subtitle">${theme.subtitle}</p>
                <div class="act-banner-progress" role="progressbar" aria-label="Пройдено этажей акта" aria-valuemin="0" aria-valuemax="${game.mapGenerator.floors}" aria-valuenow="${floor}">
                    <span style="width: ${progress}%"></span>
                </div>
                <p class="act-banner-stats">Этаж ${floor} из ${game.mapGenerator.floors} <span>✦</span> ❤ ${game.player.hp}/${game.player.maxHp} <span>✦</span> ◈ ${game.player.gold}</p>
            </div>
        `;
        mapContainer.appendChild(actInfo);
        if ((Number(game.player.blessingBattles) || 0) > 0) {
            const blessing = document.createElement('button');
            blessing.className = 'cathedral-map-blessing';
            blessing.type = 'button';
            blessing.onclick = () => game.showConditions();
            blessing.textContent = `☼ Золотое пламя · +5 блока в начале следующих ${game.player.blessingBattles} боёв`;
            mapContainer.appendChild(blessing);
        }
        
        if ((Number(game.player.ashBattles) || 0) > 0) {
            const ash = document.createElement('button');
            ash.className = 'cathedral-map-blessing';
            ash.type = 'button';
            ash.onclick = () => game.showConditions();
            ash.textContent = `✹ Пепельная печать · +2 силы в следующих ${game.player.ashBattles} боях`;
            mapContainer.appendChild(ash);
        }

        if ((Number(game.player.oathBattles) || 0) > 0) {
            const oath = document.createElement('button');
            oath.className = 'cathedral-map-blessing';
            oath.type = 'button';
            oath.onclick = () => game.showConditions();
            oath.textContent = `☾ Лунная клятва · +1 энергия в начале следующих ${game.player.oathBattles} боёв`;
            mapContainer.appendChild(oath);
        }

        if ((Number(game.player.bloodMarkBattles) || 0) > 0) {
            const bloodMark = document.createElement('button');
            bloodMark.className = 'cathedral-map-curse';
            bloodMark.type = 'button';
            bloodMark.onclick = () => game.showConditions();
            bloodMark.textContent = `♥ Кровавая метка · −4 HP в начале следующих ${game.player.bloodMarkBattles} боёв`;
            mapContainer.appendChild(bloodMark);
        }

        if ((Number(game.player.exhaustionBattles) || 0) > 0) {
            const exhaustion = document.createElement('button');
            exhaustion.className = 'cathedral-map-curse';
            exhaustion.type = 'button';
            exhaustion.onclick = () => game.showConditions();
            exhaustion.textContent = `♜ Истощение · −2 силы в следующих ${game.player.exhaustionBattles} боях`;
            mapContainer.appendChild(exhaustion);
        }

        if ((Number(game.player.curseBattles) || 0) > 0) {
            const curse = document.createElement('button');
            curse.className = 'cathedral-map-curse';
            curse.type = 'button';
            curse.onclick = () => game.showConditions();
            curse.textContent = `☷ Монета Забытого Долга · −1 энергия в начале следующих ${game.player.curseBattles} боёв`;
            mapContainer.appendChild(curse);
        }

        // Доступные развилки дублируются крупными карточками для телефона.
        this.renderNextChoices(mapContainer, game);

        // Создаём SVG для карты
        window._currentMapOrganicLayout = !game.mapGenerator.legacyLayout && !game.mapGenerator.legacyBranchingLayout;
        const svg = this.createSVG(game);
        mapContainer.appendChild(svg);
        // Начало маршрута внизу, вершина с боссом — наверху.
        // Показываем текущий этаж сразу, не заставляя игрока его искать.
        requestAnimationFrame(() => {
            const current = game.mapGenerator.findNodeById(game.currentNodeId);
            const targetY = current ? this.getNodeY(current, 36,
                (1040 - 72) / (game.mapGenerator.floors - 1)) : 1040;
            const viewport = mapContainer.clientHeight || 400;
            mapContainer.scrollTop = Math.max(0, targetY * (svg.getBoundingClientRect().height / 1040) - viewport * 0.64);
        });

        // Легенда
        this.renderLegend(mapContainer);
    },
    
    getRoomDetails(type) {
        const rooms = {
            [NODE_TYPES.BATTLE]: { label: 'Обычный бой', hint: 'Золото и выбор карты', risk: 'Умеренный риск' },
            [NODE_TYPES.ELITE]: { label: 'Элитный бой', hint: 'Опасный враг и реликвия', risk: 'Высокий риск' },
            [NODE_TYPES.EVENT]: { label: 'Неизвестное событие', hint: 'Выбор, награда или испытание', risk: 'Неизвестный исход' },
            [NODE_TYPES.REST]: { label: 'Привал', hint: 'Возможность восстановиться', risk: 'Безопасная комната' },
            [NODE_TYPES.SHOP]: { label: 'Магазин', hint: 'Карты и полезные покупки', risk: 'Без боя' },
            [NODE_TYPES.TREASURE]: { label: 'Сокровищница', hint: 'Ценная награда', risk: 'Без боя' },
            [NODE_TYPES.BOSS]: { label: 'Босс акта', hint: 'Главное испытание', risk: 'Очень высокий риск' }
        };
        return rooms[type] || { label: 'Путь вперёд', hint: 'Неизведанная комната', risk: '' };
    },

    getRouteForecast(node, mapGenerator) {
        if (!node || !Array.isArray(node.connections)) return '';
        const destinations = node.connections
            .map(id => mapGenerator.findNodeById(id))
            .filter(Boolean);
        const labels = [...new Set(destinations.map(next =>
            this.getNodeIcon(next.type) + ' ' + this.getNodeLabel(next.type)))];
        return labels.length ? 'После: ' + labels.join(' · ') : '';
    },

    renderNextChoices(container, game) {
        const choices = game.mapGenerator.getAvailableNodes(game.currentNodeId)
            .sort((a, b) => a.x - b.x);
        if (!choices.length) return;
        const panel = document.createElement('section');
        panel.className = 'spire-next-choices';
        panel.setAttribute('aria-label', 'Выбор следующей комнаты');
        const title = document.createElement('div');
        title.className = 'spire-next-heading';
        title.textContent = '✦ ВЫБЕРИТЕ СЛЕДУЮЩУЮ КОМНАТУ';
        panel.appendChild(title);
        const list = document.createElement('div');
        list.className = 'spire-next-list';
        choices.forEach(node => {
            const details = this.getRoomDetails(node.type);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'spire-next-card spire-next-card--' + node.type;
            const forecast = this.getRouteForecast(node, game.mapGenerator);
            button.setAttribute('aria-label', details.label + '. ' + details.hint +
                (forecast ? '. ' + forecast : ''));
            const icon = document.createElement('span');
            icon.className = 'spire-next-icon';
            icon.textContent = this.getNodeIcon(node.type);
            const copy = document.createElement('span');
            copy.className = 'spire-next-copy';
            const name = document.createElement('strong');
            name.textContent = details.label;
            const hint = document.createElement('small');
            hint.textContent = details.hint;
            const risk = document.createElement('em');
            risk.textContent = details.risk;
            copy.appendChild(name);
            copy.appendChild(hint);
            copy.appendChild(risk);
            if (forecast) {
                const future = document.createElement('span');
                future.className = 'spire-next-forecast';
                future.textContent = forecast;
                copy.appendChild(future);
            }
            button.appendChild(icon);
            button.appendChild(copy);
            button.addEventListener('click', () => game.selectMapNode(node));
            list.appendChild(button);
        });
        panel.appendChild(list);
        container.appendChild(panel);
    },

    createSVG(game) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        
        const width = 520;
        const height = 1040;
        const marginX = 24;
        const marginY = 36;
        const floorHeight = (height - 2 * marginY) / (game.mapGenerator.floors - 1);
        
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Карта восхождения: двигайтесь снизу вверх по светящимся развилкам');
        
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
        const line = document.createElementNS(svgNS, 'path');
        
        const x1 = this.getNodeX(node1, width, marginX);
        const y1 = this.getNodeY(node1, marginY, floorHeight);
        const x2 = this.getNodeX(node2, width, marginX);
        const y2 = this.getNodeY(node2, marginY, floorHeight);
        
        const bend = (y2 - y1) * 0.45;
        line.setAttribute('d', `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        
        line.setAttribute('class', 'spire-route');
        const isVisited = node1.visited && node2.visited;
        const isAvailable = node1.visited && !node2.visited;
        
        if (isVisited) {
            line.setAttribute('stroke', '#665a54');
            line.setAttribute('stroke-width', '2');
            line.setAttribute('opacity', '0.5');
        } else if (isAvailable) {
            line.setAttribute('stroke', '#8bbfba');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('opacity', '0.8');
            line.setAttribute('stroke-dasharray', '5,5');
        } else {
            line.setAttribute('stroke', '#685f63');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('opacity', '0.3');
        }
        
        return line;
    },
    
    createNodeElement(node, floorIndex, svgNS, width, marginX, marginY, floorHeight, availableNodes, currentFloor, game) {
        const group = document.createElementNS(svgNS, 'g');
        
        const cx = this.getNodeX(node, width, marginX);
        const cy = this.getNodeY(node, marginY, floorHeight);
        
        let radius = 18;
        if (node.type === NODE_TYPES.BOSS) radius = 25;
        if (node.type === NODE_TYPES.START) radius = 21;
        
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
        group.setAttribute('class', 'spire-room spire-room--' + node.type +
            (isVisited ? ' is-visited' : isAvailable ? ' is-available' : ' is-future'));
        
        if (isVisited) {
            circle.setAttribute('opacity', '0.6');
        } else if (isAvailable && isFutureFloor) {
            circle.setAttribute('stroke', '#8bbfba');
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
            
            // Click уже работает с сенсорным вводом; отдельный touchend
            // вызывал двойное открытие комнаты на некоторых WebView.
            group.style.pointerEvents = 'all';
        } else if (!isVisited && !isAvailable) {
            circle.setAttribute('opacity', '0.4');
        }
        
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = this.getNodeLabel(node.type) + (isAvailable ? ' — доступно' : isVisited ? ' — пройдено' : '');
        group.appendChild(title);
        group.appendChild(circle);
        
        // Иконка (не перехватывает клики)
        const icon = document.createElementNS(svgNS, 'text');
        icon.setAttribute('class', 'spire-room-icon');
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
            label.setAttribute('fill', '#f2e9d9');
            label.setAttribute('pointer-events', 'none');
            label.textContent = this.getNodeLabel(node.type);
            group.appendChild(label);
        }
        
        return group;
    },
    
    getNodeX(node, width, marginX) {
        const floorNodes = window._currentMapPaths?.[node.floor] || [];
        const availableWidth = width - 2 * marginX;
        if (floorNodes.length === 1) return width / 2;
        if (window._currentMapOrganicLayout) {
            return marginX + availableWidth * (node.x + 1) / 8;
        }
        const step = availableWidth / (floorNodes.length + 1);
        return marginX + step * (node.x + 1);
    },
    
    getNodeY(node, marginY, floorHeight) {
        return marginY + (15 - node.floor) * floorHeight;
    },
    
    getNodeColor(type) {
        switch (type) {
            case NODE_TYPES.START: return '#8bbfba';
            case NODE_TYPES.BATTLE: return '#a95061';
            case NODE_TYPES.ELITE: return '#d7b17a';
            case NODE_TYPES.REST: return '#8bbfba';
            case NODE_TYPES.EVENT: return '#8c6ea8';
            case NODE_TYPES.TREASURE: return '#d7aa64';
            case NODE_TYPES.SHOP: return '#668da4';
            case NODE_TYPES.BOSS: return '#a83848';
            default: return '#685f63';
        }
    },
    
    getNodeStroke(node) {
        if (node.visited) return '#888';
        return '#f2e9d9';
    },
    
    getNodeIcon(type) {
        switch (type) {
            case NODE_TYPES.START: return '🏠';
            case NODE_TYPES.BATTLE: return '⚔️';
            case NODE_TYPES.ELITE: return '👑';
            case NODE_TYPES.REST: return '🏕️';
            case NODE_TYPES.EVENT: return '❓';
            case NODE_TYPES.TREASURE: return '🎁';
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
            case NODE_TYPES.TREASURE: return 'Сокровищница';
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
            <span>🎁 Сокровище</span>
            <span>💰 Магазин</span>
            <span>💀 Босс</span>
        `;
        container.appendChild(legend);
    }
};

window._currentMapPaths = null;