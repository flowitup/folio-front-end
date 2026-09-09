import { chromium } from "playwright";
const OUT = process.argv[2];
const browser = await chromium.launch();
async function login(page, locale) {
  await page.goto(`http://localhost:3000/${locale}/login`);
  await page.fill('input[type=email]', "admin@example.com");
  await page.fill('input[type=password]', "password123");
  await page.click("button[type=submit]");
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForSelector("[data-testid=chat-fab]", { timeout: 20000 });
  await page.waitForTimeout(800);
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  await login(page, "en");
  await page.locator("[data-testid=chat-fab]").click();
  await page.waitForSelector("[data-testid=chat-panel]", { timeout: 20000 });
  await page.waitForSelector("[data-testid=chat-message-mine], [data-testid=chat-empty]", { timeout: 20000 });
  await page.waitForTimeout(800);
  const drawer = await page.locator("[data-testid=chat-drawer]").boundingBox();
  await page.screenshot({ path: `${OUT}/chat-drawer-compact-en.png` });
  const compact = { width: drawer.width, right: 1440 - (drawer.x + drawer.width), fabHidden: (await page.locator("[data-testid=chat-fab]").count()) === 0, chips: await page.locator("[data-testid=chat-channel-chips]").count(), list: await page.locator("[data-testid=chat-channel-list]").count(), title: await page.locator("[data-testid=chat-title]").textContent(), url: page.url() };
  await page.locator("[data-testid=chat-drawer-expand]").click();
  await page.waitForTimeout(500);
  const wide = await page.locator("[data-testid=chat-drawer]").boundingBox();
  await page.getByRole("tab", { name: /Folio Demo SARL/ }).click();
  await page.waitForSelector("[data-testid=chat-attachment]", { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/chat-drawer-expanded-en.png` });
  const expanded = { width: wide.width, list: await page.locator("[data-testid=chat-channel-list]").count(), chips: await page.locator("[data-testid=chat-channel-chips]").count(), title: await page.locator("[data-testid=chat-title]").textContent(), imgLoaded: await page.locator("[data-testid=chat-attachment] img").count() };
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const closed = { drawer: await page.locator("[data-testid=chat-drawer]").count(), fabBack: await page.locator("[data-testid=chat-fab]").count(), stillOnDashboard: page.url().includes("/dashboard") };
  console.log(JSON.stringify({ compact, expanded, closed, consoleErrors: errors }));
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await login(page, "vi");
  await page.locator("[data-testid=chat-fab]").click();
  await page.waitForSelector("[data-testid=chat-panel]", { timeout: 20000 });
  await page.waitForSelector("[data-testid=chat-message-mine], [data-testid=chat-empty]", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/chat-drawer-mobile-vi.png` });
  const d = await page.locator("[data-testid=chat-drawer]").boundingBox();
  console.log(JSON.stringify({ mobileDrawerWidth: d.width, expandToggle: await page.locator("[data-testid=chat-drawer-expand]").count() }));
  await ctx.close();
}
await browser.close();
