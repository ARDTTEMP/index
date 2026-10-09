import { chromium } from "@playwright/test";
import chromiumBinary from "@sparticuz/chromium";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || await chromiumBinary.executablePath(),
  args: chromiumBinary.args.filter((a) => a !== "--disable-web-security"),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", {
      name: /Transformons notre\s*environnement\s*ensemble\./,
    })
    .waitFor();
  await page.screenshot({
    path: "/tmp/ardttemp-home-desktop.png",
    fullPage: true,
  });
  const responsePromise = page.waitForResponse((r) =>
    r.url().includes("/api/locale"),
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  await page
    .getByRole("heading", {
      name: /Let’s transform our\s*environment\s*together\./,
    })
    .waitFor();
  for (const path of [
    "about",
    "activities",
    "join",
    "donate",
    "contact",
    "news",
    "login",
    "register",
  ]) {
    const r = await page.goto(`${base}/${path}`, { waitUntil: "networkidle" });
    assert.equal(r.status(), 200, path);
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.ok(await page.locator("h1").innerText());
  }
  await page.goto(base + "/register");
  await page.getByLabel("Full name", { exact: true }).fill("Test Reader");
  await page
    .getByLabel("Email", { exact: true })
    .first()
    .fill("browser-test@example.invalid");
  await page.getByLabel("Phone", { exact: true }).fill("+237600000099");
  await page.getByLabel("City", { exact: true }).fill("Yaoundé");
  await page.locator("select[name=region]").selectOption("Centre");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("select[name=requested_role]").waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  assert.equal(
    await page.getByLabel("Full name", { exact: true }).inputValue(),
    "Test Reader",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "No horizontal mobile overflow",
  );
  await page
    .getByRole("button", { name: "Navigation menu", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "About us", exact: true })
    .waitFor({ state: "visible" });
  await page.screenshot({
    path: "/tmp/ardttemp-home-mobile.png",
    fullPage: true,
  });
  await page.goto(base + "/dashboard");
  assert.ok(
    page.url().includes("/login"),
    "Unauthenticated dashboard redirects",
  );
  await page.goto(base + "/dashboard/admin");
  assert.ok(page.url().includes("/login"), "Unauthenticated admin redirects");
  const csrf = await page.request.post(base + "/api/platform", {
    data: { op: "contact" },
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(csrf.status(), 403);
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    "PASS: public FR/EN routes, registration steps, responsive navigation, auth redirects and CSRF.",
  );
} finally {
  await browser.close();
}
