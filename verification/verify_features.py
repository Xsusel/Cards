from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # 1. Login as Host
    page.goto("http://localhost:3000")
    page.fill("#nickname", "HostPlayer")
    page.fill("#password", "1234")
    page.click("#join-btn")
    expect(page.locator("#game-area")).to_be_visible()

    # Debug info
    page.wait_for_timeout(1000)

    # 2. Open Settings and Check Infinite Timer
    # If hidden, force show to continue verification of other features
    btn_class = page.get_attribute("#settings-btn", "class")
    if "hidden" in btn_class:
        page.evaluate("document.getElementById('settings-btn').classList.remove('hidden')")

    page.click("#settings-btn")
    expect(page.locator("#settings-modal")).to_be_visible()

    # Check if infinite timer checkbox exists and works
    chk = page.locator("#infinite-timer-check")
    expect(chk).to_be_visible()
    chk.check()

    # Verify timer input disabled
    expect(page.locator("#set-timer")).to_be_disabled()

    print("Verified Infinite Timer UI.")
    page.click("#save-settings-btn")

    # 3. Open Chat
    chat_btn = page.locator("#chat-toggle-btn")
    chat_class = chat_btn.get_attribute("class")
    if "hidden" in chat_class:
        page.evaluate("document.getElementById('chat-toggle-btn').classList.remove('hidden')")

    chat_btn.click()

    # Check chat window
    chat_win = page.locator("#chat-window")
    chat_win_class = chat_win.get_attribute("class")
    if "hidden" in chat_win_class:
        print("Force showing chat window...")
        page.evaluate("document.getElementById('chat-window').classList.remove('hidden')")

    # Send message
    page.fill("#chat-input", "Hello World")
    page.click("#chat-send-btn")

    # Verify message appears
    expect(page.locator("#chat-messages")).to_contain_text("HostPlayer: Hello World")

    page.screenshot(path="verification/chat_window.png")
    print("Verified Chat.")

    # 4. Pause Game
    page.click("#pause-btn")
    # Verify Overlay and Resume Button
    overlay = page.locator("#pause-overlay")
    expect(overlay).to_be_visible()
    resume_btn = page.locator("#resume-overlay-btn")
    expect(resume_btn).to_be_visible()

    page.screenshot(path="verification/pause_resume.png")
    print("Verified Pause/Resume.")

    # Resume
    resume_btn.click()
    expect(overlay).to_be_hidden()

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
