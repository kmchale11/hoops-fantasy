// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstallOffer, { DISMISS_KEY } from "@/app/pwa/install-offer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 24 * 3600 * 1000;
let container: HTMLDivElement;
let root: Root;
let standalone: boolean;

beforeEach(() => {
  standalone = false;
  localStorage.clear();
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === "(display-mode: standalone)" && standalone,
    media: query,
  })) as unknown as typeof window.matchMedia;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(() => root.render(<InstallOffer />));

/** What Chrome fires when the site can be installed. */
function offerInstall() {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: "dismissed" as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement | undefined;

describe("install offer", () => {
  it("offers to install when the browser allows it", async () => {
    render();
    expect(container.textContent).toBe("");
    const event = offerInstall();
    expect(event.defaultPrevented).toBe(true);
    expect(button("Install app")).toBeDefined();
    await act(async () => button("Install app")!.click());
    expect(event.prompt).toHaveBeenCalled();
  });

  it("stays hidden for 30 days after it's dismissed", () => {
    render();
    offerInstall();
    act(() => button("Not now")!.click());
    expect(container.textContent).toBe("");
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
    expect(Date.now() - dismissedAt).toBeLessThan(1000);

    // A visit 29 days later: still hidden.
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 29 * DAY));
    act(() => root.unmount());
    root = createRoot(container);
    render();
    offerInstall();
    expect(container.textContent).toBe("");

    // 31 days later: offered again.
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 31 * DAY));
    act(() => root.unmount());
    root = createRoot(container);
    render();
    offerInstall();
    expect(button("Install app")).toBeDefined();
  });

  it("is never shown inside the installed app", () => {
    standalone = true;
    render();
    offerInstall();
    expect(container.textContent).toBe("");
  });

  it("explains Add to Home Screen on iPhone Safari", () => {
    const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    render();
    expect(container.textContent).toContain("Add to Home Screen");
    ua.mockRestore();
  });
});
