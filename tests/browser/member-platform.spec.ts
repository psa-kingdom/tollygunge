import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type Locator,
} from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../../src/lib/database-options";
import { initialFields, missingFields } from "../../src/domain/verification";

test.beforeEach(() =>
  test.skip(
    !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
    "Requires isolated member database and postal reference.",
  ),
);
async function member(context: BrowserContext, legacyStudent = false) {
  const db = new Pool(databaseOptions()),
    id = randomUUID(),
    token = randomBytes(24).toString("hex");
  try {
    expect((await db.query("SELECT current_database() n")).rows[0].n).toBe(
      process.env.TPA_DATABASE_NAME,
    );
    await db.query(
      'INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,$2,$3,true)',
      [id, "Ananya Mukherjee", `${id}@example.invalid`],
    );
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
      [randomUUID(), token, id],
    );
    const evidence = randomUUID();
    if (legacyStudent)
      await db.query(
        "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,'student_evidence','application/pdf',10)",
        [evidence, id],
      );
    if (legacyStudent) {
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "ALTER TABLE tpa.application_drafts DISABLE TRIGGER professional_application_write",
        );
        await client.query(
          "INSERT INTO tpa.application_drafts(id,user_id,plan,category,details,step) VALUES($1,$2,'Annual','Student',$3,2)",
          [
            randomUUID(),
            id,
            { fullName: "Ananya Mukherjee", studentEvidence: evidence },
          ],
        );
        await client.query(
          "ALTER TABLE tpa.application_drafts ENABLE TRIGGER professional_application_write",
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: encodeURIComponent(
          token +
            "." +
            createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
              .update(token)
              .digest("base64"),
        ),
        url: process.env.TPA_TEST_URL!,
      },
    ]);
    return id;
  } finally {
    await db.end();
  }
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
}
async function contrast(locator: Locator, backgroundSelector: string) {
  return locator.evaluate((el, selector) => {
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const foreground = luminance(getComputedStyle(el).color);
    const background = luminance(
      getComputedStyle(el.closest(selector)!).backgroundColor,
    );
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    );
  }, backgroundSelector);
}
async function contact(page: Page) {
  await page.goto("/member/application");
  await page
    .getByRole("button", { name: "3. Contact & preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Contact & preferences", exact: true }),
  ).toBeVisible();
}
async function mockDraftWrites(page: Page) {
  await page.route("**/api/member/application", async (route) => {
    if (route.request().method() === "POST") {
      const draft = route.request().postDataJSON();
      await route.fulfill({ json: { ...draft, version: draft.version + 1 } });
    } else await route.continue();
  });
}
const choices = {
  states: ["Bihar", "West Bengal"],
  districts: ["Patna"],
  cities: ["Patna"],
  localities: [
    { state: "Bihar", district: "Patna", locality: "G.P.O.", pin: "800001" },
    { state: "Bihar", district: "Patna", locality: "Bankipore", pin: "800001" },
  ],
  exactLocation: false,
};

