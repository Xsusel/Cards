from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room
import json
import random
import eventlet
import time
import os
import uuid

# Monkey patch for eventlet timer
eventlet.monkey_patch()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'super_tajny_klucz')
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
        self.persistent_players = {} # token -> player_data
        self.sid_map = {} # sid -> token
        self.black_deck = []
        self.white_deck = []
        self.current_black_card = None
        self.table_cards = []  # List of {sid, cards: [text1, text2], nickname}
        self.czar_sid = None
        self.state = 'LOBBY'
        self.paused = False
        self.password = "1234"
        self.timer = 0
        self.timer_thread = None
        self.settings = {
            'max_score': 8,
            'timer_duration': 60,
            'blank_cards': 0,
            'democracy_mode': False,
            'joker_count': 2,
            'custom_cards_allowed': False
        }
        self.initial_rerolls = 3
        self.round_history = []
        self.votes = {}

    def reset_game(self):
        self.round_history = []
        self.black_deck = CARDS['blackCards'][:]

        # Filter original jokers
        original_jokers = ['Twoja stara.', 'Twój stary.']
        self.white_deck = [c for c in CARDS['whiteCards'] if c not in original_jokers]

        # Inject new jokers
        joker_count = self.settings.get('joker_count', 2)
        for i in range(joker_count):
            # Alternating
            text = 'Twoja stara.' if i % 2 == 0 else 'Twój stary.'
            self.white_deck.append(text)

        # Add blank cards
        blank_count = self.settings.get('blank_cards', 0)
        for _ in range(blank_count):
            self.white_deck.append('<<BLANK>>')

        random.shuffle(self.black_deck)
        random.shuffle(self.white_deck)

        for sid in self.players:
            self.players[sid]['score'] = 0
            self.players[sid]['hand'] = []
            self.players[sid]['is_czar'] = False
            self.players[sid]['rerolls'] = self.initial_rerolls

        self.current_black_card = None
        self.table_cards = []
        self.czar_sid = None
        self.state = 'LOBBY'
        self.paused = False
        self.stop_timer()

    def update_settings(self, new_settings):
        if 'max_score' in new_settings:
            self.settings['max_score'] = int(new_settings['max_score'])
        if 'timer_duration' in new_settings:
            self.settings['timer_duration'] = int(new_settings['timer_duration'])
        if 'blank_cards' in new_settings:
            self.settings['blank_cards'] = int(new_settings['blank_cards'])
        if 'democracy_mode' in new_settings:
            self.settings['democracy_mode'] = bool(new_settings['democracy_mode'])
        if 'joker_count' in new_settings:
            self.settings['joker_count'] = int(new_settings['joker_count'])
        if 'custom_cards_allowed' in new_settings:
            self.settings['custom_cards_allowed'] = bool(new_settings['custom_cards_allowed'])
        socketio.emit('settings_updated', self.settings)

    def deal_cards(self, sid, count=1):
        if sid not in self.players: return
        # Skip if spectator
        if self.players[sid].get('is_spectator'): return

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
        # Filter active players (non-spectators)
        active_sids = [sid for sid, p in self.players.items() if not p.get('is_spectator', False)]

        if not active_sids:
            self.broadcast_message("Brak aktywnych graczy.")
            self.state = 'LOBBY'
            self.broadcast_state()
            return

        if not self.czar_sid or self.czar_sid not in active_sids:
            self.czar_sid = active_sids[0]
        else:
            try:
                current_index = active_sids.index(self.czar_sid)
                self.czar_sid = active_sids[(current_index + 1) % len(active_sids)]
            except ValueError:
                self.czar_sid = active_sids[0]

        for sid in self.players:
            # Skip spectators
            if self.players[sid].get('is_spectator', False):
                self.players[sid]['is_czar'] = False
                continue

            self.players[sid]['is_czar'] = (sid == self.czar_sid)
            needed = 10 - len(self.players[sid]['hand']) # Increase hand size for Pick 2 fun
            if needed > 0:
                self.deal_cards(sid, needed)

        self.broadcast_state()
        self.start_timer(self.settings['timer_duration'])

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
            if not self.paused:
                self.timer -= 1
                socketio.emit('timer_update', {'time': self.timer})

        if self.timer == 0 and self.state == 'SELECTION':
            # Time's up! Auto-play for those who haven't played
            socketio.emit('message', {'text': 'Czas minął! Automatyczny wybór kart.'})

            # Identify players who need to play
            pick_needed = self.current_black_card.get('pick', 1)

            # Copy keys to avoid iteration issues
            all_sids = list(self.players.keys())

            for sid in all_sids:
                if sid not in self.players: continue
                p = self.players[sid]

                # Skip Czar, Spectators, and those who already played
                if p.get('is_spectator', False): continue
                if p.get('is_czar', False): continue
                if any(c['sid'] == sid for c in self.table_cards): continue

                # Auto pick
                hand = p['hand']
                if len(hand) >= pick_needed:
                    selected = random.sample(hand, pick_needed)
                    final_selected = []
                    for card in selected:
                        if card == '<<BLANK>>':
                            final_selected.append('PUSTAK (Auto)')
                        else:
                            final_selected.append(card)

                    self.play_cards_logic(sid, final_selected, is_auto=True)
                    socketio.emit('message', {'text': f'Gracz {p["nickname"]} zagrał losowo!'})

    def play_cards_logic(self, sid, cards, is_auto=False):
        if sid not in self.players: return False

        player = self.players[sid]
        hand = player['hand']
        temp_hand = list(hand)
        final_cards_for_table = []

        for c in cards:
            if c in temp_hand:
                temp_hand.remove(c)
                final_cards_for_table.append(c)
            elif '<<BLANK>>' in temp_hand:
                temp_hand.remove('<<BLANK>>')
                if is_auto:
                    final_cards_for_table.append(c)
                else:
                    sanitized = str(c).replace('<', '&lt;').replace('>', '&gt;')[:100]
                    final_cards_for_table.append(sanitized)
            else:
                return False

        player['hand'] = temp_hand

        self.table_cards.append({
            'sid': sid,
            'cards': final_cards_for_table,
            'nickname': player['nickname']
        })

        self.broadcast_state()

        # Check if all active players (except Czar and Spectators) played
        active_players = [p for p in self.players.values() if not p.get('is_spectator', False)]
        players_needed = len(active_players) - 1

        if len(self.table_cards) >= players_needed:
            self.state = 'JUDGING'
            self.stop_timer()

            if self.settings.get('democracy_mode', False):
                self.votes = {}
                self.broadcast_message("Tryb Demokracja: Głosowanie rozpoczęte!")

            random.shuffle(self.table_cards)
            self.broadcast_state()

        return True

    def resolve_round(self, winner_sid):
        if winner_sid not in self.players: return

        self.players[winner_sid]['score'] += 1
        winner_nick = self.players[winner_sid]['nickname']
        self.broadcast_message(f"{winner_nick} wygrywa rundę!")

        # Record history for Hall of Fame
        winning_entry = next((e for e in self.table_cards if e['sid'] == winner_sid), None)
        if winning_entry:
            self.round_history.append({
                'black': self.current_black_card,
                'white': winning_entry['cards'],
                'winner': winner_nick
            })

        if self.players[winner_sid]['score'] >= self.settings['max_score']:
            self.broadcast_message(f"Gracz {winner_nick} wygrał grę!")
            socketio.emit('game_over', {'winner': winner_nick, 'history': self.round_history})
            self.state = 'LOBBY'
            return

        socketio.sleep(3)
        self.start_round()

    def broadcast_state(self):
        public_players = []

        for sid, p in self.players.items():
            # Debug Host status
            if p.get('is_host', False):
                print(f"DEBUG BROADCAST: {p['nickname']} is HOST")

            public_players.append({
                'nickname': p['nickname'],
                'score': p['score'],
                'is_czar': p['is_czar'],
                'is_host': p.get('is_host', False),
                'has_played': any(c['sid'] == sid for c in self.table_cards),
                'is_spectator': p.get('is_spectator', False)
            })

        visible_table = []
        for entry in self.table_cards:
            if self.state == 'SELECTION':
                visible_table.append({'sid': entry['sid'], 'cards': ['REWERS'] * len(entry['cards']), 'revealed': False})
            else:
                visible_table.append({'sid': entry['sid'], 'cards': entry['cards'], 'revealed': True})

        state_data = {
            'state': self.state,
            'paused': self.paused,
            'players': public_players,
            'current_black_card': self.current_black_card,
            'table_cards': visible_table,
            'czar_nickname': self.players[self.czar_sid]['nickname'] if self.czar_sid and self.czar_sid in self.players else None,
            'settings': self.settings,
            'total_black': len(CARDS['blackCards']),
            'total_white': len(CARDS['whiteCards'])
        }

        socketio.emit('game_update', state_data)

        for sid in self.players:
            socketio.emit('hand_update', {'hand': self.players[sid]['hand']}, room=sid)

    def broadcast_message(self, msg):
        socketio.emit('message', {'text': msg})

