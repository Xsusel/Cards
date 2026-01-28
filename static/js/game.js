const socket = io();

// Elementy DOM
const loginScreen = document.getElementById('login-screen');
const gameArea = document.getElementById('game-area');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const joinBtn = document.getElementById('join-btn');
const spectateBtn = document.getElementById('spectate-btn');
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
const rerollBtn = document.getElementById('reroll-btn');

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const setMaxScore = document.getElementById('set-max-score');
const setTimer = document.getElementById('set-timer');
// Ensure element exists before access
const infiniteTimerCheck = document.getElementById('infinite-timer-check');
const setBlankCards = document.getElementById('set-blank-cards');
const volumeSlider = document.getElementById('volume-slider');
const volumeVal = document.getElementById('volume-val');

const statBlackCount = document.getElementById('stat-black-count');
const statWhiteCount = document.getElementById('stat-white-count');

// Host Controls
const hostControls = document.getElementById('host-controls');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeOverlayBtn = document.getElementById('resume-overlay-btn');
const copyLinkBtn = document.getElementById('copy-link-btn');

// Blank Modal
const blankModal = document.getElementById('blank-card-modal');
const blankInput = document.getElementById('blank-card-input');
const confirmBlankBtn = document.getElementById('confirm-blank-btn');
const cancelBlankBtn = document.getElementById('cancel-blank-btn');

// Chat Elements
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatWindow = document.getElementById('chat-window');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

let gameOverModal = null;

// Lokalny stan gry
let myNickname = '';
let isCzar = false;
let isHost = false;
let currentHand = [];
let gameState = 'LOBBY';
let pickAmount = 1;
let selectedCards = []; // Lista tekstów wybranych kart (strings)
let pendingBlankCard = null; // Przechowuje element DOM karty, którą edytujemy
let remainingRerolls = 3;
let lastGameState = 'LOBBY';

// --- LOGOWANIE I INICJALIZACJA ---

// Auto-reconnect check
window.addEventListener('load', () => {
    const savedToken = localStorage.getItem('cah_token');
    if (savedToken) {
        socket.emit('join_game', { token: savedToken });
    }

    const savedVol = localStorage.getItem('cah_volume');
    if (savedVol && volumeSlider) {
        volumeSlider.value = savedVol;
        volumeVal.textContent = savedVol + '%';
        soundManager.setVolume(savedVol / 100);
    }
});

// Settings Events
if(settingsBtn) {
    settingsBtn.addEventListener('click', () => {
         soundManager.playClick();
         settingsModal.classList.remove('hidden');
    });
}
if(closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
         soundManager.playClick();
         settingsModal.classList.add('hidden');
    });
}
if(volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        volumeVal.textContent = val + '%';
        soundManager.setVolume(val / 100);
        localStorage.setItem('cah_volume', val);
    });
}
if(infiniteTimerCheck) {
    infiniteTimerCheck.addEventListener('change', (e) => {
        setTimer.disabled = e.target.checked;
        if(e.target.checked) setTimer.style.opacity = 0.5;
        else setTimer.style.opacity = 1;
    });
}
if(saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
         const maxScore = parseInt(setMaxScore.value);
         let timer = parseInt(setTimer.value);
         if(infiniteTimerCheck.checked) timer = 0;

         const blanks = parseInt(setBlankCards.value);

         if(maxScore && timer !== undefined) {
            socket.emit('update_settings', {
                max_score: maxScore,
                timer_duration: timer,
                blank_cards: blanks
            });
            settingsModal.classList.add('hidden');
            soundManager.playClick();
         }
    });
}

// Host Control Events
if(pauseBtn) {
    pauseBtn.addEventListener('click', () => {
        soundManager.playClick();
        socket.emit('toggle_pause');
    });
}
if(stopBtn) {
    stopBtn.addEventListener('click', () => {
        if(confirm("Czy na pewno chcesz zakończyć grę i wrócić do lobby?")) {
            soundManager.playClick();
            socket.emit('stop_game_manual');
        }
    });
}

if(resumeOverlayBtn) {
    resumeOverlayBtn.addEventListener('click', () => {
        soundManager.playClick();
        socket.emit('toggle_pause');
    });
}

if(copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link skopiowany do schowka!');
            soundManager.playClick();
        }).catch(err => {
            console.error('Failed to copy: ', err);
            prompt("Skopiuj link ręcznie:", url);
        });
    });
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ignore if typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (gameState !== 'SELECTION' || isCzar) return;

    const key = e.key;

    // Number keys 1-9, 0
    if (/^[0-9]$/.test(key)) {
        let idx = parseInt(key);
        if (idx === 0) idx = 10;
        idx -= 1; // 0-based index

        const cards = handContainer.children;
        if (idx >= 0 && idx < cards.length) {
            cards[idx].click();
        }
    }

    // Enter/Space to confirm
    if (key === 'Enter' || key === ' ') {
        if (!confirmPlayBtn.disabled) {
            confirmPlayBtn.click();
        }
    }
});

