// UI выбора героя
const HeroSelect = {
    show() {
        hideAllScreens();
        document.getElementById('hero-select').style.display = 'block';
        this.render();
    },
    
    render() {
        const heroList = document.getElementById('hero-list');
        heroList.innerHTML = '';
        
        Object.values(HEROES).forEach(hero => {
            const heroCard = document.createElement('div');
            heroCard.className = 'hero-card';
            heroCard.style.borderColor = hero.unlocked ? hero.color : '#666';
            
            if (hero.unlocked) {
                heroCard.innerHTML = `
                    <div class="hero-emoji">${hero.emoji}</div>
                    <h3>${hero.name}</h3>
                    <p class="hero-title">${hero.title}</p>
                    <p class="hero-desc">${hero.description}</p>
                    <p>❤️ ${hero.maxHp} HP</p>
                `;
                heroCard.onclick = () => {
                    game.selectHero(hero.id);
                };
            } else {
                heroCard.innerHTML = `
                    <div class="hero-emoji">🔒</div>
                    <h3>${hero.name}</h3>
                    <p class="hero-title">${hero.title}</p>
                    <p class="hero-desc">Скоро будет доступен</p>
                `;
                heroCard.style.opacity = '0.5';
            }
            
            heroList.appendChild(heroCard);
        });
    }
};