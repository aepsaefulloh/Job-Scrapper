# Camoufox browser automation

## Context

Scrapers need rendered HTML but must not expose browser APIs outside a small infrastructure boundary.

## Decision

Use `playwright-core` behind `BrowserService`, launching a configured Camoufox Firefox executable. The application does not download browsers automatically.

## Consequences

Browser sessions are explicit and disposable; local executable setup is configured outside source control. Tests inject a browser double.

## Alternatives considered

An unofficial Camoufox Node wrapper was rejected because its lifecycle and support are independent from Camoufox itself. Direct Playwright imports in scraper providers were rejected because they leak infrastructure details.