test("profile uses full-size private preview, protects privacy, saves and retries", async ({
  page,
  context,
}, info) => {
  await member(context);
  await page.goto("/account/profile");
  await expect(
    page.getByRole("heading", { name: "Professional identity", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Professional title", { exact: false })
    .fill("Chartered Accountant");
  await page
    .getByLabel("Designation / job title", { exact: false })
    .fill("Partner");
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(
    page.getByText("Draft saved privately. It is not verified.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Professional title", { exact: false }),
  ).toHaveValue("Chartered Accountant");
  if (page.viewportSize()!.width <= 1100)
    await page.getByRole("tab", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", {
    name: "Profile preview",
    exact: true,
  });
  await expect(
    preview.getByText("Chartered Accountant", { exact: false }),
  ).toBeVisible();
  await expect(preview).not.toContainText("@example.invalid");
  await expect(preview.locator("iframe")).toHaveCount(0);
  await preview
    .getByRole("button", { name: "Published profile", exact: true })
    .click();
  await expect(
    preview.getByText("No public profile yet", { exact: true }),
  ).toBeVisible();
  if (page.viewportSize()!.width <= 1100)
    await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.route("**/api/member/profile", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((r) => setTimeout(r, 200));
      await route.fulfill({
        status: 503,
        json: { error: "Profile service unavailable. Please retry." },
      });
    } else await route.continue();
  });
  await page
    .getByLabel("Professional title", { exact: false })
    .fill("Tax adviser");
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("The service is temporarily unavailable. Before resubmitting a change, check whether it was saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByText("The service is temporarily unavailable. Before resubmitting a change, check whether it was saved.", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("profile-save-error.png") });
  await page.unroute("**/api/member/profile");
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(
    page.getByText("Draft saved privately. It is not verified.", {
      exact: true,
    }),
  ).toBeVisible();
  await noOverflow(page);
});

test("address cascading resets descendants, resolves ambiguous PIN and supports international entry", async ({
  page,
  context,
}) => {
  await member(context);
  await mockDraftWrites(page);
  await page.route("**/api/member/locations?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill({
      json:
        params.get("pin") === "999999"
          ? { ...choices, localities: [] }
          : params.get("state") === "West Bengal"
            ? {
                ...choices,
                districts: ["Kolkata"],
                cities: ["Kolkata"],
                localities: [],
              }
            : choices,
    });
  });
  await contact(page);
  const office = page.getByRole("region", {
    name: "Office address",
    exact: true,
  });
  await office
    .getByRole("combobox", { name: "State / Union Territory", exact: true })
    .selectOption("Bihar");
  await office
    .getByRole("combobox", { name: "District", exact: true })
    .selectOption("Patna");
  await office
    .getByRole("combobox", { name: "Postal locality", exact: true })
    .selectOption("Bankipore");
  await office.getByLabel("PIN", { exact: true }).fill("800001");
  await office
    .getByRole("button", { name: "Fill from PIN", exact: true })
    .click();
  await expect(
    office.getByRole("combobox", {
      name: "Postal locality for this PIN",
      exact: true,
    }),
  ).toBeVisible();
  await office
    .getByRole("combobox", {
      name: "Postal locality for this PIN",
      exact: true,
    })
    .selectOption("1");
  await expect(
    office.getByRole("combobox", { name: "Postal locality", exact: true }),
  ).toHaveValue("Bankipore");
  await office
    .getByRole("combobox", { name: "State / Union Territory", exact: true })
    .selectOption("West Bengal");
  await expect(
    office.getByRole("combobox", { name: "District", exact: true }),
  ).toHaveValue("");
  await expect(
    office.getByRole("combobox", { name: "Postal locality", exact: true }),
  ).toHaveValue("");
  await expect(office.getByLabel("PIN", { exact: true })).toHaveValue("");
  await expect(
    office
      .getByRole("combobox", { name: "District", exact: true })
      .locator("option"),
  ).not.toContainText(["Patna"]);
  await office
    .getByRole("combobox", { name: "District", exact: true })
    .selectOption("Kolkata");
  await expect(
    office.getByRole("combobox", { name: "Postal locality", exact: true }),
  ).toContainText("No matching locations");
  await office.getByLabel("PIN", { exact: true }).fill("999999");
  await office
    .getByRole("button", { name: "Fill from PIN", exact: true })
    .click();
  await expect(
    office.getByText(
      "No postal locality found for this PIN. Check the number and try again.",
      { exact: true },
    ),
  ).toBeVisible();
  await office
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("GB");
  await office.getByLabel("State / region", { exact: true }).fill("England");
  await office.getByLabel("City / locality", { exact: true }).fill("London");
  await office.getByLabel("Postal code", { exact: true }).fill("SW1A 1AA");
  await office
    .getByLabel("Address Line 1", { exact: true })
    .fill("10 Test Street");
  await expect(
    office.getByRole("button", { name: "Fill from PIN", exact: true }),
  ).toHaveCount(0);
  await noOverflow(page);
});