game = Game()

@socketio.on('send_reaction')
def on_reaction(data):
    # data: {type: 'up'|'down', target_id: int} (target_id is index in table_cards)
    socketio.emit('reaction_received', data)

@socketio.on('send_global_reaction')
def on_global_reaction(data):
    sid = request.sid
    if sid not in game.players: return

    emoji = data.get('emoji')
    if not emoji: return

    nickname = game.players[sid]['nickname']
    socketio.emit('global_reaction_received', {'emoji': emoji, 'nickname': nickname})

@socketio.on('send_chat')
def on_send_chat(data):
    sid = request.sid
    if sid not in game.players:
        return

    msg = data.get('message', '').strip()
    if not msg:
        return

    nickname = game.players[sid]['nickname']
    is_spectator = game.players[sid].get('is_spectator', False)
    timestamp = time.strftime('%H:%M')

    socketio.emit('new_chat', {
        'nickname': nickname,
        'message': msg,
        'timestamp': timestamp,
        'is_spectator': is_spectator
    })

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join_game')
def on_join(data):
    nickname = data.get('nickname')
    password = data.get('password')
    token = data.get('token')
    is_spectator = data.get('is_spectator', False)

    # Check for reconnection
    if token and token in game.persistent_players:
        player_data = game.persistent_players[token]
        # Restore session
        old_sid = None
        # Find if this player was already connected with an old sid
        for s, t in list(game.sid_map.items()):
            if t == token:
                old_sid = s
                break

        if old_sid and old_sid in game.players:
            del game.players[old_sid]
            del game.sid_map[old_sid]

        game.sid_map[request.sid] = token
        game.players[request.sid] = player_data

        join_room('game_room')
        emit('join_success', {'token': token, 'reconnect': True, 'nickname': player_data['nickname']})
        game.broadcast_state()
        game.broadcast_message(f"Gracz {player_data['nickname']} wrócił!")
        return

    # New login
    if password != game.password:
        emit('join_error', {'message': 'Nieprawidłowe hasło!'})
        return

    if not nickname:
        emit('join_error', {'message': 'Podaj nick!'})
        return

    # Generate new token
    new_token = str(uuid.uuid4())

    # Check host: If no active players exist, this new person is host (unless they are spectator)
    active_players = [p for p in game.players.values() if not p.get('is_spectator', False)]
    is_first = (len(active_players) == 0) and (not is_spectator)

    player_data = {
        'nickname': nickname,
        'score': 0,
        'hand': [],
        'is_czar': False,
        'is_host': is_first,
        'rerolls': 3,
        'is_spectator': is_spectator
    }

    game.persistent_players[new_token] = player_data
    game.sid_map[request.sid] = new_token
    game.players[request.sid] = player_data

    join_room('game_room')
    emit('join_success', {'token': new_token, 'reconnect': False, 'nickname': nickname})
    game.broadcast_state()

    role_msg = "obserwator" if is_spectator else "gracz"
    game.broadcast_message(f"{nickname} dołączył jako {role_msg}.")

