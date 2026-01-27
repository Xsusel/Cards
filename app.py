from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
import json
import random
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_tajny_klucz'
socketio = SocketIO(app, cors_allowed_origins="*")

# Ładowanie kart z pliku JSON
# Baza kart: cards.json
try:
    with open('cards.json', 'r', encoding='utf-8') as f:
        CARDS = json.load(f)
except Exception as e:
    print(f"Błąd ładowania kart: {e}")
    CARDS = {"blackCards": [], "whiteCards": []}

class Game:
    """
    Klasa zarządzająca stanem gry.
    Przechowuje informacje o graczach, kartach, punktacji i aktualnym stanie rozgrywki.
    """
    def __init__(self):
        self.players = {}  # Mapowanie SID -> obiekt gracza {nickname, score, hand, is_czar}
        self.black_deck = []
        self.white_deck = []
        self.current_black_card = None
        self.table_cards = []  # Karty rzucone na stół: [{'sid': sid, 'card': card_text, 'nickname': nick}]
        self.czar_sid = None  # SID aktualnego Cara
        self.state = 'LOBBY'  # Stan gry: LOBBY, SELECTION, JUDGING
        self.password = "1234"  # Hasło sesji

    def reset_game(self):
        """Resetuje grę do stanu początkowego."""
        self.black_deck = CARDS['blackCards'][:]
        self.white_deck = CARDS['whiteCards'][:]
        random.shuffle(self.black_deck)
        random.shuffle(self.white_deck)

        for sid in self.players:
            self.players[sid]['score'] = 0
            self.players[sid]['hand'] = []
            self.players[sid]['is_czar'] = False

        self.current_black_card = None
        self.table_cards = []
        self.czar_sid = None
        self.state = 'LOBBY'

    def deal_cards(self, sid, count=1):
        """Rozdaje określoną liczbę kart graczowi."""
        hand = self.players[sid]['hand']
        for _ in range(count):
            if self.white_deck:
                card = self.white_deck.pop()
                hand.append(card)

    def start_round(self):
        """Rozpoczyna nową rundę."""
        if not self.black_deck:
            self.broadcast_message("Koniec kart! Gra skończona.")
            self.state = 'LOBBY'
            self.broadcast_state()
            return

        self.current_black_card = self.black_deck.pop()
        self.table_cards = []
        self.state = 'SELECTION'

        # Wybór Cara (rotacja)
        sids = list(self.players.keys())
        if not self.czar_sid or self.czar_sid not in sids:
            self.czar_sid = sids[0]
        else:
            current_index = sids.index(self.czar_sid)
            self.czar_sid = sids[(current_index + 1) % len(sids)]

        for sid in self.players:
            self.players[sid]['is_czar'] = (sid == self.czar_sid)
            # Uzupełnij rękę do 5 kart
            needed = 5 - len(self.players[sid]['hand'])
            if needed > 0:
                self.deal_cards(sid, needed)

        self.broadcast_state()

    def broadcast_state(self):
        """Wysyła aktualny stan gry do wszystkich graczy."""
        # Dane publiczne
        public_players = []
        for sid, p in self.players.items():
            public_players.append({
                'nickname': p['nickname'],
                'score': p['score'],
                'is_czar': p['is_czar'],
                'has_played': any(c['sid'] == sid for c in self.table_cards)
            })

        # Karty na stole (ukryte jeśli trwa wybieranie)
        visible_table = []
        for card in self.table_cards:
            if self.state == 'SELECTION':
                 # W fazie wyboru nie pokazujemy treści kart
                visible_table.append({'sid': card['sid'], 'card': 'REWERS', 'revealed': False})
            else:
                visible_table.append({'sid': card['sid'], 'card': card['card'], 'revealed': True})

        # Tasowanie kart na stole w fazie oceniania, żeby Car nie wiedział kto co rzucił
        if self.state == 'JUDGING':
             # Tutaj po stronie klienta można to wyświetlić
             pass

        state_data = {
            'state': self.state,
            'players': public_players,
            'current_black_card': self.current_black_card,
            'table_cards': visible_table,
            'czar_nickname': self.players[self.czar_sid]['nickname'] if self.czar_sid else None
        }

        socketio.emit('game_update', state_data)

        # Wyślij prywatne ręce
        for sid in self.players:
            socketio.emit('hand_update', {'hand': self.players[sid]['hand']}, room=sid)

    def broadcast_message(self, msg):
        socketio.emit('message', {'text': msg})

