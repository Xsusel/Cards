from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # 1. Navigate
            page.goto("http://localhost:3000")

            # 2. Login
            page.fill("#nickname", "HostUser")
            page.fill("#password", "1234")
            page.click("#join-btn")

            # Wait for game area
            expect(page.locator("#game-area")).to_be_visible()

            # 3. Open Settings
            page.click("#settings-btn")
            expect(page.locator("#settings-modal")).to_be_visible()

            # 4. Check for new elements
            expect(page.locator("#set-democracy")).to_be_visible()
            expect(page.locator("#set-custom-cards")).to_be_visible()
            expect(page.locator("#set-jokers")).to_be_visible()

            # 5. Enable Custom Cards
            page.check("#set-custom-cards")
            page.click("#save-settings-btn")
            expect(page.locator("#settings-modal")).to_be_hidden()

            # 6. Verify Add Cards button appears
            expect(page.locator("#add-cards-btn")).to_be_visible()

            # 7. Open Add Cards Modal
            page.click("#add-cards-btn")
            expect(page.locator("#add-cards-modal")).to_be_visible()

            # 8. Screenshot
            page.screenshot(path="verification/frontend_verify.png")
            print("Screenshot taken.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
