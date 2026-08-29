"""Real-browser validation regression for the three concrete AG Grid roots.

This is intentionally a browser layer, not a replacement for Vitest/state tests. It catches failures that
only appear when AG Grid renders actual transient LOCAL drafts (formatter exceptions, wrong cell classes,
button state, and Flow 2 wiring).
"""

from __future__ import annotations

import sys
import time
import urllib.error
import urllib.request
from contextlib import contextmanager

from playwright.sync_api import Page, sync_playwright

BASE_URL = "http://127.0.0.1:5173"
ROUTES = ("/client", "/infinite", "/ssrm")


def wait_for_app(timeout_seconds: float = 45.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/client", timeout=2) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
        time.sleep(0.5)
    raise RuntimeError(f"Vite app did not become reachable: {last_error}")


@contextmanager
def no_page_errors(page: Page, scenario: str):
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    yield errors
    if errors:
        raise AssertionError(f"{scenario} produced uncaught browser errors: {errors}")


def open_grid(page: Page, route: str) -> None:
    page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded")
    page.locator(".ag-root").wait_for(state="visible", timeout=20_000)
    page.locator(".ag-row").first.wait_for(state="visible", timeout=20_000)


def apply_blank_flow2_field(page: Page, field_label: str) -> None:
    page.get_by_role("checkbox", name=field_label, exact=True).click()
    page.get_by_role("button", name="Apply bulk edit", exact=True).click()


def assert_currency_blank_is_safe(page: Page, route: str) -> None:
    open_grid(page, route)
    with no_page_errors(page, f"{route} blank Currency Flow 2"):
        currency_checkbox = page.get_by_role("checkbox", name="Currency", exact=True)
        currency_checkbox.click()
        page.get_by_text("Currency is required.", exact=True).wait_for(state="visible")
        page.get_by_role("button", name="Apply bulk edit", exact=True).click()

        invalid_currency = page.locator(
            '.ag-cell[col-id="currency"].grid-cell--validation-error'
        )
        invalid_currency.first.wait_for(state="visible", timeout=10_000)
        if invalid_currency.count() == 0:
            raise AssertionError(f"{route}: blank Currency did not create invalid LOCAL cells")

        # The regression that motivated this test: amount formatting used row.currency directly and threw
        # RangeError for ''. A real grid row must continue rendering its amount/status after the invalid
        # currency draft is applied.
        row = invalid_currency.first.locator("xpath=ancestor::*[contains(@class,'ag-row')][1]")
        amount_text = row.locator('.ag-cell[col-id="amount"]').inner_text().strip()
        if not amount_text:
            raise AssertionError(f"{route}: Amount disappeared after invalid Currency draft")

        status_cell = row.locator('.ag-cell[col-id="status"]')
        if "grid-cell--validation-error" in (status_cell.get_attribute("class") or ""):
            raise AssertionError(
                f"{route}: Currency validation was incorrectly presented on the adjacent Status cell"
            )

        save_button = row.get_by_role("button", name="Save", exact=True)
        if save_button.is_enabled():
            raise AssertionError(f"{route}: Row Save stayed enabled for invalid Currency LOCAL draft")


def assert_blank_amount_is_not_ignored(page: Page, route: str) -> None:
    open_grid(page, route)
    with no_page_errors(page, f"{route} blank Amount Flow 2"):
        amount_checkbox = page.get_by_role("checkbox", name="Amount", exact=True)
        amount_checkbox.click()
        page.get_by_text("Amount must be between 0 and 1,000,000.", exact=True).wait_for(
            state="visible"
        )
        page.get_by_role("button", name="Apply bulk edit", exact=True).click()

        invalid_amount = page.locator('.ag-cell[col-id="amount"].grid-cell--validation-error')
        invalid_amount.first.wait_for(state="visible", timeout=10_000)
        if invalid_amount.count() == 0:
            raise AssertionError(
                f"{route}: checked + blank Amount was ignored instead of becoming invalid LOCAL"
            )

        row = invalid_amount.first.locator("xpath=ancestor::*[contains(@class,'ag-row')][1]")
        status_cell = row.locator('.ag-cell[col-id="status"]')
        if "grid-cell--validation-error" in (status_cell.get_attribute("class") or ""):
            raise AssertionError(
                f"{route}: Amount validation was incorrectly presented on the adjacent Status cell"
            )
        if row.get_by_role("button", name="Save", exact=True).is_enabled():
            raise AssertionError(f"{route}: Row Save stayed enabled for invalid Amount LOCAL draft")


def main() -> int:
    wait_for_app()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": 1800, "height": 1000})
            for route in ROUTES:
                assert_currency_blank_is_safe(page, route)
                assert_blank_amount_is_not_ignored(page, route)
        finally:
            browser.close()
    print("Grid validation browser regression passed for Client, Infinite and SSRM.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
