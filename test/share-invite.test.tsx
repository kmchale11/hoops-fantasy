// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The form components share a file with the league server actions; they aren't used here.
vi.mock("@/app/leagues/actions", () => ({}));
const { ShareInvite, inviteMessage } = await import("@/app/leagues/league-forms");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(navigator, "share");
});

const render = () =>
  act(() => root.render(<ShareInvite leagueName="Thursday Ballers" path="/join/ABC234" />));
const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name);
const click = (name: string) => act(async () => button(name)!.click());
const LINK = `${window.location.origin}/join/ABC234`;

describe("ShareInvite", () => {
  it("builds the message from the league name and the full invite link", () => {
    expect(inviteMessage("Thursday Ballers", "/join/ABC234", "https://hoopsfantasy.ie/leagues/7")).toEqual({
      title: "Join Thursday Ballers on Irish Basketball Fantasy",
      text: 'Join my league "Thursday Ballers" on Irish Basketball Fantasy',
      url: "https://hoopsfantasy.ie/join/ABC234",
    });
  });

  it("opens the share sheet with the league name and link where the browser has one", async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render();

    await click("Share invite");
    expect(share).toHaveBeenCalledWith({
      title: "Join Thursday Ballers on Irish Basketball Fantasy",
      text: 'Join my league "Thursday Ballers" on Irish Basketball Fantasy',
      url: LINK,
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(button("Copy invite link")).toBeDefined();
  });

  it("uses the phone's own share sheet in the app", async () => {
    const share = vi.fn().mockRejectedValue(new Error("Share canceled"));
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: { Share: { share } } };
    try {
      render();
      await click("Share invite");
      expect(share).toHaveBeenCalledWith({
        title: "Join Thursday Ballers on Irish Basketball Fantasy",
        text: 'Join my league "Thursday Ballers" on Irish Basketball Fantasy',
        url: LINK,
        dialogTitle: "Share invite",
      });
      // Android can report "cancelled" after a successful share, so nothing is copied.
      expect(writeText).not.toHaveBeenCalled();
    } finally {
      delete (globalThis as { Capacitor?: unknown }).Capacitor;
    }
  });

  it("only offers copying where there's no share sheet", async () => {
    render();
    expect(button("Share invite")).toBeUndefined();

    await click("Copy invite link");
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(button("Link copied")).toBeDefined();
  });

  it("does nothing more when the share sheet is closed, and copies when sharing fails", async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render();

    await click("Share invite");
    expect(writeText).not.toHaveBeenCalled();

    share.mockRejectedValueOnce(new DOMException("Not allowed", "NotAllowedError"));
    await click("Share invite");
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(button("Link copied")).toBeDefined();
  });
});
