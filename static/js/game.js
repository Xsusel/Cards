const socket = io();

// Elementy DOM
const loginScreen = document.getElementById('login-screen');
const gameArea = document.getElementById('game-area');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const joinBtn = document.getElementById('join-btn');
const loginError = document.getElementById('login-error');

const startBtn = document.getElementById('start-btn');
const gameStatus = document.getElementById('game-status');
const czarName = document.getElementById('czar-name');
const blackCardContainer = document.getElementById('black-card-container');
const playedCardsContainer = document.getElementById('played-cards-container');
const handContainer = document.getElementById('hand-container');
const playersList = document.getElementById('players-list');
const toastContainer = document.getElementById('toast-container');
const timerDisplay = document.getElementById('timer-display');

const selectionControls = document.getElementById('selection-controls');
const selectedCountSpan = document.getElementById('selected-count');
const requiredCountSpan = document.getElementById('required-count');
const confirmPlayBtn = document.getElementById('confirm-play-btn');

let gameOverModal = null;

// Lokalny stan gry
let myNickname = '';
let isCzar = false;
let currentHand = [];
let gameState = 'LOBBY';
let pickAmount = 1;
let selectedCards = []; // Lista tekstów wybranych kart

// --- LOGOWANIE I INICJALIZACJA ---

// Obsługa przycisku dołączania
joinBtn.addEventListener('click', () => {
    soundManager.playClick();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!nickname || !password) {
        loginError.textContent = "Podaj nick i hasło!";
        return;
    }

    myNickname = nickname;
    socket.emit('join_game', { nickname, password });
});

// Błąd logowania
socket.on('join_error', (data) => {
    loginError.textContent = data.message;
    soundManager.playTone(200, 'sawtooth', 0.2); // Dźwięk błędu
});

// Sukces logowania - animacja wejścia
socket.on('join_success', () => {
    soundManager.playTone(600, 'sine', 0.3);
    gsap.to('.login-container', { scale: 0.8, opacity: 0, duration: 0.3 });
    gsap.to(loginScreen, {
        opacity: 0,
        delay: 0.2,
        duration: 0.5,
        onComplete: () => {
            loginScreen.classList.add('hidden');
            gameArea.classList.remove('hidden');
            gsap.from(gameArea, { opacity: 0, duration: 0.8 });
            initBackgroundAnimation();
        }
    });
});

// --- PĘTLA GRY ---

// Rozpoczęcie gry
startBtn.addEventListener('click', () => {
    soundManager.playClick();
    socket.emit('start_game');
});

// Odbieranie wiadomości tekstowych
socket.on('message', (data) => {
    showToast(data.text);
    soundManager.playPop();
});

// Aktualizacja ręki z serwera
socket.on('hand_update', (data) => {
    updateHand(data.hand);
});

// Aktualizacja licznika czasu
socket.on('timer_update', (data) => {
    timerDisplay.textContent = data.time;
    if (data.time <= 10) {
        timerDisplay.style.color = 'red';
        if (data.time > 0) soundManager.playTone(800, 'square', 0.05, 0.05); // Tykanie
    } else {
        timerDisplay.style.color = 'var(--text-dark)';
    }
});

// Koniec gry
socket.on('game_over', (data) => {
    soundManager.playWin();
    showGameOver(data.winner);
});

// Główna aktualizacja stanu gry
socket.on('game_update', (data) => {
    if (gameOverModal && data.state === 'LOBBY') {
        document.body.removeChild(gameOverModal);
        gameOverModal = null;
    }

    gameState = data.state;

    // Logika ilości kart do wybrania (Pick 2)
    if (data.current_black_card) {
        pickAmount = data.current_black_card.pick || 1;
    } else {
        pickAmount = 1;
    }

    updateStatusPanel(data);
    updatePlayerList(data.players);
    updateBlackCard(data.current_black_card);
    updateTableCards(data.table_cards);

    // Widoczność kontrolek
    if (gameState === 'LOBBY') {
        startBtn.classList.remove('hidden');
        timerDisplay.classList.add('hidden');
        selectionControls.classList.add('hidden');
    } else {
        startBtn.classList.add('hidden');
        timerDisplay.classList.remove('hidden');

        if (gameState === 'SELECTION' && !isCzar) {
            selectionControls.classList.remove('hidden');
            requiredCountSpan.textContent = pickAmount;
            updateSelectionUI();
        } else {
            selectionControls.classList.add('hidden');
        }
    }
});

