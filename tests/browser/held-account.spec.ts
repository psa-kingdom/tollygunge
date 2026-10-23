import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { databaseOptions } from "../../src/lib/database-options";
import { personBody } from "../../src/domain/people";
import { openMail } from "../../src/lib/onboarding-mail";
import {
  approvedAccountPolicy,
  approvedAccountSourceHash,
} from "../../src/domain/approved-account-batch";
test("held account is visible, activates only after release, and retains private profile", async ({
  page,
  context,
}, info) => {
  test.skip(
      !process.env.TPA_DATABASE_NAME?.startsWith("tpa_onboarding_test_"),
  );
  const db = new Pool(databaseOptions()),
    staff = randomUUID(),
    user = randomUUID(),
    person = randomUUID(),
    batch = randomUUID(),
    token = randomBytes(24).toString("hex"),
    email = user + "@example.invalid",
    origin = process.env.TPA_TEST_URL!;
  try {
    await db.query(
      "INSERT INTO public.\"user\"(id,name,email,\"emailVerified\") VALUES($1,'Held account administrator',$2,true),($3,'Held browser member',$4,false)",
      [staff, staff + "@example.invalid", user, email],
    );
    await db.query(
      "INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",
      [staff],
    );
    await db.query(
      'INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',
      [randomUUID(), token, staff],
    );
    await db.query(
      "INSERT INTO tpa.onboarding_batches(id,actor_id,rows,mode,choices) VALUES($1,$2,'[]','members','{}')",
      [batch, staff],
    );
    const body = personBody({
      name: "Held browser member",
      firstName: "Held",
      lastName: "browser member",
      email,
      addresses: {
        correspondence: {
          line1: "Original line",
          line2: "",
          country: "India",
          state: "",
          district: "",
          city: "Source locality",
          postalLocality: "",
          postalCode: "",
        },
      },
    });
    await db.query(
      "INSERT INTO tpa.people(id,user_id,accepted,draft,contact_email) VALUES($1,$2,$3,$3,$4)",
      [person, user, body, email],
    );
    await db.query(
      "INSERT INTO tpa.memberships(id,person_id,membership_number,source) VALUES($1,$2,$3,'import')",
      [randomUUID(), person, user],
    );
    await db.query(
      "INSERT INTO tpa.account_invitation_holds(user_id,source_batch_id) VALUES($1,$2)",
      [user, batch],
    );
    await db.query(
      "UPDATE tpa.onboarding_batches SET choices=$2,source_hash=$3,committed_at=now(),results=$4 WHERE id=$1",
      [
        batch,
        JSON.stringify(approvedAccountPolicy),
        approvedAccountSourceHash,
        JSON.stringify([
          {
            email,
            status: "created",
            accountId: user,
            invitationStatus: "held",
          },
        ]),
      ],
    );
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
        url: origin,
      },
    ]);
    const restored = await (
      await context.request.get(
        origin + "/api/staff/onboarding-import?id=" + batch,
      )
    ).json();
    expect(restored.mode).toBe("approved-accounts");
    expect(restored.results[0].emailStatus).toBe("held");
    await page.goto("/admin/workspaces/members");
    await page
      .getByRole("button", { name: `Held browser member · ${user} · Account linked`, exact: true })
      .click();
    const details = page.getByRole("region", { name: "Member details" });
    await expect(
      details.getByText("Required after activation", { exact: true }),
    ).toBeVisible();
    await expect(details.getByText(/invitation held/)).toBeVisible();
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM tpa.onboarding_invitations WHERE user_id=$1",
          [user],
        )
      ).rows[0].n,
    ).toBe(0);
    const noRelease = await context.request.post(
      origin + "/api/staff/member-actions",
      { headers: { origin }, data: { action: "resend", personId: person } },
    );
    expect(noRelease.status()).toBe(409);
    for (const path of ["request-password-reset", "send-verification-email"]) {
      expect(
        (
          await context.request.post(origin + "/api/auth/" + path, {
            headers: { origin },
            data: { email },
          })
        ).status(),
      ).toBe(200);
    }
    expect(
      (
        await db.query(
          'SELECT count(*)::int n FROM public."verification" WHERE value=$1',
          [user],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await db.query(
          "SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1",
          [user],
        )
      ).rows[0].n,
    ).toBe(0);
    await page.screenshot({
      path: info.outputPath("held-account-staff.png"),
      fullPage: true,
    });
    await page.goto('/admin/workspaces/communications?invitationTemplate=1');
    await page.getByLabel('Invitation subject',{exact:true}).fill('Reviewed member invitation '+info.project.name);
    await page.getByLabel('Invitation body',{exact:true}).fill('Hello {{member_name}},\n\n{{setup_link}}\n\nThis link expires in {{expiry}}.\n{{association_name}}');
    await page.getByRole('button',{name:'Save invitation draft',exact:true}).click();
    await expect(page.getByText('New draft saved. Invitation sending is blocked until approval.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'Preview invitation email',exact:true}).click();
    await expect(page.getByText('Preview only. No email sent.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'Approve invitation template',exact:true}).click();
    await expect(page.getByText('Template approved. No invitations were sent.',{exact:false})).toBeVisible();
    expect((await db.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1',[user])).rows[0].n).toBe(0);
    await page.goto('/admin');
    await page.getByRole('link',{name:/Invitations held/}).click();
    await expect(page.getByRole('combobox',{name:'Invitations',exact:true})).toHaveValue('held');
    await page.getByRole('button',{name:`Held browser member · ${user} · Account linked`,exact:true}).click();
    await page.getByRole('button',{name:'Review this member invitation',exact:true}).click();
    await page.getByRole('button',{name:'Review invitations for 1 selected members',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Invitation recipient review',exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:'Invitation recipient review',exact:true})).toBeVisible();
    await page.getByLabel('I verified the listed recipients and the approved email',{exact:true}).check();
    await page.getByRole('button',{name:'Confirm and send invitations',exact:true}).click();
    await expect
      .poll(
        async () =>
          (
            await db.query(
              "SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='invitation'",
              [user],
            )
          ).rows[0].n,
      )
      .toBe(1);
    await page.reload();
    await expect(page.getByText('1 invitations queued. Reopening this review does not send again.',{exact:true})).toBeVisible();
    expect((await db.query('SELECT count(*)::int n FROM tpa.onboarding_mail WHERE user_id=$1',[user])).rows[0].n).toBe(1);
    const payload = (
      await db.query(
        "SELECT payload FROM tpa.onboarding_mail WHERE user_id=$1 AND kind='invitation'",
        [user],
      )
    ).rows[0].payload;
    const link = openMail(payload)
      .text.split("\n")
      .find((line: string) => line.startsWith("http"))!;
    await context.clearCookies();
    await page.goto(link);
    await page
      .getByLabel("New password", { exact: true })
      .fill("Held!123456");
    await page
      .getByRole("button", { name: "Set password", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Account activated.", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Sign in to your account", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password", { exact: true })
      .fill("Held!123456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/member$/);
    await page.goto("/account/profile");
    await page
      .getByLabel("Professional title", { exact: false })
      .fill("Chartered Accountant");
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
    const current = (
      await db.query(
        "SELECT accepted_verified,published,accepted FROM tpa.people WHERE id=$1",
        [person],
      )
    ).rows[0];
    expect(current.accepted_verified).toBe(false);
    expect(current.published).toBeNull();
    expect(current.accepted.addresses.correspondence.district).toBe("");
    await page.goto("/member/application");
    await page
      .getByRole("button", { name: "3. Contact & preferences", exact: true })
      .click();
    const residence = page.getByRole("region", {
      name: "Residential address",
      exact: true,
    });
    await residence
      .getByRole("combobox", { name: "Country", exact: true })
      .selectOption("GB");
    await residence
      .getByLabel("Address Line 1", { exact: true })
      .fill("24 Synthetic Member Lane");
    await residence.getByLabel("Postal code", { exact: true }).fill("SW1A 1AA");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect
      .poll(
        async () =>
          JSON.parse(
            (
              await (
                await context.request.get(origin + "/api/member/application")
              ).json()
            ).details.residenceAddressStructured,
          ).line1,
      )
      .toBe("24 Synthetic Member Lane");
    await page.reload();
    await expect(
      page
        .getByRole("region", { name: "Residential address", exact: true })
        .getByLabel("Address Line 1", { exact: true }),
    ).toHaveValue("24 Synthetic Member Lane");
  } finally {
    await db.end();
  }
});
