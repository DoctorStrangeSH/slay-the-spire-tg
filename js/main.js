// Точка входа
let game;

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        document.body.style.backgroundColor = tg.backgroundColor;
        document.body.style.color = tg.textColor;

        // Telegram WebView can be shorter than the browser's CSS 100dvh.
        // Keep fixed-height gameplay screens aligned with Telegram's stable viewport.
        const syncGameViewportHeight = () => {
            const height = Number(tg.viewportStableHeight || tg.viewportHeight);
            if (!Number.isFinite(height) || height <= 0) return;
            const rootStyle = document.documentElement.style;
            rootStyle.setProperty('--game-viewport-height', `${Math.round(height)}px`);
            const viewportFractions = {
                '--game-viewport-90': 0.90,
                '--game-viewport-92': 0.92,
                '--game-viewport-85': 0.85,
                '--game-viewport-75': 0.75,
                '--game-viewport-73': 0.73
            };
            for (const [property, fraction] of Object.entries(viewportFractions)) {
                rootStyle.setProperty(property, `${Math.round(height * fraction)}px`);
            }
        };
        syncGameViewportHeight();
        tg.onEvent?.('viewportChanged', syncGameViewportHeight);
    }
    
    // Версия сборки видна даже внутри Telegram WebView.
    const build = document.querySelector('meta[name="app-version"]')?.content;
    const label = document.getElementById('app-version');
    if (label) label.textContent = build ? `Версия ${build}` : '';

    // Создаём игру
    game = new Game();
    
    // Показываем меню
    game.showMenu();
    
    // Скрываем экран загрузки
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
});

// Глобальные функции
function showHeroSelect() {
    HeroSelect.show();
}

function startNewGame() {
    showHeroSelect();
}

function continueGame() {
    if (!game.continueSavedGame()) {
        alert('Сохранённый забег не найден или несовместим с текущей версией игры.');
    }
}

function endTurn() {
    game.endTurn();
}

function playSelectedCards() {
    game.playSelectedCards();
}

function drawPile() {
    game.viewDrawPile();
}

function discardPile() {
    game.viewDiscardPile();
}