test("lookup failure can retry; a late PIN response cannot overwrite a changed country", async ({
  page,
  context,
}) => {
  await member(context);
  await mockDraftWrites(page);
  let unavailable = true;
  await page.route("**/api/member/locations?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("pin")) {
      await new Promise((r) => setTimeout(r, 700));
      await route.fulfill({ json: choices }).catch(() => {});
    } else
      await route.fulfill(
        unavailable
          ? { status: 503, json: { error: "Postal lookup unavailable" } }
          : { json: choices },
      );
  });
  await contact(page);
  const office = page.getByRole("region", {
    name: "Office address",
    exact: true,
  });
  await expect(office.getByRole("alert")).toContainText(
    "Postal lookup unavailable",
  );
  unavailable = false;
  await office.getByRole("button", { name: "Retry location lookup" }).click();
  await expect(
    office.getByRole("combobox", {
      name: "State / Union Territory",
      exact: true,
    }),
  ).toBeEnabled();
  await office
    .getByLabel("Address Line 1", { exact: true })
    .fill("Retained address text");
  await office.getByLabel("PIN", { exact: true }).fill("800001");
  await office
    .getByRole("button", { name: "Fill from PIN", exact: true })
    .click();
  await office
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("GB");
  await page.waitForTimeout(900);
  await expect(
    office.getByRole("combobox", { name: "Country", exact: true }),
  ).toHaveValue("GB");
  await expect(
    office.getByLabel("Address Line 1", { exact: true }),
  ).toHaveValue("Retained address text");
  await expect(
    office.getByText("This PIN serves multiple postal localities.", {
      exact: false,
    }),
  ).toHaveCount(0);
});

test("legacy Student draft becomes Professional without erasing saved evidence", async ({
  page,
  context,
}) => {
  await member(context, true);
  await page.goto("/member/application");
  await expect(
    page.getByText(
      "Your previous Student draft is now a professional application.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Applicant category", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "1. Membership & professional details",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await (await context.request.get("/api/member/application")).json())
          .category,
    )
    .toBe("Professional");
  const saved = await context.request.get("/api/member/application");
  expect((await saved.json()).details.studentEvidence).toMatch(
    /^[0-9a-f-]{36}$/,
  );
});

test("password requirements validate before submission and header remains visible", async ({
  page,
  context,
}, info) => {
  await page.goto("/signup");
  const password = page.getByLabel("Password", { exact: false });
  await password.fill("12345");
  await expect(
    page.getByText("Use at least 6 characters.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("password-minimum-error.png"),
  });
  await password.fill("123456");
  await expect(
    page.getByText("Password length meets the requirement.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const header = page.locator("header.site-header");
  expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await noOverflow(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await noOverflow(page);
  const menu = page.locator(".mobile-nav > summary");
  await menu.focus();
  await menu.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Mobile", exact: true }),
  ).toBeVisible();
  await menu.press("Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest(".mobile-nav")),
  ).toBeTruthy();
  await page.screenshot({ path: info.outputPath("public-menu-320.png") });
  await menu.focus();
  await menu.press("Enter");
  await member(context);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Account menu", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("public-header-authenticated-320.png"),
  });
});

