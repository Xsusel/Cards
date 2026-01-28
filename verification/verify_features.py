from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Navigate
        page.goto("http://localhost:3000")

        # Login
        page.fill("#nickname", "Tester")
        page.fill("#password", "1234")
        page.click("#join-btn")

        # Wait for game area
        page.wait_for_selector("#game-area:not(.hidden)")

        # Verify Copy Link button exists
        copy_btn = page.locator("#copy-link-btn")
        expect(copy_btn).to_be_visible()

        # Open Settings to see Volume Slider (Persistence check needs reload but this verifies UI)
        # Note: Settings button is only visible to HOST.
        # Since I'm the first player, I should be host.
        page.click("#settings-btn")
        page.wait_for_selector("#settings-modal:not(.hidden)")

        # Check volume slider
        slider = page.locator("#volume-slider")
        expect(slider).to_be_visible()

        # Take screenshot of Settings + Lobby
        page.screenshot(path="verification/verification.png")

        browser.close()

if __name__ == "__main__":
    run()