// Blank Card Modal Events
if(confirmBlankBtn) {
    confirmBlankBtn.addEventListener('click', () => {
        const text = blankInput.value.trim();
        if(!text) return;

        if(pendingBlankCard) {
            // Replace visual
            pendingBlankCard.textContent = text;
            pendingBlankCard.classList.add('filled-blank'); // Marker style
            // Replace in selection logic
            // Remove '<<BLANK>>' and add custom text
            const idx = selectedCards.indexOf('<<BLANK>>');
            if(idx > -1) {
                selectedCards[idx] = text;
            } else {
                selectedCards.push(text);
            }

            pendingBlankCard.classList.add('selected');
            updateSelectionBadges();
            updateSelectionUI();
        }

        blankModal.classList.add('hidden');
        blankInput.value = '';
        pendingBlankCard = null;
    });
}

if(cancelBlankBtn) {
    cancelBlankBtn.addEventListener('click', () => {
        blankModal.classList.add('hidden');
        blankInput.value = '';
        if(pendingBlankCard) {
            // Deselect logic handled by toggle logic beforehand? No, we clicked the card.
            // If we cancel, we basically just don't select it.
        }
        pendingBlankCard = null;
    });
}


function handleJoin(isSpectator) {
    soundManager.playClick();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!nickname || !password) {
        loginError.textContent = "Podaj nick i hasło!";
        return;
    }

    myNickname = nickname;
    socket.emit('join_game', { nickname, password, is_spectator: isSpectator });
}

// Obsługa przycisku dołączania
joinBtn.addEventListener('click', () => handleJoin(false));
if(spectateBtn) {
    spectateBtn.addEventListener('click', () => handleJoin(true));
}

// Błąd logowania
socket.on('join_error', (data) => {
    loginError.textContent = data.message;
    soundManager.playTone(200, 'sawtooth', 0.2); // Dźwięk błędu
    // Jeśli błąd logowania (np. złe hasło przy reconnect), czyść token
    localStorage.removeItem('cah_token');
});

// Sukces logowania - animacja wejścia
socket.on('join_success', (data) => {
    if (data.token) {
        localStorage.setItem('cah_token', data.token);
    }
    if (data.nickname) {
        myNickname = data.nickname;
    }

    soundManager.playTone(600, 'sine', 0.3);

    if (data.reconnect) {
        // Szybkie wejście bez animacji powitalnej
        loginScreen.classList.add('hidden');
        gameArea.classList.remove('hidden');
        initBackgroundAnimation();
    } else {
        // Pełna animacja
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
    }

    // Init Chat UI
    if(chatToggleBtn) chatToggleBtn.classList.remove('hidden');
});

// --- CZAT ---
if(chatToggleBtn) {
    chatToggleBtn.addEventListener('click', () => {
        chatWindow.classList.remove('hidden');
        chatToggleBtn.classList.add('hidden');
        chatInput.focus();
    });
}
if(chatCloseBtn) {
    chatCloseBtn.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
        chatToggleBtn.classList.remove('hidden');
    });
}
if(chatSendBtn) {
    chatSendBtn.addEventListener('click', sendChat);
}
if(chatInput) {
    chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendChat();
    });
}

function sendChat() {
    const msg = chatInput.value.trim();
    if(!msg) return;
    socket.emit('send_chat', { message: msg });
    chatInput.value = '';
}

