// Połączenie z serwerem Socket.IO
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

// Modal Game Over (dynamic creation or static HTML logic handled here)
let gameOverModal = null;

// Zmienne stanu lokalnego
let myNickname = '';
let isCzar = false;
let currentHand = [];
let gameState = 'LOBBY';

// --- OBSŁUGA LOGOWANIA ---

joinBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!nickname || !password) {
        loginError.textContent = "Podaj nick i hasło!";
        return;
    }

    myNickname = nickname;
    socket.emit('join_game', { nickname, password });
});

socket.on('join_error', (data) => {
    loginError.textContent = data.message;
});

socket.on('join_success', () => {
    // Animacja wyjścia ekranu logowania
    gsap.to('.login-container', { scale: 0.8, opacity: 0, duration: 0.3 });
    gsap.to(loginScreen, {
        opacity: 0,
        delay: 0.2,
        duration: 0.5,
        onComplete: () => {
            loginScreen.classList.add('hidden');
            gameArea.classList.remove('hidden');
            // Animacja wejścia obszaru gry
            gsap.from(gameArea, { opacity: 0, duration: 0.8 });
            gsap.from('#sidebar', { x: -50, opacity: 0, duration: 0.5, delay: 0.3 });
            gsap.from('.game-header', { y: -50, opacity: 0, duration: 0.5, delay: 0.5 });
            gsap.from('#hand-section', { y: 100, opacity: 0, duration: 0.5, delay: 0.7 });
        }
    });
});

// --- OBSŁUGA GRY ---

startBtn.addEventListener('click', () => {
    socket.emit('start_game');
});

// Otrzymanie wiadomości (powiadomienia)
socket.on('message', (data) => {
    showToast(data.text);
});

// Aktualizacja ręki gracza
socket.on('hand_update', (data) => {
    updateHand(data.hand);
});

// GAME OVER
socket.on('game_over', (data) => {
    showGameOver(data.winner);
});

// Główna aktualizacja stanu gry
socket.on('game_update', (data) => {
    // Jeśli był modal game over, a stan się zresetował, usuń modal
    if (gameOverModal && data.state === 'LOBBY') {
        document.body.removeChild(gameOverModal);
        gameOverModal = null;
    }

    gameState = data.state;

    // 1. Aktualizacja statusu i UI Cara
    updateStatusPanel(data);

    // 2. Aktualizacja listy graczy
    updatePlayerList(data.players);

    // 3. Aktualizacja czarnej karty
    updateBlackCard(data.current_black_card);

    // 4. Aktualizacja kart na stole
    updateTableCards(data.table_cards);

    // Przycisk Start (tylko w lobby)
    if (gameState === 'LOBBY') {
        startBtn.classList.remove('hidden');
        gsap.to(startBtn, { autoAlpha: 1 });
    } else {
        gsap.to(startBtn, { autoAlpha: 0, onComplete: () => startBtn.classList.add('hidden') });
    }
});

// --- FUNKCJE UI I ANIMACJE ---

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
}

function updateStatusPanel(data) {
    const czarNick = data.czar_nickname;
    czarName.textContent = czarNick || '-';

    const me = data.players.find(p => p.nickname === myNickname);
    if (me) {
        isCzar = me.is_czar;
    }

    let statusText = '';
    if (data.state === 'LOBBY') {
        statusText = 'Oczekiwanie na rozpoczęcie...';
    } else if (data.state === 'SELECTION') {
        if (isCzar) {
            statusText = 'Jesteś Carem! Czekaj na wybory graczy.';
        } else {
            statusText = 'Wybierz najśmieszniejszą kartę!';
        }
    } else if (data.state === 'JUDGING') {
        if (isCzar) {
            statusText = 'Wybierz zwycięzcę!';
        } else {
            statusText = 'Car wybiera zwycięzcę...';
        }
    }
    gameStatus.textContent = statusText;
}

function updatePlayerList(players) {
    playersList.innerHTML = '';
    // Sortuj tak, żeby 'ja' byłem na górze, albo po wyniku
    players.sort((a,b) => b.score - a.score);

    players.forEach((p, index) => {
        const li = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.nickname;
        if (p.nickname === myNickname) nameSpan.style.fontWeight = 'bold';

        const infoDiv = document.createElement('div');

        if (p.is_czar) {
            const badge = document.createElement('span');
            badge.className = 'czar-badge';
            badge.textContent = 'CAR';
            infoDiv.appendChild(badge);
        }

        const scoreSpan = document.createElement('span');
        scoreSpan.style.marginLeft = '10px';
        scoreSpan.style.fontWeight = '700';
        scoreSpan.textContent = `${p.score}`;

        infoDiv.appendChild(scoreSpan);
        li.appendChild(nameSpan);
        li.appendChild(infoDiv);

        if (gameState === 'SELECTION' && !p.is_czar && p.has_played) {
            li.style.borderLeft = '5px solid #2ecc71';
        }

        playersList.appendChild(li);

        // Animacja listy tylko przy zmianie liczby elementów (uproszczone)
        // gsap.from(li, { x: -20, opacity: 0, delay: index * 0.1 });
    });
}

// Globalny stan czarnej karty, żeby nie animować przy każdym ticku
let lastBlackCard = '';

function updateBlackCard(cardText) {
    if (cardText === lastBlackCard) return;
    lastBlackCard = cardText;

    blackCardContainer.innerHTML = '';
    if (!cardText) return;

    const card = document.createElement('div');
    card.className = 'card black-card';
    card.innerHTML = cardText.replace(/_____/g, '__________');
    addTiltEffect(card);

    blackCardContainer.appendChild(card);

    // Animacja wejścia 3D
    gsap.fromTo(card,
        { rotateY: 90, opacity: 0 },
        { rotateY: 0, opacity: 1, duration: 0.8, ease: "back.out(1.2)" }
    );
}

