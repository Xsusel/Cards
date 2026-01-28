from playwright.sync_api import sync_playwright, expect
import time

def test_features(page):
    print("Navigating to app...")
    page.goto("http://localhost:3000")

    # Login
    print("Logging in...")
    page.fill("#nickname", "RoboTester")
    page.fill("#password", "1234")
    page.click("#join-btn")

    # Wait for game area
    print("Waiting for game area...")
    page.wait_for_selector("#game-area", state="visible")

    # Check Reaction Bar
    print("Checking reaction bar...")
    reaction_bar = page.locator("#reaction-bar")
    expect(reaction_bar).to_be_visible()

    # Check Avatar SVG
    print("Checking avatar...")
    # The avatar is in #players-list .player-avatar svg
    avatar_svg = page.locator(".player-avatar svg")
    # Might need to wait a moment for socket to populate list
    page.wait_for_selector(".player-avatar svg")
    expect(avatar_svg).to_be_visible()

    # Interact with reaction
    print("Clicking reaction...")
    page.click(".reaction-btn[data-emoji='😂']")

    # Wait a bit for animation
    time.sleep(2)

    # Screenshot
    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_features(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
