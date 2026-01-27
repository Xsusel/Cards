from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Login as Host
    print("Logging in as Host...")
    page.goto("http://localhost:3000")
    page.fill("#nickname", "HostPlayer")
    page.fill("#password", "1234")
    page.click("#join-btn")
    expect(page.locator("#game-area")).to_be_visible()

    # 2. Check for "ROZPOCZNIJ GRĘ" button
    print("Checking for Start Game button...")
    start_btn = page.locator("#start-btn")

    # Wait a moment for socket to sync
    time.sleep(1)

    if start_btn.is_visible():
        print("SUCCESS: Start Game button is visible.")
    else:
        print("FAILURE: Start Game button is NOT visible.")
        # Check if hidden class is present
        classes = start_btn.get_attribute("class")
        print(f"Button classes: {classes}")

        # Check game status text
        status = page.locator("#game-status").inner_text()
        print(f"Game Status Text: {status}")

        # Check if user is actually host in JS
        is_host = page.evaluate("window.isHost")
        print(f"JS isHost: {is_host}")

        page.screenshot(path="verification/host_button_fail.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
