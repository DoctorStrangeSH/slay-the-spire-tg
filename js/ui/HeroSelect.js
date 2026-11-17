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
            heroCard.style.setProperty('--hero-accent', hero.unlocked ? hero.color : '#666');
            
            if (hero.unlocked) {
                const portrait = ['berserk', 'engineer', 'psyker'].includes(hero.id)
                    ? `<img class="hero-portrait" src="assets/heroes/${hero.id}.svg" alt="Портрет: ${hero.name}" loading="lazy">`
                    : `<div class="hero-emoji">${hero.emoji}</div>`;
                heroCard.innerHTML = `
                    ${portrait}
                    <h3>${hero.name}</h3>
                    <p class="hero-title">${hero.title}</p>
                    <p class="hero-desc">${hero.description}</p>
                    <p>❤️ ${hero.maxHp} HP</p>
                `;
                heroCard.setAttribute('role', 'button');
                heroCard.setAttribute('tabindex', '0');
                heroCard.setAttribute('aria-label', `Выбрать героя: ${hero.name}`);
                heroCard.onclick = () => game.selectHero(hero.id);
                heroCard.onkeydown = event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        game.selectHero(hero.id);
                    }
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