test("real postal reference persists a structured address and legacy text", async ({
  page,
  context,
}) => {
  await member(context);
  await contact(page);
  const residence = page.getByRole("region", {
    name: "Residential address",
    exact: true,
  });
  const lookup = await context.request.get("/api/member/locations?pin=700001");
  expect(lookup.ok()).toBeTruthy();
  const result = await lookup.json();
  expect(result.localities.length).toBeGreaterThan(0);
  await residence.getByLabel("PIN", { exact: true }).fill("700001");
  await residence
    .getByRole("button", { name: "Fill from PIN", exact: true })
    .click();
  if (result.localities.length > 1)
    await residence
      .getByRole("combobox", {
        name: "Postal locality for this PIN",
        exact: true,
      })
      .selectOption("0");
  await residence
    .getByLabel("Address Line 1", { exact: true })
    .fill("24 Synthetic Member Lane");
  await page.getByRole("button", { name: "Save now", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const saved = await (
    await context.request.get("/api/member/application")
  ).json();
  const address = JSON.parse(saved.details.residenceAddressStructured);
  expect(address.postalCode).toBe("700001");
  expect(address.postalLocality).toBe(result.localities[0].locality);
  expect(saved.details.residenceAddress).toContain("24 Synthetic Member Lane");
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Residential address", exact: true })
      .getByLabel("Address Line 1", { exact: true }),
  ).toHaveValue("24 Synthetic Member Lane");
});

test("completed professional application submits for review without publication", async ({
  page,
  context,
}) => {
  const id = await member(context),
    db = new Pool(databaseOptions());
  const photograph = randomUUID(),
    certificate = randomUUID();
  try {
    await db.query(
      "INSERT INTO tpa.private_documents(id,owner_user_id,kind,content_type,byte_size) VALUES($1,$2,'photograph','image/png',10),($3,$2,'certificate','application/pdf',10)",
      [photograph, id, certificate],
    );
  } finally {
    await db.end();
  }
  const details = {
    fullName: "Ananya Mukherjee",
    phone: "+919876543210",
    qualification: "CA",
    professionalStatus: "In Practice",
    professionalBody: "None",
    organization: "Synthetic Firm",
    correspondenceAddress: "Residence",
    residenceAddress: "24 Synthetic Member Lane, Kolkata",
    photograph,
    certificate,
    declaration: "true",
    signature: "Ananya Mukherjee",
  };
  expect(missingFields(initialFields, details, "Professional", true)).toEqual(
    [],
  );
  const saved = await context.request.post("/api/member/application", {
    data: {
      version: 0,
      plan: "Annual",
      category: "Professional",
      details,
      documentIds: [photograph, certificate],
      step: 4,
    },
    headers: { Origin: process.env.TPA_TEST_URL! },
  });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  await page.goto("/member/application");
  await page.route("**/api/member/verification", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({
        status: 503,
        json: { error: "Verification service unavailable. Please retry." },
      });
    } else await route.continue();
  });
  const submit = page.getByRole("button", {
    name: "Submit for profile verification",
    exact: true,
  });
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(
    page.getByText("The service is temporarily unavailable. Before resubmitting a change, check whether it was saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/member/verification");
  await page
    .getByRole("button", {
      name: "Submit for profile verification",
      exact: true,
    })
    .click();
  const confirmation = page.getByRole("dialog", {
    name: "Profile submitted successfully",
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "View submitted details" }).click();
  await expect(page.getByRole("heading", { name: "Your submitted profile" })).toBeVisible();
  await expect(page.locator(".verification-summary-section").getByText("Ananya Mukherjee", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".member-form-card")).toBeHidden();
  const profile = await (
    await context.request.get("/api/member/profile")
  ).json();
  expect(profile.person.published).toBeNull();
});

