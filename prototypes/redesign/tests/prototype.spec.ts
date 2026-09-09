import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

async function preview(page: Page) {
  const button = page.getByRole("button", { name: "Preview controls" });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
}
async function network(page: Page, value: string) {
  await preview(page);
  await page
    .getByRole("combobox", { name: "Connection", exact: true })
    .selectOption(value);
}
async function openClass(page: Page) {
  await page.goto("/class/bishopstown-turtles");
  await expect(
    page.getByRole("heading", { name: "Turtles", exact: true }),
  ).toBeVisible();
}
const status = (page: Page) =>
  page.getByRole("status", { name: "Save status" });

test("Reception search, empty result, enrolment, move and assessment retain context", async ({
  page,
}) => {
  await page.goto("/reception");
  await page
    .getByRole("searchbox", { name: "Find a swimmer" })
    .fill("nobodymatches");
  await expect(
    page.getByRole("heading", { name: "No swimmers found" }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a swimmer" }).fill("Ava");
  await page.getByRole("button", { name: /Ava Bennett.*LWB-DEMO/ }).click();
  await page
    .getByRole("button", { name: "Enrol in a class", exact: true })
    .click();
  await page
    .getByLabel("Choose a class", { exact: true })
    .selectOption("bishopstown-turtles-later");
  await page.getByRole("button", { name: "Confirm enrolment" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Swimmer workspace" })
      .getByText("2 places", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move Ava Bennett from Turtles at 16:00" })
    .click();
  await page
    .getByLabel("Choose a class", { exact: true })
    .selectOption("bishopstown-penguins");
  await page
    .getByLabel("Placement reason")
    .fill("A quieter group suits this swimmer.");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Move Ava Bennett from Penguins at 16:00",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Book assessment", exact: true })
    .click();
  await page
    .getByLabel("Assessment session", { exact: true })
    .selectOption("bishopstown-assessment-1");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Booked", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page
      .getByRole("tabpanel", { name: "History" })
      .getByText(/Ava Bennett booked/),
  ).toBeVisible();
});

test("failed forms keep entered values and a full-class move preserves the original place", async ({
  page,
}) => {
  await page.goto("/reception");
  await network(page, "failure");
  await page
    .getByRole("button", { name: "Move Ava Bennett from Turtles at 15:30" })
    .click();
  await page
    .getByLabel("Choose a class", { exact: true })
    .selectOption("bishopstown-turtles-later");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your choices are still here",
  );
  await expect(page.getByLabel("Choose a class", { exact: true })).toHaveValue(
    "bishopstown-turtles-later",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await network(page, "normal");
  await page
    .getByRole("button", { name: "Move Ava Bennett from Turtles at 15:30" })
    .click();
  await page
    .getByLabel("Choose a class", { exact: true })
    .selectOption("bishopstown-sharks");
  await page.getByLabel("Placement reason").fill("Review placement");
  await page.getByRole("button", { name: "Confirm move" }).click();
  await expect(page.getByRole("alert")).toContainText("now full");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Move Ava Bennett from Turtles at 15:30",
    }),
  ).toBeVisible();
});