function updateTableCards(cards) {
    playedCardsContainer.innerHTML = '';

    cards.forEach((entry, index) => {
        const cardDiv = document.createElement('div');

        if (!entry.revealed) {
            cardDiv.className = 'card hidden-card';
        } else {
            cardDiv.className = 'card white-card';
            cardDiv.textContent = entry.card;
            addTiltEffect(cardDiv); // 3D tilt

            if (gameState === 'JUDGING' && isCzar) {
                cardDiv.onclick = () => selectWinner(entry.card);
                cardDiv.style.cursor = 'pointer';
                cardDiv.title = "Wybierz zwycięzcę";

                // Pulsowanie dla Cara
                gsap.to(cardDiv, { scale: 1.02, duration: 0.8, yoyo: true, repeat: -1 });
            }
        }

        playedCardsContainer.appendChild(cardDiv);

        // Animacje
        if (gameState === 'JUDGING' && entry.revealed) {
             gsap.from(cardDiv, { rotationY: 180, duration: 0.6, delay: index * 0.15, ease: "power2.out" });
        } else {
             // Wlatywanie na stół
             gsap.from(cardDiv, { y: 200, opacity: 0, scale: 0.5, duration: 0.5, ease: "back.out(1)" });
        }
    });
}

function updateHand(hand) {
    // Only update if changes detected (simple check)
    // To keep it smooth, we usually redraw. GSAP handles from() gracefully.

    if (JSON.stringify(hand) === JSON.stringify(currentHand)) return;
    currentHand = hand;
    handContainer.innerHTML = '';

    hand.forEach((cardText, index) => {
        const card = document.createElement('div');
        card.className = 'card white-card';
        card.textContent = cardText;
        addTiltEffect(card);

        // Kliknięcie
        card.addEventListener('click', () => {
            playCard(cardText, card);
        });

        handContainer.appendChild(card);

        // Staggered deal animation
        gsap.from(card, {
            y: 300,
            rotation: Math.random() * 20 - 10,
            opacity: 0,
            duration: 0.6,
            delay: index * 0.1,
            ease: "power3.out"
        });
    });
}

function playCard(cardText, cardElement) {
    if (gameState !== 'SELECTION') return;
    if (isCzar) {
        showToast("Jesteś Carem! Nie możesz grać kart.");
        return;
    }

    // Animacja lotu na środek
    const tableRect = playedCardsContainer.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Oblicz środek kontenera stołu
    const targetX = tableRect.left + tableRect.width / 2 - cardRect.width / 2;
    const targetY = tableRect.top + tableRect.height / 2 - cardRect.height / 2;

    const deltaX = targetX - cardRect.left;
    const deltaY = targetY - cardRect.top;

    // Klonujemy kartę, żeby oryginał został w strukturze do momentu usunięcia
    // Ale tutaj prościej: animujemy oryginał
    cardElement.style.zIndex = 1000;

    gsap.to(cardElement, {
        x: deltaX,
        y: deltaY,
        rotation: 0,
        scale: 0.8,
        opacity: 0,
        duration: 0.6,
        ease: "power2.in",
        onComplete: () => {
            socket.emit('play_card', { card: cardText });
            // Lokalne usunięcie dla płynności (backend i tak nadpisze przy update)
            cardElement.style.visibility = 'hidden';
        }
    });
}

function selectWinner(cardText) {
    if (confirm(`Potwierdź wybór: "${cardText}"`)) {
        socket.emit('select_winner', { card: cardText });
        fireConfetti();
    }
}

// --- 3D TILT EFFECT ---
function addTiltEffect(element) {
    element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10; // Max 10 deg
        const rotateY = ((x - centerX) / centerX) * 10;

        gsap.to(element, {
            rotationX: rotateX,
            rotationY: rotateY,
            scale: 1.05,
            duration: 0.2,
            ease: "power1.out"
        });
    });

    element.addEventListener('mouseleave', () => {
        gsap.to(element, {
            rotationX: 0,
            rotationY: 0,
            scale: 1,
            duration: 0.5,
            ease: "elastic.out(1, 0.5)"
        });
    });
}

// --- CONFETTI ---
function fireConfetti() {
    // Proste confetti w CSS/JS bez zewn biblioteki (chyba że dodamy canvas-confetti, ale zróbmy proste DOM particles)
    const count = 50;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.top = '50%';
        particle.style.left = '50%';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 50%)`;
        particle.style.zIndex = '9999';
        particle.style.borderRadius = '50%';
        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 200 + Math.random() * 300;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        gsap.to(particle, {
            x: tx,
            y: ty,
            opacity: 0,
            duration: 1 + Math.random(),
            ease: "power2.out",
            onComplete: () => particle.remove()
        });
    }
}

// --- GAME OVER MODAL ---
function showGameOver(winnerNick) {
    gameOverModal = document.createElement('div');
    gameOverModal.className = 'modal-overlay';

    gameOverModal.innerHTML = `
        <div class="modal-content">
            <h1>KONIEC GRY!</h1>
            <p style="font-size: 1.5rem; margin-bottom: 20px;">Zwycięzca:</p>
            <h2 style="font-size: 3rem; color: #2ecc71; margin-bottom: 30px;">${winnerNick}</h2>
            <button class="modal-btn" id="restart-game-btn">ZAGRAJ PONOWNIE</button>
        </div>
    `;

    document.body.appendChild(gameOverModal);
    fireConfetti(); // Więcej confetti!

    document.getElementById('restart-game-btn').addEventListener('click', () => {
        socket.emit('start_game'); // Restartuje grę
    });
}