socket.on('new_chat', (data) => {
    const div = document.createElement('div');
    div.style.marginBottom = '5px';
    div.style.lineHeight = '1.3';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = `[${data.timestamp}] `;
    timeSpan.style.color = '#666';
    timeSpan.style.fontSize = '0.75rem';

    const nickSpan = document.createElement('span');
    nickSpan.textContent = `${data.nickname}: `;
    nickSpan.style.fontWeight = 'bold';
    nickSpan.style.color = data.is_spectator ? '#aaa' : '#fff';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = data.message;
    msgSpan.style.color = '#ddd';

    div.appendChild(timeSpan);
    div.appendChild(nickSpan);
    div.appendChild(msgSpan);

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

// Kicked
socket.on('kicked', () => {
    alert("Zostałeś wyrzucony z gry.");
    localStorage.removeItem('cah_token');
    location.reload();
});


// Aktualizacja ręki z serwera
socket.on('hand_update', (data) => {
    if(data.rerolls !== undefined) {
        remainingRerolls = data.rerolls;
        updateRerollBtn();
    }
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

// Aktualizacja ustawień
socket.on('settings_updated', (settings) => {
    updateSettingsUI(settings);
    showToast("Ustawienia zaktualizowane!");
});

window.updateSettingsUI = (settings) => {
    try {
        if(settings.max_score && setMaxScore) setMaxScore.value = settings.max_score;
        if(settings.timer_duration !== undefined && setTimer) {
            if(settings.timer_duration === 0) {
                if(infiniteTimerCheck) infiniteTimerCheck.checked = true;
                setTimer.disabled = true;
                setTimer.style.opacity = 0.5;
            } else {
                setTimer.value = settings.timer_duration;
                if(infiniteTimerCheck) infiniteTimerCheck.checked = false;
                setTimer.disabled = false;
                setTimer.style.opacity = 1;
            }
        }
        if(settings.blank_cards !== undefined && setBlankCards) setBlankCards.value = settings.blank_cards;
    } catch(e) {
        console.error("Error updating settings UI:", e);
    }
};

// Główna aktualizacja stanu gry
socket.on('game_update', (data) => {
    try {
        handleGameUpdate(data);
    } catch(e) {
        console.error("Game update error:", e);
    }
});

function handleGameUpdate(data) {
    if (gameOverModal && data.state === 'LOBBY') {
        document.body.removeChild(gameOverModal);
        gameOverModal = null;
    }

    gameState = data.state;

    // Stats
    if(data.total_black) statBlackCount.textContent = data.total_black;
    if(data.total_white) statWhiteCount.textContent = data.total_white;

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

    // Obsługa Settings UI (to be added in next step, but preparing hook)
    if (window.updateSettingsUI && data.settings) {
        window.updateSettingsUI(data.settings);
    }

    // Pause State
    if(data.paused) {
        pauseOverlay.classList.remove('hidden');
        if(pauseBtn) pauseBtn.textContent = '▶ Wznów';
        if(resumeOverlayBtn) resumeOverlayBtn.classList.toggle('hidden', !isHost);
    } else {
        pauseOverlay.classList.add('hidden');
        if(pauseBtn) pauseBtn.textContent = '⏸ Pauza';
    }

    // Sound Triggers
    if (gameState === 'SELECTION' && lastGameState !== 'SELECTION') {
        if (isCzar) {
            soundManager.playFanfare();
        } else {
            // Only play turn alert if not spectator
            const me = data.players.find(p => p.nickname === myNickname);
            if (me && !me.is_spectator) {
                soundManager.playTurnAlert();
            }
        }
    }
    lastGameState = gameState;

    // Debug Expose
    window.isHost = isHost;
    window.gameState = gameState;
    window.myNickname = myNickname;

    // Widoczność kontrolek
    if (gameState === 'LOBBY') {
        // Start Button only for Host
        if (isHost) startBtn.classList.remove('hidden');
        else startBtn.classList.add('hidden');

        // Pokaż przycisk ustawień jeśli Host
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.classList.toggle('hidden', !isHost);
        }
        if (hostControls) {
            hostControls.classList.add('hidden');
        }

        timerDisplay.classList.add('hidden');
        selectionControls.classList.add('hidden');
        if(rerollBtn) rerollBtn.classList.add('hidden');
    } else {
        startBtn.classList.add('hidden');
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) settingsBtn.classList.add('hidden');

        // Show host controls
        if (hostControls) {
            hostControls.classList.toggle('hidden', !isHost);
        }

        timerDisplay.classList.remove('hidden');

        if (gameState === 'SELECTION' && !isCzar) {
            selectionControls.classList.remove('hidden');
            if(rerollBtn) {
                rerollBtn.classList.remove('hidden');
                updateRerollBtn();
            }
            requiredCountSpan.textContent = pickAmount;
            updateSelectionUI();
        } else {
            selectionControls.classList.add('hidden');
            if(rerollBtn) rerollBtn.classList.add('hidden');
        }
    }
}

// Reroll Events
if(rerollBtn) {
    rerollBtn.addEventListener('click', () => {
        if(remainingRerolls > 0) {
            if(confirm("Wymienić całą rękę?")) {
                soundManager.playClick();
                socket.emit('reroll_hand');
            }
        }
    });
}

function updateRerollBtn() {
    if(!rerollBtn) return;
    rerollBtn.textContent = `Wymień rękę (${remainingRerolls}/3)`;
    if(remainingRerolls <= 0) {
        rerollBtn.disabled = true;
        rerollBtn.style.opacity = 0.5;
    } else {
        rerollBtn.disabled = false;
        rerollBtn.style.opacity = 1;
    }
}

// Zatwierdzenie wyboru kart
confirmPlayBtn.addEventListener('click', () => {
    if (selectedCards.length !== pickAmount) return;
    soundManager.playClick();
    socket.emit('play_cards', { cards: selectedCards });

    // Lokalna animacja usunięcia
    selectedCards.forEach(cardText => {
        // Warning: if text is custom, we need to find the element that HAS that text
        // Or find the element that was marked selected.
        const els = Array.from(handContainer.children);
        const el = els.find(e => e.textContent === cardText || (e.classList.contains('filled-blank') && e.textContent === cardText));
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
    let isSpectator = false;

    if (me) {
        isCzar = me.is_czar;
        isHost = me.is_host;
        isSpectator = me.is_spectator;
    }

    let statusText = '';
    if (isSpectator) statusText = "TRYB OBSERWATORA";
    else if (data.state === 'LOBBY') statusText = 'Oczekiwanie...';
    else if (data.state === 'SELECTION') statusText = isCzar ? 'Jesteś Carem. Czekaj.' : `Wybierz ${pickAmount} kart(y)!`;
    else if (data.state === 'JUDGING') statusText = isCzar ? 'Wybierz zwycięzcę!' : 'Car wybiera...';

    gameStatus.textContent = statusText;

    // Hide hand area if spectator
    const handSection = document.getElementById('hand-section');
    if (handSection) {
        if(isSpectator) handSection.classList.add('hidden');
        else handSection.classList.remove('hidden');
    }
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

        const pNick = document.createElement('div');
        pNick.className = 'p-nick';
        pNick.textContent = `${p.nickname} ${p.nickname === myNickname ? '(Ty)' : ''}`;

        const pScore = document.createElement('div');
        pScore.className = 'p-score';
        pScore.textContent = `${p.score} pkt`;

        details.appendChild(pNick);
        details.appendChild(pScore);

        li.appendChild(avatar);
        li.appendChild(details);

        if (p.is_spectator) {
            const badge = document.createElement('span');
            badge.style.cssText = 'background: #555; padding: 2px 5px; font-size: 0.7rem; margin-left: 5px; border-radius: 3px;';
            badge.textContent = 'WIDZ';
            li.appendChild(badge);
        } else if (p.is_czar) {
            li.classList.add('is-czar');
            const badge = document.createElement('span');
            badge.className = 'czar-badge';
            badge.textContent = 'CAR';
            li.appendChild(badge);
        }

        // Kick Button (Host Only)
        if (isHost && p.nickname !== myNickname) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-btn';
            kickBtn.innerHTML = '&#10006;'; // X symbol
            kickBtn.title = 'Wyrzuć gracza';
            kickBtn.onclick = () => {
                if(confirm(`Czy na pewno wyrzucić ${p.nickname}?`)) {
                    socket.emit('kick_player', { nickname: p.nickname });
                }
            };
            li.appendChild(kickBtn);
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

    // Spotlight Effect for Black Card
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.background = `radial-gradient(circle at ${x}px ${y}px, #333, #000)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.background = '#000';
    });
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

        // Add Reactions Overlay if not Czar and Judging
        if (gameState === 'JUDGING' && !isCzar && entry.revealed) {
            const reactionOverlay = document.createElement('div');
            reactionOverlay.className = 'reaction-overlay';

            const btnUp = document.createElement('button');
            btnUp.innerHTML = '👍';
            btnUp.onclick = (e) => { e.stopPropagation(); sendReaction('up', index); };

            const btnDown = document.createElement('button');
            btnDown.innerHTML = '👎';
            btnDown.onclick = (e) => { e.stopPropagation(); sendReaction('down', index); };

            reactionOverlay.appendChild(btnUp);
            reactionOverlay.appendChild(btnDown);
            groupDiv.appendChild(reactionOverlay);
        }

        groupDiv.setAttribute('id', `card-group-${index}`);
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

        // Check for Joker Cards
        if (cardText === 'Twoja stara.' || cardText === 'Twój stary.') {
            card.classList.add('joker-card');
        }

        if (cardText === '<<BLANK>>') {
            card.textContent = "PUSTA KARTA";
            card.style.fontStyle = "italic";
            card.style.color = "#888";
        } else {
            card.textContent = cardText;
        }

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

    // Check if it's a blank card interaction
    if (cardText === '<<BLANK>>') {
        if (selectedCards.includes(cardText)) {
             // Already selected, deselect
        } else {
            // New selection - SHOW MODAL
            pendingBlankCard = element;
            blankModal.classList.remove('hidden');
            blankInput.focus();
            return; // Stop standard selection logic until confirmed
        }
    }

    // Standard Toggle Logic
    if (selectedCards.includes(cardText)) {
        // Odznaczenie
        selectedCards = selectedCards.filter(c => c !== cardText);
        element.classList.remove('selected');
        element.removeAttribute('data-order');

        // If it was a filled blank, revert visual?
        // Actually, we keep it filled until played, or maybe revert if deselected?
        // Let's keep it simple: if deselected, it stays as text but is just deselected.
        // But if cardText matches, it works.

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
        // Check if this element corresponds to a selected card
        // Note: For filled blanks, element text is custom, selectedCards has custom.
        // For blank placeholders, element text is "PUSTA KARTA", selectedCards has '<<BLANK>>'? No.
        // If we replaced blank, selectedCards has custom text.

        const idx = selectedCards.indexOf(text);
        if (idx > -1) {
            c.setAttribute('data-order', idx + 1);
        } else {
            // Special check for non-filled blanks?
            if (text === "PUSTA KARTA" && selectedCards.includes('<<BLANK>>')) {
                 const i = selectedCards.indexOf('<<BLANK>>');
                 c.setAttribute('data-order', i+1);
            } else {
                c.removeAttribute('data-order');
            }
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

function sendReaction(type, targetIdx) {
    socket.emit('send_reaction', { type: type, target_id: targetIdx });
}

socket.on('reaction_received', (data) => {
    showReactionAnim(data.type, data.target_id);
});

// --- EFEKTY WIZUALNE ---

function showReactionAnim(type, targetIdx) {
    const group = document.getElementById(`card-group-${targetIdx}`);
    if(!group) return;

    const emoji = type === 'up' ? '👍' : '👎';
    const el = document.createElement('div');
    el.textContent = emoji;
    el.style.cssText = `position: absolute; top: 50%; left: 50%; font-size: 3rem; pointer-events: none; z-index: 100; text-shadow: 0 0 10px black;`;

    // Random offset
    const offsetX = (Math.random() - 0.5) * 50;
    const offsetY = (Math.random() - 0.5) * 50;

    group.appendChild(el);

    gsap.fromTo(el,
        { x: -20 + offsetX, y: 0 + offsetY, scale: 0, opacity: 0 },
        { y: -100 + offsetY, scale: 1.5, opacity: 1, duration: 0.5, ease: "back.out(1.7)", onComplete: () => {
            gsap.to(el, { y: -150 + offsetY, opacity: 0, duration: 0.5, onComplete: () => el.remove() });
        }}
    );

    if(type === 'up') soundManager.playTone(400, 'sine', 0.1, 0.05);
    else soundManager.playTone(150, 'sawtooth', 0.1, 0.05);
}

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

// Efekt Konfetti (Czarno-Białe dla klimatu CAH)
function fireConfetti() {
    const colors = ['#fff', '#000', '#888'];
    for(let i=0; i<150; i++) {
        const p = document.createElement('div');
        // Random square or circle
        const isSquare = Math.random() > 0.5;
        const radius = isSquare ? '0%' : '50%';
        p.style.cssText = `position:fixed;top:50%;left:50%;width:10px;height:10px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${radius};pointer-events:none;z-index:9999;`;
        document.body.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const velocity = 200 + Math.random() * 500;

        gsap.to(p, {
            x: Math.cos(angle) * velocity,
            y: Math.sin(angle) * velocity,
            rotation: Math.random() * 720,
            opacity: 0,
            duration: 1.5 + Math.random(),
            ease: "power4.out",
            onComplete: () => p.remove()
        });
    }
}

// Modal Koniec Gry
function showGameOver(winner) {
    gameOverModal = document.createElement('div');
    gameOverModal.className = 'modal-overlay';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const h1 = document.createElement('h1');
    h1.textContent = 'KONIEC GRY!';

    const p = document.createElement('p');
    p.textContent = 'Mistrz humoru:';

    const h2 = document.createElement('h2');
    h2.textContent = winner;
    h2.style.fontSize = '3rem';
    h2.style.color = '#2ecc71';

    const btn = document.createElement('button');
    btn.className = 'modal-btn';
    btn.textContent = 'REWANŻ';
    btn.onclick = () => socket.emit('start_game');

    content.appendChild(h1);
    content.appendChild(p);
    content.appendChild(h2);
    content.appendChild(btn);

    gameOverModal.appendChild(content);
    document.body.appendChild(gameOverModal);
    fireConfetti();
}
