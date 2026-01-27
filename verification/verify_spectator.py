from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)

    # Context for Host
    context_host = browser.new_context()
    page_host = context_host.new_page()

    # Context for Spectator
    context_spec = browser.new_context()
    page_spec = context_spec.new_page()

    # 1. Host Joins
    print("Host joining...")
    page_host.goto("http://localhost:3000")
    page_host.fill("#nickname", "HostPlayer")
    page_host.fill("#password", "1234")
    page_host.click("#join-btn")
    expect(page_host.locator("#game-area")).to_be_visible()
    print("Host joined.")

    # 2. Spectator Joins
    print("Spectator joining...")
    page_spec.goto("http://localhost:3000")
    page_spec.fill("#nickname", "SpecPlayer")
    page_spec.fill("#password", "1234")
    page_spec.click("#spectate-btn") # Click the Spectate button
    expect(page_spec.locator("#game-area")).to_be_visible()
    print("Spectator joined.")

    # 3. Verify Spectator Indicator on Host Screen
    print("Verifying spectator badge on Host screen...")
    # Find list item containing "SpecPlayer" and check if it has "WIDZ" badge
    spec_item_host = page_host.locator("#players-list li", has_text="SpecPlayer")
    expect(spec_item_host).to_contain_text("WIDZ")
    print("Host sees Spectator badge.")

    # 4. Verify Spectator UI
    print("Verifying Spectator UI...")
    # Hand section should be hidden
    expect(page_spec.locator("#hand-section")).to_be_hidden()
    print("Spectator hand is hidden.")

    # 5. Host Starts Game
    # Note: We need at least 3 active players to start game usually, unless we modified that logic or tests allow fewer.
    # Looking at app.py: if len(active_players) < 3: broadcast("Potrzeba minimum 3 aktywnych graczy.")
    # So we need to add 2 more active players (bots) to start the game.

    print("Adding dummy players to start game...")
    context_p2 = browser.new_context()
    page_p2 = context_p2.new_page()
    page_p2.goto("http://localhost:3000")
    page_p2.fill("#nickname", "Player2")
    page_p2.fill("#password", "1234")
    page_p2.click("#join-btn")

    context_p3 = browser.new_context()
    page_p3 = context_p3.new_page()
    page_p3.goto("http://localhost:3000")
    page_p3.fill("#nickname", "Player3")
    page_p3.fill("#password", "1234")
    page_p3.click("#join-btn")

    print("Dummy players joined.")

    print("Host starting game...")
    page_host.click("#start-btn")

    # Wait for game to start (Host sees timer)
    expect(page_host.locator("#timer-display")).to_be_visible()
    print("Game started.")

    # 6. Verify Spectator still has no hand
    time.sleep(2) # Wait a bit for cards dealing (which shouldn't happen for spectator)
    # Re-check hand section visibility/emptiness
    expect(page_spec.locator("#hand-section")).to_be_hidden()
    print("Spectator hand is still hidden after start.")

    # Screenshot Spectator View
    page_spec.screenshot(path="verification/spectator_view.png")
    print("Screenshot taken: spectator_view.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