// Zatwierdzenie wyboru kart
confirmPlayBtn.addEventListener('click', () => {
    if (selectedCards.length !== pickAmount) return;
    soundManager.playClick();
    socket.emit('play_cards', { cards: selectedCards });

    // Lokalna animacja usunięcia
    selectedCards.forEach(cardText => {
        const els = Array.from(handContainer.children);
        const el = els.find(e => e.textContent === cardText);
        if (el) {
             gsap.to(el, { y: -200, opacity: 0, duration: 0.5 });
        }
    });

    selectedCards = [];
    updateSelectionUI();
});


// --- FUNKCJE UI ---

// Wyświetlanie powiadomień (Toast)
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast && toast.remove(), 3500);
}

// Aktualizacja panelu statusu
function updateStatusPanel(data) {
    czarName.textContent = data.czar_nickname || '-';
    const me = data.players.find(p => p.nickname === myNickname);
    if (me) isCzar = me.is_czar;

    let statusText = '';
    if (data.state === 'LOBBY') statusText = 'Oczekiwanie...';
    else if (data.state === 'SELECTION') statusText = isCzar ? 'Jesteś Carem. Czekaj.' : `Wybierz ${pickAmount} kart(y)!`;
    else if (data.state === 'JUDGING') statusText = isCzar ? 'Wybierz zwycięzcę!' : 'Car wybiera...';

    gameStatus.textContent = statusText;
}