@socketio.on('update_settings')
def on_update_settings(data):
    sid = request.sid
    if sid not in game.players: return
    if not game.players[sid].get('is_host', False):
        return

    game.update_settings(data)
    game.broadcast_message("Ustawienia gry zostały zmienione.")

@socketio.on('add_custom_cards')
def on_add_custom_cards(data):
    sid = request.sid
    # Only host can add cards or if allowed by settings?
    # User said "Option to Enable", so if enabled, maybe anyone can?
    # But usually it's a host feature.
    # Let's restrict to Host if "custom_cards_allowed" is NOT set,
    # OR if it IS set, maybe anyone can?
    # Let's stick to: Host can always add (feature 2), but the button visibility is controlled?
    # Or "custom_cards_allowed" enables the feature for EVERYONE?
    # "2 też ma być opcja do włączenia" -> "Option to turn on".
    # I'll implement: Host Only, and "custom_cards_allowed" toggle controls if the button is available/feature active.

    if sid not in game.players: return

    # Check permission: Host only + Feature Enabled
    # Or just Feature Enabled?
    # If it's a "Toggle to enable the feature", typically means enabling the logic.
    if not game.settings.get('custom_cards_allowed', False):
         emit('error', {'message': 'Dodawanie kart jest wyłączone.'})
         return

    # Check host for security, unless we want to allow players to submit?
    # Given the context of "Host adds cards", I'll require Host.
    if not game.players[sid].get('is_host', False):
        emit('error', {'message': 'Tylko host może dodawać karty.'})
        return

    new_black = data.get('black_cards', [])
    new_white = data.get('white_cards', [])

    if not new_black and not new_white:
        return

    # Process Black Cards
    count_b = 0
    for text in new_black:
        text = text.strip()
        if text:
            # Simple parsing for pick count? defaulting to 1
            pick = 1
            if text.count('_____') >= 2:
                pick = 2 # Basic heuristic
            if 'pick' in text: # Advanced user override? Nah.
                pass

            game.black_deck.append({'text': text, 'pick': pick})
            count_b += 1

    # Process White Cards
    count_w = 0
    for text in new_white:
        text = text.strip()
        if text:
            game.white_deck.append(text)
            count_w += 1

    if count_b > 0 or count_w > 0:
        random.shuffle(game.black_deck)
        random.shuffle(game.white_deck)
        game.broadcast_message(f"Dodano {count_b} czarnych i {count_w} białych kart!")

