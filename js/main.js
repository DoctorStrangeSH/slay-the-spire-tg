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
    }
    
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
    alert('Функция сохранения появится позже!');
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