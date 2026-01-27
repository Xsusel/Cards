from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
import json
import random
import eventlet
import time

# Monkey patch for eventlet timer
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'super_tajny_klucz'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Load cards
try:
    with open('cards.json', 'r', encoding='utf-8') as f:
        CARDS = json.load(f)
except Exception as e:
    print(f"Error loading cards: {e}")
    CARDS = {"blackCards": [], "whiteCards": []}

class Game:
    def __init__(self):
        self.players = {}
        self.black_deck = []
        self.white_deck = []
        self.current_black_card = None
        self.table_cards = []  # List of {sid, cards: [text1, text2], nickname}
        self.czar_sid = None
        self.state = 'LOBBY'
        self.password = "1234"
        self.timer = 0
        self.timer_thread = None

    def reset_game(self):
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
        self.stop_timer()

    def deal_cards(self, sid, count=1):
        hand = self.players[sid]['hand']
        for _ in range(count):
            if self.white_deck:
                card = self.white_deck.pop()
                hand.append(card)

    def start_round(self):
        if not self.black_deck:
            self.broadcast_message("Koniec kart! Gra skończona.")
            self.state = 'LOBBY'
            self.broadcast_state()
            return

        self.current_black_card = self.black_deck.pop()
        # Ensure 'pick' exists, default to 1
        if isinstance(self.current_black_card, str):
             # Legacy format support just in case
             self.current_black_card = {'text': self.current_black_card, 'pick': 1}

        self.table_cards = []
        self.state = 'SELECTION'

        # Czar rotation
        sids = list(self.players.keys())
        if not self.czar_sid or self.czar_sid not in sids:
            self.czar_sid = sids[0]
        else:
            current_index = sids.index(self.czar_sid)
            self.czar_sid = sids[(current_index + 1) % len(sids)]

        for sid in self.players:
            self.players[sid]['is_czar'] = (sid == self.czar_sid)
            needed = 10 - len(self.players[sid]['hand']) # Increase hand size for Pick 2 fun
            if needed > 0:
                self.deal_cards(sid, needed)

        self.broadcast_state()
        self.start_timer(60)

    def start_timer(self, duration):
        self.stop_timer()
        self.timer = duration
        self.timer_thread = socketio.start_background_task(self.timer_loop)

    def stop_timer(self):
        self.timer = 0
        # Thread will exit naturally when timer <= 0

    def timer_loop(self):
        while self.timer > 0 and self.state == 'SELECTION':
            socketio.sleep(1)
            self.timer -= 1
            socketio.emit('timer_update', {'time': self.timer})

        if self.timer == 0 and self.state == 'SELECTION':
            # Time's up! Force state change?
            # Ideally auto-play random cards for slow players,
            # but for now we just nudge or let it hang (simple version).
            socketio.emit('message', {'text': 'Czas minął!'})

    def broadcast_state(self):
        public_players = []
        for sid, p in self.players.items():
            public_players.append({
                'nickname': p['nickname'],
                'score': p['score'],
                'is_czar': p['is_czar'],
                'has_played': any(c['sid'] == sid for c in self.table_cards)
            })

        visible_table = []
        for entry in self.table_cards:
            if self.state == 'SELECTION':
                visible_table.append({'sid': entry['sid'], 'cards': ['REWERS'] * len(entry['cards']), 'revealed': False})
            else:
                visible_table.append({'sid': entry['sid'], 'cards': entry['cards'], 'revealed': True})

        # Shuffle table for judging if needed (done at state transition)

        state_data = {
            'state': self.state,
            'players': public_players,
            'current_black_card': self.current_black_card,
            'table_cards': visible_table,
            'czar_nickname': self.players[self.czar_sid]['nickname'] if self.czar_sid else None
        }

        socketio.emit('game_update', state_data)

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
    nickname = data.get('nickname')
    password = data.get('password')

    if password != game.password:
        emit('join_error', {'message': 'Nieprawidłowe hasło!'})
        return

    if not nickname:
        emit('join_error', {'message': 'Podaj nick!'})
        return

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
    if len(game.players) < 3:
        game.broadcast_message("Potrzeba minimum 3 graczy.")
        # pass # Allow for testing

    game.reset_game()
    game.start_round()
    game.broadcast_message("Gra rozpoczęta!")

@socketio.on('play_cards')
def on_play_cards(data):
    """
    Gracz zagrywa karty (lista).
    data['cards'] = ['Tekst1', 'Tekst2']
    """
    sid = request.sid
    if game.state != 'SELECTION':
        return
    if game.players[sid]['is_czar']:
        return
    if any(c['sid'] == sid for c in game.table_cards):
        return

    cards = data.get('cards', [])
    pick_needed = game.current_black_card.get('pick', 1)

    if len(cards) != pick_needed:
        emit('error', {'message': f'Musisz wybrać {pick_needed} kart!'})
        return

    # Verify cards are in hand
    hand = game.players[sid]['hand']
    for c in cards:
        if c not in hand:
            return # Cheating?

    # Remove from hand
    for c in cards:
        hand.remove(c)

    game.table_cards.append({
        'sid': sid,
        'cards': cards,
        'nickname': game.players[sid]['nickname']
    })

    game.broadcast_state()

    # Check if all players played
    not_czars_count = len(game.players) - 1
    if len(game.table_cards) >= not_czars_count:
        game.state = 'JUDGING'
        game.stop_timer()
        random.shuffle(game.table_cards)
        game.broadcast_state()

@socketio.on('select_winner')
def on_select_winner(data):
    sid = request.sid
    if game.state != 'JUDGING':
        return
    if not game.players[sid]['is_czar']:
        return

    # data['cards'] should match the winning entry's cards
    winner_cards = data.get('cards')

    winner_sid = None
    for entry in game.table_cards:
        # Compare lists (order matters usually, but exact match needed)
        if entry['cards'] == winner_cards:
            winner_sid = entry['sid']
            break

    if winner_sid:
        game.players[winner_sid]['score'] += 1
        winner_nick = game.players[winner_sid]['nickname']
        game.broadcast_message(f"{winner_nick} wygrywa rundę!")

        if game.players[winner_sid]['score'] >= 5:
            game.broadcast_message(f"Gracz {winner_nick} wygrał grę!")
            socketio.emit('game_over', {'winner': winner_nick})
            game.state = 'LOBBY'
            return

        socketio.sleep(3)
        game.start_round()

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid in game.players:
        nick = game.players[sid]['nickname']
        del game.players[sid]
        game.broadcast_message(f"Gracz {nick} wyszedł.")
        if len(game.players) < 2:
            game.state = 'LOBBY'
            game.stop_timer()
        elif game.czar_sid == sid:
            game.start_round()
        game.broadcast_state()

if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', port=5000)