test("autosave shares marks across views, preserves edits through navigation, and completes explicitly", async ({
  page,
}) => {
  await openClass(page);
  await expect(status(page)).toHaveText("Changes save automatically");
  await expect(
    page.getByRole("button", { name: "Done taking attendance" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Ava Bennett: Present", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Done taking attendance" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Competencies", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Choose competency" })
    .selectOption("travel");
  await page
    .getByRole("button", {
      name: "Ava Bennett, Swim five metres: achieved",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "By swimmer", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Ava Bennett, Swim five metres: achieved",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(status(page)).toHaveText("All changes saved");
  await page.getByRole("tab", { name: "Attendance", exact: true }).click();
  await page.getByRole("button", { name: "Done taking attendance" }).click();
  await expect(
    page.getByText("Attendance is complete", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ava Bennett: Late", exact: true })
    .click();
  await expect(
    page.getByText("Everyone checked?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Today’s classes", exact: true })
    .click();
  await expect(
    page
      .getByRole("link")
      .filter({ hasText: /Turtles/ })
      .last(),
  ).toBeVisible();
  await page.goto("/class/bishopstown-turtles");
  await expect(
    page.getByRole("button", { name: "Ava Bennett: Late", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("offline drafts survive reload and reconnect without pretending to be saved remotely", async ({
  page,
}) => {
  await openClass(page);
  await network(page, "offline");
  await page
    .getByRole("button", { name: "Ava Bennett: Present", exact: true })
    .click();
  await page
    .getByLabel("A note for this class")
    .fill("Practise breathing next time.");
  await expect(status(page)).toHaveText("Saved on this device");
  // The app shell remains online; preview connection settings and drafts are
  // durable, so reloading must not silently restore the simulated connection.
  await page.reload();
  await expect(page.getByLabel("A note for this class")).toHaveValue(
    "Practise breathing next time.",
  );
  await expect(
    page.getByRole("button", { name: "Ava Bennett: Present", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(status(page)).toHaveText("Saved on this device");
  await network(page, "normal");
  await expect(status(page)).toHaveText("All changes saved");
});

test("conflict comparison retains the draft and replacement uses a new revision", async ({
  page,
}) => {
  await openClass(page);
  await preview(page);
  await page.getByRole("button", { name: "Simulate another edit" }).click();
  await page.getByLabel("A note for this class").fill("My class note");
  await expect(
    page.getByRole("region", { name: "Save conflict" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Save conflict" })
      .getByText("My class note", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep my changes" }).click();
  await expect(status(page)).toHaveText("All changes saved");
  await page.reload();
  await expect(page.getByLabel("A note for this class")).toHaveValue(
    "My class note",
  );
});

test("read-only mode blocks edits, club switching separates swimmers, dialog focus returns", async ({
  page,
}) => {
  await page.goto("/reception");
  const trigger = page.getByRole("button", {
    name: "Book assessment",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await preview(page);
  await page
    .getByRole("combobox", { name: "Permissions", exact: true })
    .selectOption("read");
  await expect(trigger).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Current club" })
    .filter({ visible: true })
    .selectOption("churchfield");
  await expect(
    page.getByRole("heading", { name: "Ruby Bennett", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ava Bennett", exact: true }),
  ).not.toBeVisible();
});

test("mobile views retain selection and filters, keyboard tabs work, and theme survives reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 930 });
  await page.goto("/reception");
  await page.getByRole("searchbox", { name: "Find a swimmer" }).fill("Leo");
  await page.getByRole("button", { name: /Leo Ellis.*LWB-DEMO/ }).click();
  await page
    .getByRole("button", { name: "Today’s classes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Places available", exact: true })
    .click();
  await page.getByRole("button", { name: "Swimmer", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Leo Ellis", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Progress" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tabpanel", { name: "Progress" })).toBeVisible();
  await page
    .getByRole("button", { name: "Today’s classes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Places available", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Full", { exact: true })).not.toBeVisible();
  await preview(page);
  await page
    .getByRole("combobox", { name: "Colour mode", exact: true })
    .selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("slow saves preserve a later edit and withdrawn permissions retain the unsaved draft", async ({
  page,
}) => {
  await openClass(page);
  await network(page, "slow");
  await page.getByLabel("A note for this class").fill("First version");
  await expect(status(page)).toHaveText("Saving changes…");
  await page.getByLabel("A note for this class").fill("Latest version");
  await expect(status(page)).toHaveText("All changes saved", {
    timeout: 10000,
  });
  await page.reload();
  await expect(page.getByLabel("A note for this class")).toHaveValue(
    "Latest version",
  );
  await page
    .getByLabel("A note for this class")
    .fill("Draft after permission changes");
  await expect(status(page)).toHaveText("Saving changes…");
  await preview(page);
  await page
    .getByRole("combobox", { name: "Permissions", exact: true })
    .selectOption("read");
  await expect(status(page)).toHaveText("Could not save yet");
  await page
    .getByRole("combobox", { name: "Connection", exact: true })
    .selectOption("normal");
  await page
    .getByRole("combobox", { name: "Permissions", exact: true })
    .selectOption("edit");
  await expect(status(page)).toHaveText("All changes saved");
  await page.reload();
  await expect(page.getByLabel("A note for this class")).toHaveValue(
    "Draft after permission changes",
  );
});

test("cover and level completion require explicit confirmation", async ({
  page,
}) => {
  await page.goto("/class/bishopstown-dolphins");
  await expect(
    page.getByRole("button", { name: "Everyone present" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "I’m covering this class" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(status(page)).toHaveText("All changes saved");
  await expect(
    page.getByRole("button", { name: "Everyone present" }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByText("Covering today", { exact: true })).toBeVisible();
  await openClass(page);
  await page.getByRole("tab", { name: "Competencies", exact: true }).click();
  await page.getByRole("button", { name: "By swimmer", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ava Bennett, Swim five metres: achieved",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirm level", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Level confirmed", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Confirm level", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Level confirmed", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Confirm level", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(status(page)).toHaveText("All changes saved");
  await expect(
    page.getByText("Level confirmed", { exact: true }),
  ).toBeVisible();
});

async function checkTouchTargets(page: Page) {
  const small = await page
    .locator(
      'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="tab"]',
    )
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.checkVisibility() &&
            !element.classList.contains("skip-link"),
        )
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            label:
              element.getAttribute("aria-label") ||
              element.textContent?.trim().slice(0, 70),
            width: rect.width,
            height: rect.height,
          };
        })
        .filter((rect) => rect.width < 43.9 || rect.height < 43.9),
    );
  expect(small).toEqual([]);
}

for (const width of [375, 768, 1024, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`layout and accessibility: ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await mkdir("captures", { recursive: true });
      for (const route of ["reception", "today", "class/bishopstown-turtles"]) {
        await page.goto(`/${route}`);
        await expect(page.locator("h1")).toBeVisible();
        const overflowing = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflowing, `${route} must fit ${width}px`).toBe(false);
        await checkTouchTargets(page);
        const accessibility = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          accessibility.violations.map(
            (row) =>
              `${row.id}: ${row.nodes.map((node) => node.target.join(" ")).join(", ")}`,
          ),
        ).toEqual([]);
        if (route === "reception" || width === 375 || width === 1280)
          await page.screenshot({
            path: `captures/${route.split("/")[0]}-${width}-${theme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        if (route.startsWith("class/")) {
          await page
            .getByRole("tab", { name: "Competencies", exact: true })
            .click();
          await checkTouchTargets(page);
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth > window.innerWidth + 1,
            ),
          ).toBe(false);
          await page
            .getByRole("button", { name: "By swimmer", exact: true })
            .click();
          await checkTouchTargets(page);
          if (width === 375 || width === 1280)
            await page.screenshot({
              path: `captures/competencies-${width}-${theme}.png`,
              fullPage: true,
              animations: "disabled",
            });
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