@socketio.on('start_game')
def on_start():
    # Only count active players for start condition
    active_players = [p for p in game.players.values() if not p.get('is_spectator', False)]

    if len(active_players) < 3:
        game.broadcast_message("Potrzeba minimum 3 aktywnych graczy.")
        # pass # Allow for testing

    game.reset_game()
    game.start_round()
    game.broadcast_message("Gra rozpoczęta!")

@socketio.on('toggle_pause')
def on_toggle_pause():
    sid = request.sid
    if sid not in game.players or not game.players[sid].get('is_host', False):
        return

    game.paused = not game.paused
    status = "wstrzymana" if game.paused else "wznowiona"
    game.broadcast_message(f"Gra została {status}.")
    game.broadcast_state()

@socketio.on('start_force_timer')
def on_force_timer():
    sid = request.sid
    if sid not in game.players or not game.players[sid].get('is_host', False):
        return

    game.start_timer(10)
    game.broadcast_message("Host wymusił 10-sekundowe odliczanie!")

@socketio.on('stop_game_manual')
def on_stop_game():
    sid = request.sid
    if sid not in game.players or not game.players[sid].get('is_host', False):
        return

    game.state = 'LOBBY'
    game.stop_timer()
    game.broadcast_message("Gra została zakończona przez hosta.")
    game.broadcast_state()

@socketio.on('reroll_hand')
def on_reroll_hand():
    sid = request.sid
    if sid not in game.players:
        return

    player = game.players[sid]
    if player.get('is_spectator', False):
        return

    if player.get('rerolls', 0) <= 0:
        emit('error', {'message': 'Brak żetonów wymiany!'})
        return

    # Return cards to deck
    game.white_deck.extend(player['hand'])
    random.shuffle(game.white_deck)
    player['hand'] = []

    # Deal new cards (10)
    game.deal_cards(sid, 10)

    player['rerolls'] -= 1

    emit('hand_update', {'hand': player['hand'], 'rerolls': player['rerolls']})
    emit('message', {'text': 'Wymieniono rękę!'})

@socketio.on('play_cards')
def on_play_cards(data):
    sid = request.sid
    if game.state != 'SELECTION':
        return
    if game.players[sid]['is_czar']:
        return
    if game.players[sid].get('is_spectator', False):
        return
    if any(c['sid'] == sid for c in game.table_cards):
        return

    cards = data.get('cards', [])
    pick_needed = game.current_black_card.get('pick', 1)

    if len(cards) != pick_needed:
        emit('error', {'message': f'Musisz wybrać {pick_needed} kart!'})
        return

    # Call the logic method
    # Pre-validation for client error feedback
    hand = game.players[sid]['hand']
    temp_hand = list(hand)

    # Check if user has these cards
    for c in cards:
        if c in temp_hand:
            temp_hand.remove(c)
        elif '<<BLANK>>' in temp_hand:
            temp_hand.remove('<<BLANK>>')
        else:
            emit('error', {'message': 'Nie masz tej karty!'})
            return

    success = game.play_cards_logic(sid, cards, is_auto=False)
    if not success:
         emit('error', {'message': 'Błąd zagrywania kart.'})