game = Game()

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join_game')
def on_join(data):
    """Obsługa dołączania gracza."""
    nickname = data.get('nickname')
    password = data.get('password')

    if password != game.password:
        emit('join_error', {'message': 'Nieprawidłowe hasło!'})
        return

    if not nickname:
        emit('join_error', {'message': 'Podaj nick!'})
        return

    # Dodaj gracza
    game.players[request.sid] = {
        'nickname': nickname,
        'score': 0,
        'hand': [],
        'is_czar': False
    }

    join_room('game_room')
    emit('join_success', {})
    game.broadcast_state()
    game.broadcast_message(f"Gracz {nickname} dołączył do gry.")

@socketio.on('start_game')
def on_start():
    """Rozpoczęcie gry."""
    if len(game.players) < 3:
        # Wymagane min 3 osoby dla sensownej gry
        game.broadcast_message("Potrzeba minimum 3 graczy, aby rozpocząć.")
        # Dla testów pozwalamy na 2, ale ostrzegamy
        # return
        pass

    game.reset_game()
    game.start_round()
    game.broadcast_message("Gra rozpoczęta!")

@socketio.on('play_card')
def on_play_card(data):
    """Gracz zagrywa białą kartę."""
    sid = request.sid
    if game.state != 'SELECTION':
        return
    if game.players[sid]['is_czar']:
        return # Car nie gra kart
    if any(c['sid'] == sid for c in game.table_cards):
        return # Gracz już zagrał

    card_text = data.get('card')
    if card_text in game.players[sid]['hand']:
        game.players[sid]['hand'].remove(card_text)
        game.table_cards.append({
            'sid': sid,
            'card': card_text,
            'nickname': game.players[sid]['nickname']
        })

        # Sprawdź czy wszyscy (poza Carem) zagrali
        not_czars_count = len(game.players) - 1
        if len(game.table_cards) >= not_czars_count:
            game.state = 'JUDGING'
            # Tasujemy karty na stole przed odkryciem
            random.shuffle(game.table_cards)

        game.broadcast_state()

@socketio.on('select_winner')
def on_select_winner(data):
    """Car wybiera zwycięską kartę."""
    sid = request.sid
    if game.state != 'JUDGING':
        return
    if not game.players[sid]['is_czar']:
        return

    winner_card_text = data.get('card')
    # Znajdź właściciela karty
    winner_sid = None
    for entry in game.table_cards:
        if entry['card'] == winner_card_text:
            winner_sid = entry['sid']
            break

    if winner_sid:
        game.players[winner_sid]['score'] += 1
        winner_nick = game.players[winner_sid]['nickname']
        game.broadcast_message(f"{winner_nick} wygrywa rundę!")

        # Sprawdź warunek końca gry (np. 5 punktów)
        if game.players[winner_sid]['score'] >= 5:
            game.broadcast_message(f"Gracz {winner_nick} wygrał całą grę!")
            socketio.emit('game_over', {'winner': winner_nick})
            game.state = 'LOBBY' # Nie resetujemy od razu, czekamy na restart
            return

        # Opóźnienie przed kolejną rundą (obsłużone timeoutem po stronie klienta lub serwera)
        # Tu od razu nowa runda dla uproszczenia, w JS można dać timeout
        socketio.sleep(3)
        game.start_round()

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid in game.players:
        nick = game.players[sid]['nickname']
        del game.players[sid]
        game.broadcast_message(f"Gracz {nick} wyszedł.")
        # Reset gry jeśli zbyt mało graczy?
        if len(game.players) < 2:
            game.state = 'LOBBY'
        elif game.czar_sid == sid:
            # Jeśli Car wyszedł, reset rundy
            game.start_round()

        game.broadcast_state()

if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