// Generowanie koloru avatara na podstawie nicku
function generateAvatar(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 80%)`;
}

// Aktualizacja listy graczy
function updatePlayerList(players) {
    playersList.innerHTML = '';
    players.sort((a,b) => b.score - a.score);

    players.forEach(p => {
        const li = document.createElement('li');

        // Avatar
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.style.backgroundColor = generateAvatar(p.nickname);
        avatar.textContent = p.nickname.charAt(0).toUpperCase();

        const details = document.createElement('div');
        details.className = 'player-details';
        details.innerHTML = `
            <div class="p-nick">${p.nickname} ${p.nickname === myNickname ? '(Ty)' : ''}</div>
            <div class="p-score">${p.score} pkt</div>
        `;

        li.appendChild(avatar);
        li.appendChild(details);

        if (p.is_czar) {
            li.classList.add('is-czar');
            const badge = document.createElement('span');
            badge.className = 'czar-badge';
            badge.textContent = 'CAR';
            li.appendChild(badge);
        }

        if (gameState === 'SELECTION' && !p.is_czar && p.has_played) {
            const check = document.createElement('span');
            check.textContent = '✔';
            check.style.color = 'green';
            check.style.fontWeight = 'bold';
            check.style.marginLeft = 'auto';
            li.appendChild(check);
        }

        playersList.appendChild(li);
    });
}

// Aktualizacja czarnej karty (z obsługą animacji)
let lastBlackCardText = '';
function updateBlackCard(cardData) {
    if (!cardData) {
        blackCardContainer.innerHTML = '';
        lastBlackCardText = '';
        return;
    }

    if (cardData.text === lastBlackCardText) return;
    lastBlackCardText = cardData.text;

    blackCardContainer.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'card black-card';
    card.innerHTML = cardData.text.replace(/_____/g, '__________');

    if (cardData.pick > 1) {
        const pickBadge = document.createElement('div');
        pickBadge.className = 'pick-badge';
        pickBadge.textContent = `WYBIERZ ${cardData.pick}`;
        card.appendChild(pickBadge);
    }

    addTiltEffect(card);
    blackCardContainer.appendChild(card);
    soundManager.playDeal();

    gsap.fromTo(card, { rotateY: 90, opacity: 0 }, { rotateY: 0, opacity: 1, duration: 0.8, ease: "back.out(1.2)" });
}

// Aktualizacja kart na stole
function updateTableCards(tableCards) {
    playedCardsContainer.innerHTML = '';

    tableCards.forEach((entry, index) => {
        // Grupowanie kart dla trybu Pick 2
        const groupDiv = document.createElement('div');
        groupDiv.className = 'card-group';

        entry.cards.forEach((cardText, cIndex) => {
            const cardDiv = document.createElement('div');
            if (!entry.revealed) {
                cardDiv.className = 'card hidden-card';
            } else {
                cardDiv.className = 'card white-card';
                cardDiv.textContent = cardText;
                addTiltEffect(cardDiv);
            }

            // Efekt stosu dla grup
            if (cIndex > 0) {
                cardDiv.style.marginTop = '-150px'; // Nałożenie
                cardDiv.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
            }

            groupDiv.appendChild(cardDiv);
        });

        if (gameState === 'JUDGING' && isCzar) {
            groupDiv.style.cursor = 'pointer';
            groupDiv.onclick = () => selectWinner(entry.cards);
            groupDiv.title = "Wybierz ten zestaw";
        }

        playedCardsContainer.appendChild(groupDiv);

        if (gameState === 'JUDGING' && entry.revealed) {
            gsap.from(groupDiv.children, {
                rotationY: 180,
                duration: 0.6,
                stagger: 0.1,
                delay: index * 0.2
            });
        }
    });
}

// Aktualizacja ręki gracza
function updateHand(hand) {
    handContainer.innerHTML = '';

    hand.forEach((cardText, index) => {
        const card = document.createElement('div');
        card.className = 'card white-card';
        card.textContent = cardText;

        if (selectedCards.includes(cardText)) {
            card.classList.add('selected');
            const num = selectedCards.indexOf(cardText) + 1;
            card.setAttribute('data-order', num);
        }

        card.addEventListener('click', () => toggleCardSelection(cardText, card));
        card.addEventListener('mouseenter', () => soundManager.playHover());

        addTiltEffect(card);
        handContainer.appendChild(card);
    });
}

// Przełączanie zaznaczenia karty
function toggleCardSelection(cardText, element) {
    if (gameState !== 'SELECTION' || isCzar) return;

    if (selectedCards.includes(cardText)) {
        // Odznaczenie
        selectedCards = selectedCards.filter(c => c !== cardText);
        element.classList.remove('selected');
        element.removeAttribute('data-order');
        soundManager.playClick();
    } else {
        // Zaznaczenie
        if (selectedCards.length < pickAmount) {
            selectedCards.push(cardText);
            element.classList.add('selected');
            soundManager.playClick();
        } else {
            // Wibracja jeśli limit osiągnięty
            gsap.to(element, { x: 5, duration: 0.1, yoyo: true, repeat: 3 });
        }
    }

    updateSelectionBadges();
    updateSelectionUI();
}

// Aktualizacja numerków kolejności wyboru
function updateSelectionBadges() {
    const cards = handContainer.querySelectorAll('.card');
    cards.forEach(c => {
        const text = c.textContent;
        const idx = selectedCards.indexOf(text);
        if (idx > -1) {
            c.setAttribute('data-order', idx + 1);
        } else {
            c.removeAttribute('data-order');
        }
    });
}

// Aktualizacja UI kontrolek wyboru
function updateSelectionUI() {
    selectedCountSpan.textContent = selectedCards.length;
    confirmPlayBtn.disabled = (selectedCards.length !== pickAmount);

    if (!confirmPlayBtn.disabled) {
        gsap.to(confirmPlayBtn, { scale: 1.1, duration: 0.3, yoyo: true, repeat: 1 });
    }
}

// Wybór zwycięzcy przez Cara
function selectWinner(cards) {
    if (confirm("Potwierdzasz ten wybór?")) {
        soundManager.playClick();
        socket.emit('select_winner', { cards: cards });
        fireConfetti();
    }
}

// --- EFEKTY WIZUALNE ---

// Efekt 3D Tilt (pochylenie karty)
function addTiltEffect(element) {
    element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateX = ((y - rect.height/2) / (rect.height/2)) * -10;
        const rotateY = ((x - rect.width/2) / (rect.width/2)) * 10;

        gsap.to(element, { rotationX: rotateX, rotationY: rotateY, scale: 1.05, duration: 0.2 });
    });
    element.addEventListener('mouseleave', () => {
        gsap.to(element, { rotationX: 0, rotationY: 0, scale: 1, duration: 0.5 });
    });
}

// Efekt Konfetti
function fireConfetti() {
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff'];
    for(let i=0; i<100; i++) {
        const p = document.createElement('div');
        p.style.cssText = `position:fixed;top:50%;left:50%;width:8px;height:8px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:50%;pointer-events:none;z-index:9999;`;
        document.body.appendChild(p);
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 400;
        gsap.to(p, {
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            opacity: 0,
            duration: 1 + Math.random(),
            ease: "power2.out",
            onComplete: () => p.remove()
        });
    }
}

// Modal Koniec Gry
function showGameOver(winner) {
    gameOverModal = document.createElement('div');
    gameOverModal.className = 'modal-overlay';
    gameOverModal.innerHTML = `
        <div class="modal-content">
            <h1>KONIEC GRY!</h1>
            <p>Mistrz humoru:</p>
            <h2 style="font-size:3rem;color:#2ecc71">${winner}</h2>
            <button class="modal-btn" onclick="socket.emit('start_game')">REWANŻ</button>
        </div>
    `;
    document.body.appendChild(gameOverModal);
    fireConfetti();
}

// Inicjalizacja tła (placeholder pod przyszłe efekty)
function initBackgroundAnimation() {
    // Tło jest obsługiwane przez CSS
}
