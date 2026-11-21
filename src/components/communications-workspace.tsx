"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./operations-client";
import { CampaignWorkspace } from "./campaign-workspace";
import { EmailInbox } from "./email-inbox";
import { EmailDeliveries } from "./email-deliveries";
import { EmailTemplates } from "./email-templates";
import { InvitationTemplateEditor } from "./invitation-template-editor";
import { useEmailEditGuard } from "./email-edit-guard";
import { PortalIcon } from "./portal-icon";
import type { EmailTemplate } from "@/domain/communications-ui";
import styles from "./communications.module.css";
type View = "campaigns" | "inbox" | "templates" | "invitations" | "delivery";
const navigation: {
  id: View;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "campaigns",
    label: "Email campaigns",
    icon: "mail",
    description: "Create and manage emails to your community.",
  },
  {
    id: "inbox",
    label: "Inbox",
    icon: "message",
    description: "Read incoming messages and reply to conversations.",
  },
  {
    id: "templates",
    label: "Templates",
    icon: "file",
    description: "Reusable messages for your next email.",
  },
  {
    id: "delivery",
    label: "Delivery activity",
    icon: "chart",
    description: "Follow queued emails and delivery outcomes.",
  },
  {
    id: "invitations",
    label: "Member invitations",
    icon: "people",
    description: "Prepare and approve the account invitation email.",
  },
];
export function CommunicationsWorkspace({
  canManageInvitations = false,
  localPreview = false,
}: {
  canManageInvitations?: boolean;
  localPreview?: boolean;
}) {
  const [view, setView] = useState<View>("campaigns"),
    [dirty, setDirty] = useState(false),
    [creating, setCreating] = useState(false),
    [campaignId, setCampaignId] = useState<string>(),
    [template, setTemplate] = useState<EmailTemplate>(),
    [composerKey, setComposerKey] = useState(0);
  const [setup, setSetup] = useState<{
      deliveryEnabled: boolean;
      recoveryEnabled: boolean;
    }>(),
    [error, setError] = useState("");
  const guard = useEmailEditGuard(dirty);
  async function loadSetup() {
    try {
      setSetup(await api("/api/staff/communications"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void api<{ deliveryEnabled: boolean; recoveryEnabled: boolean }>(
      "/api/staff/communications",
    )
      .then(setSetup)
      .catch((e) => setError(e.message));
    const params = new URLSearchParams(location.search);
    queueMicrotask(() => {
      if (params.has("conversation")) setView("inbox");
      else if (params.has("template")) setView("templates");
      else if (params.has("invitationTemplate") && canManageInvitations)
        setView("invitations");
      else if (params.has("campaign")) {
        setView("campaigns");
        setCampaignId(params.get("campaign")!);
      }
    });
  }, [canManageInvitations]);
  function navigate(next: View) {
    guard.proceed(() => {
      setView(next);
      setDirty(false);
      setCreating(false);
      setCampaignId(undefined);
      setTemplate(undefined);
    });
  }
  function create(seed?: EmailTemplate) {
    guard.proceed(() => {
      setView("campaigns");
      setDirty(false);
      setCreating(true);
      setCampaignId(undefined);
      setTemplate(seed);
      setComposerKey((k) => k + 1);
    });
  }
  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeading}>
        <div>
          <h1>Communications</h1>
          <p>Keep your community informed, one clear message at a time.</p>
        </div>
        <button className="button gold" onClick={() => create()}>
          <span aria-hidden="true">＋</span> Create email
        </button>
      </header>
      {localPreview && (
        <p className={styles.environment}>
          <span className={styles.statusDot} />
          Local preview <span>Emails stay in this testing environment.</span>
        </p>
      )}
      {error && (
        <p role="alert" className={styles.notice}>
          {error}{" "}
          <button className="button secondary" onClick={() => void loadSetup()}>
            Retry setup check
          </button>
        </p>
      )}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav aria-label="Communication tools">
            {navigation
              .filter(
                (item) => item.id !== "invitations" || canManageInvitations,
              )
              .map((item, i) => (
                <div key={item.id}>
                  {i === 0 && <span className={styles.navGroup}>EMAIL</span>}
                  {item.id === "delivery" && (
                    <span className={styles.navGroup}>MANAGE</span>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    aria-current={view === item.id ? "page" : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <PortalIcon name={item.icon} />
                    {item.label}
                  </button>
                </div>
              ))}
          </nav>
          <div className={styles.sidebarLinks}>
            <Link href="/admin/workspaces/crm">
              <PortalIcon name="external" />
              Website inquiries
            </Link>
            {canManageInvitations && (
              <Link href="/admin/workspaces/onboarding-email">
                <PortalIcon name="shield" />
                Email settings
              </Link>
            )}
          </div>
          <div className={styles.sendingState}>
            <span className={styles.statusDot} />
            <strong>
              {localPreview
                ? "Local testing"
                : !setup
                  ? "Checking sending…"
                  : setup.deliveryEnabled
                    ? "Sending enabled"
                    : "Sending paused"}
            </strong>
            <p>
              {localPreview
                ? "Drafts and previews are available."
                : setup?.deliveryEnabled
                  ? "Review every email before sending."
                  : "You can prepare and save drafts."}
            </p>
            <button
              className="text-button"
              onClick={() => navigate("delivery")}
            >
              View sending details →
            </button>
          </div>
        </aside>
        <div className={styles.content}>
          {view === "campaigns" ? (
            <CampaignWorkspace
              key={`${composerKey}-${campaignId ?? ""}`}
              initialCreate={creating}
              initialId={campaignId}
              initialTemplate={template}
              onDirtyChange={setDirty}
              onDelivery={() => navigate("delivery")}
            />
          ) : view === "inbox" ? (
            <EmailInbox
              onDirtyChange={setDirty}
              sendingEnabled={setup?.deliveryEnabled === true}
            />
          ) : view === "templates" ? (
            <EmailTemplates onDirtyChange={setDirty} onUse={create} />
          ) : view === "delivery" ? (
            <EmailDeliveries />
          ) : (
            <div className={styles.invitationPanel}>
              <InvitationTemplateEditor onDirtyChange={setDirty} />
              <div className={styles.related}>
                <h3>Ready to invite members?</h3>
                <p>
                  Recipients are selected and reviewed from the member directory
                  after the invitation template is approved.
                </p>
                <Link
                  className="button secondary"
                  href="/admin/workspaces/members"
                >
                  Open member directory →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      {guard.dialog}
    </section>
  );
}