@socketio.on('cast_vote')
def on_cast_vote(data):
    sid = request.sid
    if game.state != 'JUDGING' or not game.settings.get('democracy_mode', False):
        return

    # Check if player already voted
    if sid in game.votes:
        return

    target_idx = data.get('target_index')
    if target_idx is None or target_idx < 0 or target_idx >= len(game.table_cards):
        return

    target_entry = game.table_cards[target_idx]

    # Prevent self-voting
    if target_entry['sid'] == sid:
        emit('error', {'message': 'Nie możesz głosować na siebie!'})
        return

    game.votes[sid] = target_idx
    emit('vote_confirmed', {'target_index': target_idx})

    # Check completion
    active_players = [p for p in game.players.values() if not p.get('is_spectator', False)]
    # All active players vote
    if len(game.votes) >= len(active_players):
        # Tally votes
        vote_counts = {}
        for v in game.votes.values():
            vote_counts[v] = vote_counts.get(v, 0) + 1

        # Find max
        max_votes = -1
        winners = []
        for idx, count in vote_counts.items():
            if count > max_votes:
                max_votes = count
                winners = [idx]
            elif count == max_votes:
                winners.append(idx)

        # Tie-break (Random)
        winner_idx = random.choice(winners)
        winner_sid = game.table_cards[winner_idx]['sid']

        game.resolve_round(winner_sid)


@socketio.on('select_winner')
def on_select_winner(data):
    sid = request.sid
    if game.state != 'JUDGING':
        return
    # In democracy mode, Czar selection is disabled
    if game.settings.get('democracy_mode', False):
        return
    if not game.players[sid]['is_czar']:
        return

    winner_cards = data.get('cards')

    winner_sid = None
    for entry in game.table_cards:
        if entry['cards'] == winner_cards:
            winner_sid = entry['sid']
            break

    if winner_sid:
        game.resolve_round(winner_sid)

@socketio.on('kick_player')
def on_kick_player(data):
    sid = request.sid
    if sid not in game.players or not game.players[sid].get('is_host', False):
        return

    target_nick = data.get('nickname')
    target_sid = None
    for s, p in game.players.items():
        if p['nickname'] == target_nick:
            target_sid = s
            break

    if target_sid:
        socketio.emit('kicked', room=target_sid)
        target_token = game.sid_map.get(target_sid)
        if target_token and target_token in game.persistent_players:
            del game.persistent_players[target_token]

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid in game.players:
        nick = game.players[sid]['nickname']

        del game.players[sid]
        if sid in game.sid_map:
            del game.sid_map[sid]

        game.broadcast_message(f"Gracz {nick} rozłączył się.")

        if not game.players:
            print("All players disconnected. Resetting game state.")
            game.persistent_players.clear()
            game.reset_game()
            game.state = 'LOBBY'
            return

        # If host left, assign new host
        # Check if host still exists (and is not spectator preferably, but if only spectators left, what then?)
        # Logic: Assign host to first active player. If no active, first spectator.
        current_hosts = [p for p in game.players.values() if p.get('is_host')]
        if not current_hosts:
            # Priority: Active Player > Spectator
            candidates = [s for s, p in game.players.items() if not p.get('is_spectator')]
            if not candidates:
                candidates = list(game.players.keys())

            if candidates:
                new_host_sid = candidates[0]
                game.players[new_host_sid]['is_host'] = True
                game.broadcast_message(f"{game.players[new_host_sid]['nickname']} jest nowym hostem.")

        # Check active players count for game continuation
        active_count = len([p for p in game.players.values() if not p.get('is_spectator')])

        if active_count < 2 and game.state != 'LOBBY':
             game.state = 'LOBBY'
             game.stop_timer()
             game.broadcast_message("Zbyt mało graczy. Powrót do lobby.")
        elif game.czar_sid == sid:
             # Czar left - restart round logic or wait?
             # For simplicity, restart round if enough players
             if active_count >= 2:
                 game.start_round()
             else:
                 game.state = 'LOBBY'
                 game.stop_timer()

        game.broadcast_state()

if __name__ == '__main__':
    socketio.run(app, debug=False, host='0.0.0.0', port=3000)
