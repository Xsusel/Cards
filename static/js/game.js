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
    gsap.to(loginScreen, {
        opacity: 0,
        y: -50,
        duration: 0.5,
        onComplete: () => {
            loginScreen.classList.add('hidden');
            gameArea.classList.remove('hidden');
            // Animacja wejścia obszaru gry
            gsap.from(gameArea, { opacity: 0, duration: 0.5 });
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

// Główna aktualizacja stanu gry
socket.on('game_update', (data) => {
    console.log('Game Update:', data);
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
    } else {
        startBtn.classList.add('hidden');
    }
});

// --- FUNKCJE UI I ANIMACJE ---

/**
 * Wyświetla powiadomienie "Toast"
 */
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastContainer.appendChild(toast);

    // Usuwanie po animacji (CSS handle this via animation end, but safety cleanup)
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
}

/**
 * Aktualizuje panel statusu i informację o Carze
 */
function updateStatusPanel(data) {
    const czarNick = data.czar_nickname;
    czarName.textContent = czarNick || '-';

    // Sprawdź czy jestem Carem
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

/**
 * Aktualizuje listę graczy
 */
function updatePlayerList(players) {
    playersList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.nickname;
        if (p.nickname === myNickname) nameSpan.style.fontWeight = 'bold';

        const infoDiv = document.createElement('div');

        if (p.is_czar) {
            const badge = document.createElement('span');
            badge.className = 'czar-badge';
            badge.textContent = 'CAR';
            nameSpan.appendChild(badge);
        }

        const scoreSpan = document.createElement('span');
        scoreSpan.textContent = `${p.score} pkt`;

        infoDiv.appendChild(scoreSpan);
        li.appendChild(nameSpan);
        li.appendChild(infoDiv);

        // Oznacz graczy którzy już zagrali (w fazie SELECTION)
        if (gameState === 'SELECTION' && !p.is_czar && p.has_played) {
            li.style.backgroundColor = '#e8f5e9'; // Lekki zielony
        }

        playersList.appendChild(li);
    });
}

/**
 * Aktualizuje czarną kartę na stole
 */
function updateBlackCard(cardText) {
    blackCardContainer.innerHTML = '';
    if (!cardText) return;

    const card = document.createElement('div');
    card.className = 'card black-card';
    // Podmiana znaków nowej linii na <br> jeśli potrzeba, ale tekst jest zazwyczaj prosty
    // Obsługa "____" - można by pogrubić
    card.innerHTML = cardText.replace(/_____/g, '__________');

    blackCardContainer.appendChild(card);

    // Animacja wejścia (jeśli nowa)
    gsap.from(card, { scale: 0.8, opacity: 0, duration: 0.4, ease: "back.out(1.7)" });
}

/**
 * Aktualizuje karty na stole (zagrane białe)
 */
function updateTableCards(cards) {
    // Diffing dla animacji jest skomplikowany, więc czyścimy i rysujemy,
    // ale staramy się animować tylko nowe.
    // Dla uproszczenia w MVP: renderujemy od nowa i animujemy wejście.

    playedCardsContainer.innerHTML = '';

    cards.forEach((entry, index) => {
        const cardDiv = document.createElement('div');

        if (!entry.revealed) {
            cardDiv.className = 'card hidden-card';
        } else {
            cardDiv.className = 'card white-card';
            cardDiv.textContent = entry.card;

            // Jeśli to faza JUDGING i jestem Carem, dodaj obsługę kliknięcia (wybór zwycięzcy)
            if (gameState === 'JUDGING' && isCzar) {
                cardDiv.onclick = () => selectWinner(entry.card);
                cardDiv.title = "Wybierz tę kartę jako zwycięską";
            }
        }

        playedCardsContainer.appendChild(cardDiv);

        // Animacja
        // Jeśli właśnie przeszliśmy do JUDGING i karty są odkryte -> flip animation
        // Jeśli jesteśmy w SELECTION i karta jest dodana -> fly in animation
        if (gameState === 'JUDGING' && entry.revealed) {
             gsap.from(cardDiv, { rotationY: 90, duration: 0.5, delay: index * 0.1 });
        } else {
             gsap.from(cardDiv, { y: 50, opacity: 0, duration: 0.3 });
        }
    });
}

/**
 * Aktualizuje rękę gracza
 */
function updateHand(hand) {
    currentHand = hand;
    handContainer.innerHTML = '';

    hand.forEach((cardText, index) => {
        const card = document.createElement('div');
        card.className = 'card white-card';
        card.textContent = cardText;

        // Obsługa zagrania karty
        card.addEventListener('click', () => {
            playCard(cardText, card);
        });

        // Animacja hover w CSS, ale wejście GSAP
        handContainer.appendChild(card);
        gsap.from(card, { x: 100, opacity: 0, duration: 0.3, delay: index * 0.05 });
    });
}

/**
 * Logika zagrania karty
 */
function playCard(cardText, cardElement) {
    if (gameState !== 'SELECTION') return;
    if (isCzar) {
        showToast("Jesteś Carem! Nie możesz grać kart.");
        return;
    }

    // Animacja wylotu karty na stół
    // Znajdź pozycję środka stołu
    const tableRect = playedCardsContainer.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Oblicz przesunięcie (proste przybliżenie)
    const x = tableRect.left + tableRect.width / 2 - cardRect.left;
    const y = tableRect.top + tableRect.height / 2 - cardRect.top;

    gsap.to(cardElement, {
        x: x,
        y: y,
        scale: 0.5,
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
            socket.emit('play_card', { card: cardText });
        }
    });
}

/**
 * Logika wyboru zwycięzcy
 */
function selectWinner(cardText) {
    if (confirm(`Czy na pewno wybierasz: "${cardText}"?`)) {
        socket.emit('select_winner', { card: cardText });
    }
}
