import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, redirectOf, resetAuth, form } from "./helpers/auth";
import { createTestDb } from "./helpers/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
vi.mock("@/lib/origin", () => ({ requestOrigin: async () => "https://hoops.example" }));

const { GET: callback } = await import("@/app/auth/callback/route");
const { appGoogleSignInUrl, sendMagicLink } = await import("@/app/sign-in/actions");
const { default: SignInPage } = await import("@/app/sign-in/page");

const visit = (query: string) => callback(new Request(`https://hoops.example/auth/callback?${query}`));
const location = (res: Response) => {
  const url = new URL(res.headers.get("location")!);
  return url.pathname + url.search;
};

beforeEach(async () => {
  resetAuth((await createTestDb()).db);
});

describe("magic link sign-in", () => {
  it("emails a link that comes back to /auth/callback", async () => {
    const state = await sendMagicLink({ status: "idle" }, form({ email: " niamh@example.ie " }));

    expect(state).toEqual({ status: "sent", email: "niamh@example.ie" });
    expect(auth.client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "niamh@example.ie",
      options: { emailRedirectTo: "https://hoops.example/auth/callback", shouldCreateUser: true },
    });
  });

  it("rejects an invalid email address without sending anything", async () => {
    const state = await sendMagicLink({ status: "idle" }, form({ email: "not-an-email" }));
    expect(state.status).toBe("error");
    expect(auth.client.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("signs the visitor in when they open a valid link, then sends them on to play", async () => {
    const res = await visit("token_hash=abc123&type=email");

    expect(auth.client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc123", type: "email" });
    expect(res.status).toBe(307);
    expect(location(res)).toBe("/squad");
  });

  it("signs in with Google via the code exchange and keeps the requested page", async () => {
    const res = await visit("code=xyz&next=%2Faccount");
    expect(auth.client.auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
    expect(location(res)).toBe("/account");
  });

  it("explains a link opened on another device and offers a new one", async () => {
    auth.client.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {},
      error: { code: "pkce_code_verifier_not_found", message: "PKCE code verifier not found in storage." },
    });
    const res = await visit("code=xyz");
    expect(location(res)).toBe("/sign-in?error=other-device");

    const html = renderToStaticMarkup(
      await SignInPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ error: "other-device" }),
      } as PageProps<"/sign-in">),
    );
    expect(html).toContain("opened on a different phone, browser or app");
    expect(html).toContain("send a new link to use on this device");
    expect(html).toContain('type="email"');
  });

  it("never redirects off-site after signing in", async () => {
    expect(location(await visit("code=xyz&next=%2F%2Fevil.example"))).toBe("/squad");
    expect(location(await visit("code=xyz&next=https%3A%2F%2Fevil.example"))).toBe("/squad");
  });
});

describe("Google sign-in in the app", () => {
  it("returns the Google address for the browser sheet, coming back on the app's scheme", async () => {
    expect(await appGoogleSignInUrl("/leagues/join?code=ABC234")).toBe("https://accounts.google.com/o/oauth2");
    expect(auth.client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "ie.hoopsfantasy.app://auth/callback?next=%2Fleagues%2Fjoin%3Fcode%3DABC234",
        skipBrowserRedirect: true,
      },
    });
  });

  it("only returns to pages on this site", async () => {
    await appGoogleSignInUrl("https://evil.example");
    expect(auth.client.auth.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      "ie.hoopsfantasy.app://auth/callback?next=%2Fsquad",
    );
  });

  it("finishes in the app's web view like any Google sign-in", async () => {
    const res = await visit("code=abc&next=%2Fleagues");
    expect(auth.client.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(location(res)).toBe("/leagues");
  });
});

describe("expired magic link", () => {
  it("does not sign the visitor in and sends them to request a new link", async () => {
    auth.client.auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", message: "Email link is invalid or has expired" },
    });
    const res = await visit("token_hash=old&type=email");
    expect(location(res)).toBe("/sign-in?error=expired");
  });

  it("handles Supabase reporting the expiry in the redirect itself", async () => {
    const res = await visit("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(auth.client.auth.verifyOtp).not.toHaveBeenCalled();
    expect(location(res)).toBe("/sign-in?error=expired");
  });

  it("explains the link expired and offers to send a new one", async () => {
    const page = await SignInPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ error: "expired" }),
    } as PageProps<"/sign-in">);
    const html = renderToStaticMarkup(page);

    expect(html).toContain("That sign-in link has expired or has already been used");
    expect(html).toContain("we&#x27;ll send you a new one");
    expect(html).toContain('name="email"');
    expect(html).toContain("Email me a sign-in link");
  });

  it("treats any other failure as a general sign-in error", async () => {
    auth.client.auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: "unexpected", message: "boom" } });
    expect(location(await visit("token_hash=x&type=email"))).toBe("/sign-in?error=failed");
    expect(location(await visit(""))).toBe("/sign-in?error=failed");
  });
});

describe("sign-in page", () => {
  it("sends someone already signed in but not set up to finish sign-up", async () => {
    auth.user = { id: "00000000-0000-0000-0000-000000000001", email: "a@example.ie" };
    const to = await redirectOf(() =>
      SignInPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as PageProps<"/sign-in">),
    );
    expect(to).toBe("/welcome?next=%2Fsquad");
  });
});