test("responsive visual evidence includes light, dark, long fields and zoom", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "desktop", "Viewport matrix runs once.");
  await member(context);
  await page.goto("/account/profile");
  await page
    .getByLabel("Professional title", { exact: false })
    .fill(
      "Chartered Accountant · International taxation and financial reporting",
    );
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width >= 1280) {
      const main = (await page.locator("main").boundingBox())!;
      const editor = (await page.locator(".member-profile-editor").boundingBox())!;
      expect(editor.width).toBeGreaterThan(main.width - 100);
      expect(editor.x).toBeGreaterThanOrEqual(main.x);
      expect(editor.x + editor.width).toBeLessThanOrEqual(main.x + main.width + 1);
    }
    for (const mode of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: mode as "light" | "dark" });
      await page.evaluate(() => scrollTo(0, 0));
      await noOverflow(page);
      await page.screenshot({
        path: info.outputPath(`profile-${width}-${mode}-viewport.png`),
      });
      await page.screenshot({
        path: info.outputPath(`profile-${width}-${mode}.png`),
        fullPage: true,
      });
      if (width <= 1100)
        await page.getByRole("tab", { name: "Preview", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 0));
      const previewContrast = await contrast(
        page.locator(".member-profile-preview .person-profession"),
        ".member-profile-preview",
      );
      expect(previewContrast).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({
        path: info.outputPath(`preview-${width}-${mode}.png`),
        fullPage: true,
      });
      if (width <= 1100)
        await page.getByRole("tab", { name: "Edit", exact: true }).click();
      await page.evaluate(() => scrollTo(0, 500));
      await expect(page.locator(".portal-topbar")).toHaveClass(/is-scrolled/);
      expect((await page.locator(".portal-topbar").boundingBox())!.y).toBe(0);
      if (width <= 600)
        expect(
          (await page.locator(".portal-topbar").boundingBox())!.height,
        ).toBeLessThanOrEqual(140);
      await page.evaluate(() => scrollTo(0, 0));
    }
  }
  await page.setViewportSize({ width: 640, height: 500 });
  await page.evaluate(() => scrollTo(0, 0));
  const menu = page.getByRole("button", { name: /Member navigation/ });
  await menu.focus();
  await menu.press("Enter");
  await expect(
    page.getByRole("link", { name: "Security", exact: true }),
  ).toBeVisible();
  await menu.press("Tab");
  await expect(
    page.getByRole("link", { name: "Overview", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Account navigation" })).toBeHidden();
  await expect(menu).toBeFocused();
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("profile-200-percent.png"),
    fullPage: true,
  });
  await page.evaluate(() => (document.documentElement.style.zoom = "1"));
  await contact(page);
  const residence = page.getByRole("region", {
    name: "Residential address",
    exact: true,
  });
  await residence
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption("GB");
  await residence
    .getByLabel("Address Line 1", { exact: true })
    .fill(
      "A long correspondence address retained during validation and postal lookup failures",
    );
  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: mode });
      await page.evaluate(() => scrollTo(0, 0));
      await noOverflow(page);
      await page.screenshot({
        path: info.outputPath(`verification-${width}-${mode}-viewport.png`),
      });
      await page.screenshot({
        path: info.outputPath(`verification-${width}-${mode}.png`),
        fullPage: true,
      });
    }
  }
  await page
    .getByRole("button", { name: "5. Review & declaration", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Submit for profile verification",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    await contrast(
      page.locator(".member-form-card .text-button").first(),
      ".member-form-card",
    ),
  ).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({
    path: info.outputPath("verification-errors-320.png"),
    fullPage: true,
  });
  await noOverflow(page);
});

test("published preview retains its snapshot and keyboard preview tabs work", async ({
  page,
  context,
}) => {
  const userId = await member(context);
  const original = await (
    await context.request.get("/api/member/profile")
  ).json();
  const db = new Pool(databaseOptions());
  try {
    const published = {
      ...original.person.draft,
      profession: "Published professional identity",
      phone: "+919876543210",
      links: [
        {
          platform: "Website",
          label: "Private portfolio",
          url: "https://example.invalid/private",
          public: false,
        },
        {
          platform: "Website",
          label: "Public portfolio",
          url: "https://example.invalid/public",
          public: true,
        },
      ],
    };
    await db.query(
      "UPDATE tpa.people SET published=$1,accepted_verified=true WHERE user_id=$2",
      [published, userId],
    );
  } finally {
    await db.end();
  }
  await page.goto("/account/profile");
  await page
    .getByLabel("Professional title", { exact: false })
    .fill("Unpublished draft identity");
  if (page.viewportSize()!.width <= 1100) {
    const edit = page.getByRole("tab", { name: "Edit", exact: true });
    await edit.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Preview", exact: true }),
    ).toBeFocused();
  }
  const preview = page.getByRole("region", {
    name: "Profile preview",
    exact: true,
  });
  await expect(preview).toContainText("Unpublished draft identity");
  await preview
    .getByRole("button", { name: "Published profile", exact: true })
    .click();
  await expect(preview).toContainText("Published professional identity");
  await expect(preview).not.toContainText("Unpublished draft identity");
  await expect(preview).not.toContainText("+919876543210");
  await expect(
    preview.getByRole("link", { name: "Ananya Mukherjee: Private portfolio" }),
  ).toHaveCount(0);
  await expect(
    preview.getByRole("link", { name: "Ananya Mukherjee: Public portfolio" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(
    (await page.locator(".portal-topbar").boundingBox())!.y,
  ).toBeGreaterThanOrEqual(0);
});
