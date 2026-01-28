from playwright.sync_api import sync_playwright, expect
import time

def test_settings_ui(page):
    print("Navigating to app...")
    page.goto("http://localhost:3000")

    # Login
    print("Logging in...")
    page.fill("#nickname", "SettingsTester")
    page.fill("#password", "1234")
    page.click("#join-btn")

    # Wait for game area
    print("Waiting for game area...")
    page.wait_for_selector("#game-area", state="visible")

    # Open Settings
    print("Opening settings...")
    # NOTE: Settings button is usually hidden for non-host, but in single player test, first join is Host.
    # However, sometimes there's a delay. Let's wait for the button.
    # Also, we might need to click it.

    # Host controls are only visible if is_host=True.
    # In local single session, first player is host.

    # Check if settings btn is visible
    page.wait_for_selector("#settings-btn", state="visible", timeout=5000)
    page.click("#settings-btn")

    page.wait_for_selector("#settings-modal", state="visible")

    # Wait a bit for animation
    time.sleep(1)

    # Screenshot
    print("Taking screenshot of settings...")
    page.screenshot(path="verification/settings_ui.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_settings_ui(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_settings.png")
        finally:
            browser.close()
