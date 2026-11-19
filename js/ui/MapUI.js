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

    getRouteAdvice(type, player) {
        if (!player) return '';
        const hp = Number(player.hp);
        const maxHp = Number(player.maxHp);
        const gold = Number(player.gold);
        const hasHealth = Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0;
        const lowHealth = hasHealth && hp / maxHp <= 0.35;
        if (type === NODE_TYPES.SHOP && Number.isFinite(gold)) {
            return `💰 У вас ${Math.max(0, Math.floor(gold))} золота`;
        }
        if (type === NODE_TYPES.REST && hasHealth) {
            const gain = Math.min(Math.max(0, Math.floor(maxHp - hp)), Math.floor(maxHp * 0.3));
            return gain > 0 ? `❤️ Восстановите до ${gain} здоровья` : '❤️ Здоровье уже полное';
        }
        if ((type === NODE_TYPES.ELITE || type === NODE_TYPES.BOSS) && lowHealth) {
            return '⚠️ Опасно: осталось мало здоровья';
        }
        if (type === NODE_TYPES.BATTLE && lowHealth) {
            return '⚠️ Мало здоровья перед сражением';
        }
        return '';
    },

    getRouteForecast(node, mapGenerator) {
        if (!node || !Array.isArray(node.connections)) return '';
        const destinations = node.connections
            .map(id => mapGenerator.findNodeById(id))
            .filter(Boolean);
        const labels = [...new Set(destinations.map(next =>
            this.getNodeIcon(next.type) + ' ' + this.getNodeLabel(next.type)))];
        if (!labels.length) return '';
        // Видимость развилки важна не меньше типа следующей комнаты:
        // несколько узлов одного типа — всё равно разные маршруты.
        const branchCount = destinations.length;
        return 'После: ' + labels.join(' · ') +
            (branchCount > 1 ? ` · ${branchCount} варианта пути` : ' · один путь');
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
            const advice = this.getRouteAdvice(node.type, game.player);
            button.setAttribute('aria-label', details.label + '. ' + details.hint +
                (forecast ? '. ' + forecast : '') + (advice ? '. ' + advice : ''));
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
            if (advice) {
                const context = document.createElement('span');
                context.className = 'spire-next-advice';
                context.textContent = advice;
                copy.appendChild(context);
            }
            if (forecast) {
                const future = document.createElement('span');
                future.className = 'spire-next-forecast';
                future.textContent = forecast;
                copy.appendChild(future);
            }
            button.appendChild(icon);
            button.appendChild(copy);
            button.addEventListener('click', () => game.selectMapNode(node));
            button.addEventListener('pointerenter', () =>
                this.highlightRoute(container, node.id, game.currentNodeId, true));
            button.addEventListener('pointerleave', () =>
                this.highlightRoute(container, node.id, game.currentNodeId, false));
            button.addEventListener('focus', () =>
                this.highlightRoute(container, node.id, game.currentNodeId, true));
            button.addEventListener('blur', () =>
                this.highlightRoute(container, node.id, game.currentNodeId, false));
            list.appendChild(button);
        });
        panel.appendChild(list);
        container.appendChild(panel);
    },

    highlightRoute(container, destinationId, currentNodeId, active) {
        if (!container || typeof container.querySelectorAll !== 'function') return;
        container.querySelectorAll('.spire-room, .spire-route').forEach(element => {
            const matchesRoom = element.classList.contains('spire-room') &&
                element.getAttribute('data-route-to') === destinationId;
            const matchesEdge = element.classList.contains('spire-route') &&
                element.getAttribute('data-route-from') === currentNodeId &&
                element.getAttribute('data-route-to') === destinationId;
            if (matchesRoom || matchesEdge) element.classList.toggle('is-route-preview', active);
        });
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
        svg.setAttribute('role', 'group');
        svg.setAttribute('aria-label', 'Карта восхождения: двигайтесь снизу вверх по светящимся развилкам');
        
        // getNodeX needs the actual floor membership to centre single-room milestones.
        window._currentMapPaths = game.mapGenerator.paths;
        const availableNodes = game.mapGenerator.getAvailableNodes(game.currentNodeId);
        const currentNode = game.mapGenerator.findNodeById(game.currentNodeId);
        const currentFloor = currentNode ? currentNode.floor : 0;
        
        // Нумерация этажей — ориентир на длинной вертикальной карте.
        // Значимые этапы получают более заметную печать на полях.
        for (let floor = 0; floor < game.mapGenerator.floors; floor++) {
            const y = marginY + (game.mapGenerator.floors - 1 - floor) * floorHeight;
            const milestone = [0, 8, 14, game.mapGenerator.floors - 1].includes(floor);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('class', 'spire-floor-marker' +
                (milestone ? ' is-milestone' : '') +
                (floor === currentFloor ? ' is-current' : ''));
            label.setAttribute('x', '13');
            label.setAttribute('y', String(y + 4));
            label.setAttribute('text-anchor', 'start');
            label.textContent = String(floor + 1).padStart(2, '0');
            svg.appendChild(label);
        }

        // Рисуем соединения
        game.mapGenerator.paths.forEach((floorNodes) => {
            floorNodes.forEach(node => {
                node.connections.forEach(connId => {
                    const targetNode = game.mapGenerator.findNodeById(connId);
                    if (targetNode) {
                        const line = this.createConnectionLine(node, targetNode, svgNS, width, marginX, marginY, floorHeight, currentNode?.id);
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
    
    createConnectionLine(node1, node2, svgNS, width, marginX, marginY, floorHeight, currentNodeId) {
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
        line.setAttribute('data-route-from', node1.id);
        line.setAttribute('data-route-to', node2.id);
        const isVisited = node1.visited && node2.visited;
        const isAvailable = node1.id === currentNodeId && !node2.visited;
        
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
        group.setAttribute('data-route-to', node.id);
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
            
            // A forgiving transparent target makes narrow mobile atlas branches tappable.
            // The visible circle and all decorative elements keep their original size.
            const hitTarget = document.createElementNS(svgNS, 'circle');
            hitTarget.setAttribute('class', 'spire-room-hit-target');
            hitTarget.setAttribute('cx', cx);
            hitTarget.setAttribute('cy', cy);
            hitTarget.setAttribute('r', Math.max(radius, 30));
            hitTarget.setAttribute('fill', 'transparent');
            hitTarget.setAttribute('pointer-events', 'all');
            group.appendChild(hitTarget);

            group.setAttribute('role', 'button');
            group.setAttribute('tabindex', '0');
            const details = this.getRoomDetails(node.type);
            group.setAttribute('aria-label', details.label + ' — доступно. ' + details.hint);
            group.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });
            group.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                game.selectMapNode(node);
            });

            // A click already covers touch input: touchend would select twice.
            group.style.pointerEvents = 'all';
        } else if (!isVisited && !isAvailable) {
            circle.setAttribute('opacity', '0.4');
        }
        
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = this.getNodeLabel(node.type) + (isAvailable ? ' — доступно' : isVisited ? ' — пройдено' : '');
        group.appendChild(title);
        const ornament = this.createRoomOrnament(node.type, cx, cy, svgNS);
        if (ornament) group.appendChild(ornament);
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
    
    createRoomOrnament(type, x, y, svgNS) {
        // Silhouettes remain visible around the circular tap target.
        // Decoration is non-interactive and cannot intercept room selection.
        const designs = {
            elite: `M ${x} ${y - 27} L ${x + 27} ${y} L ${x} ${y + 27} L ${x - 27} ${y} Z`,
            shop: `M ${x - 24} ${y - 24} H ${x + 24} V ${y + 24} H ${x - 24} Z`,
            rest: `M ${x - 26} ${y + 5} A 27 27 0 0 1 ${x + 26} ${y + 5}`,
            treasure: `M ${x - 25} ${y - 12} L ${x} ${y - 27} L ${x + 25} ${y - 12} L ${x + 25} ${y + 12} L ${x} ${y + 27} L ${x - 25} ${y + 12} Z`,
            boss: `M ${x - 32} ${y - 19} L ${x - 20} ${y - 32} L ${x} ${y - 24} L ${x + 20} ${y - 32} L ${x + 32} ${y - 19} L ${x + 28} ${y + 24} L ${x} ${y + 33} L ${x - 28} ${y + 24} Z`
        };
        if (!designs[type]) return null;
        const ornament = document.createElementNS(svgNS, 'path');
        ornament.setAttribute('class', 'spire-room-ornament spire-room-ornament--' + type);
        ornament.setAttribute('d', designs[type]);
        ornament.setAttribute('fill', 'none');
        ornament.setAttribute('pointer-events', 'none');
        ornament.setAttribute('aria-hidden', 'true');
        return ornament;
    },

    getNodeX(node, width, marginX) {
        const floorNodes = window._currentMapPaths?.[node.floor] || [];
        const availableWidth = width - 2 * marginX;
        if (floorNodes.length === 1) return width / 2;
        if (window._currentMapOrganicLayout) {
            // Keep some seeded asymmetry while distributing rooms evenly enough
            // to prevent steep cross-screen diagonals between adjacent floors.
            const rank = floorNodes.findIndex(room => room.id === node.id);
            const natural = (node.x + 1) / 8;
            const balanced = rank < 0 ? natural : (rank + 1) / (floorNodes.length + 1);
            return marginX + availableWidth * (natural * 0.3 + balanced * 0.7);
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