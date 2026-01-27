from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Login
    page.goto("http://localhost:5000")
    page.fill("#nickname", "HostPlayer")
    page.fill("#password", "1234")
    page.click("#join-btn")

    # Wait for game area
    page.wait_for_selector("#game-area", state="visible")

    # 2. Open Settings
    # Button is #settings-btn
    page.wait_for_selector("#settings-btn", state="visible")
    page.click("#settings-btn")

    # 3. Verify Modal
    page.wait_for_selector("#settings-modal", state="visible")
    expect(page.locator("#settings-modal")).to_contain_text("Ustawienia Gry")

    # Screenshot Modal
    page.screenshot(path="verification/settings_modal.png")
    print("Screenshot taken: settings_modal.png")

    # 4. Change Settings
    page.fill("#set-max-score", "15")
    page.fill("#set-timer", "45")
    page.click("#save-settings-btn")

    # 5. Verify Toast
    # Toast appears dynamically
    toast = page.locator(".toast").first
    expect(toast).to_be_visible()
    expect(toast).to_contain_text("Ustawienia zaktualizowane")

    # Screenshot Toast
    page.screenshot(path="verification/settings_toast.png")
    print("Screenshot taken: settings_toast.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
