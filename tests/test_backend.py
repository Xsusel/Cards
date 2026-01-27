import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app

class TestGame(unittest.TestCase):
    def setUp(self):
        # Mock socketio
        app.socketio = MagicMock()
        self.game = app.Game()
        self.game.reset_game()

    def test_initial_state(self):
        self.assertEqual(self.game.state, 'LOBBY')
        self.assertEqual(len(self.game.players), 0)

    def test_deal_cards(self):
        # Add a dummy player
        self.game.players['sid1'] = {'nickname': 'P1', 'score': 0, 'hand': [], 'is_czar': False}

        # Ensure deck has cards
        self.game.white_deck = ["Card1", "Card2", "Card3", "Card4", "Card5", "Card6"]

        self.game.deal_cards('sid1', 5)
        self.assertEqual(len(self.game.players['sid1']['hand']), 5)
        self.assertEqual(len(self.game.white_deck), 1)

    def test_start_round(self):
        self.game.players['sid1'] = {'nickname': 'P1', 'score': 0, 'hand': [], 'is_czar': False}
        self.game.players['sid2'] = {'nickname': 'P2', 'score': 0, 'hand': [], 'is_czar': False}
        self.game.players['sid3'] = {'nickname': 'P3', 'score': 0, 'hand': [], 'is_czar': False}

        self.game.start_round()

        self.assertEqual(self.game.state, 'SELECTION')
        self.assertIsNotNone(self.game.current_black_card)
        self.assertIsNotNone(self.game.czar_sid)

        # Check if hands were replenished
        self.assertEqual(len(self.game.players['sid1']['hand']), 5)

if __name__ == '__main__':
    unittest.main()
