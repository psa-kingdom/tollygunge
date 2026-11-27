import type { ReactNode } from "react";
import Image from "next/image";
import { homeDefaults } from "@/domain/website-home";
import Link from "./navigation-link";
import { PublicInquiry } from "./public-inquiry";
import { HomepageEventsView } from "./homepage-events-view";
import { HomepageMotion } from "./homepage-motion";
import motion from "./homepage-motion.module.css";

export function HomeView({
  home,
  events,
  upcomingEvent,
  readOnly = false,
}: {
  home: typeof homeDefaults;
  media?: ReactNode;
  events?: ReactNode;
  upcomingEvent?: { id: string; title: string };
  readOnly?: boolean;
  brandMark?: string;
}) {
  return (
    <main id="main" className={`premium-home paper-v3-home ${motion.root}`}>
      {!readOnly && (
        <noscript>
          <style>
            {
              "body:has(.paper-v3-home) .no-script-notice,.paper-v3-home .public-inquiry,.paper-v3-home .newsletter-form{display:none!important}"
            }
          </style>
        </noscript>
      )}
      <HomepageMotion disabled={readOnly} />
      <section className={upcomingEvent ? `hero ${motion.heroWithRibbon}` : "hero"}>
        {upcomingEvent && (
          <Link className={motion.eventRibbon} href={`/events/${upcomingEvent.id}`}>
            <strong>Upcoming event</strong>
            <span>{upcomingEvent.title}</span>

          </Link>
        )}
        <div className="hero-copy">
          <div
            className="eyebrow"
            data-cms-field={readOnly ? "copy.eyebrow01" : undefined}
          >
            <span className="gold-dot" />
            {home.copy.eyebrow01}
          </div>
          <h1>
            <span data-cms-field={readOnly ? "copy.heroCopy02" : undefined}>
              {home.copy.heroCopy02}
            </span>
            <em data-cms-field={readOnly ? "copy.heroCopy03" : undefined}>
              {home.copy.heroCopy03}
            </em>
            <span data-cms-field={readOnly ? "copy.heroCopy04" : undefined}>
              {home.copy.heroCopy04}
            </span>
          </h1>
          <p>{home.copy.heroCopy05}</p>
          <div className="button-row">
            <Link className="button" href={home.links.button01Href}>
              {home.copy.button06.replace(/[→↗←↓]/g, "").trim()}

            </Link>
            <Link className="button secondary" href={home.links.textLink02Href}>
              {home.copy.textLink07.replace(/[→↗←↓]/g, "").trim()}
            </Link>
          </div>
          <div
            className="hero-note"
            data-cms-field={readOnly ? "copy.heroNote08" : undefined}
          >
            {home.copy.heroNote08}
          </div>
        </div>
        {home.images?.heroMediaId && (
          <Image
            unoptimized
            src={`/media/${home.images.heroMediaId}`}
            alt={home.images.heroAlt}
            width={600}
            height={500}
            style={{
              width: "min(42%,600px)",
              height: "auto",
              objectFit: "contain",
              marginLeft: 32,
            }}
          />
        )}
      </section>
      <div className="values-strip" aria-label="Our values">
        {[
          home.copy.valuesStrip26,
          home.copy.valuesStrip27,
          home.copy.valuesStrip28,
          home.copy.valuesStrip29,
          home.copy.valuesStrip30,
        ].map((value, index) => (
          <span className="v3-value" key={index}>
            <strong>{value}</strong>
            {index < 4 && <i aria-hidden="true">✦</i>}
          </span>
        ))}
      </div>
      <section className="section v3-about">
        <div className="intro">
          <div>
            <span className="eyebrow">{home.copy.eyebrow31}</span>
            <h2>
              <span data-cms-field={readOnly ? "copy.section32" : undefined}>
                {home.copy.section32}
              </span>
              <br />
              <em>{home.copy.section33}</em>
            </h2>
          </div>
          <div>
            <p>{home.copy.section34}</p>
            <Link href={home.links.textLink06Href} className="text-link">
              {home.copy.textLink35.replace(/[→↗←↓]/g, "").trim()}

            </Link>
          </div>
        </div>
        <div className="editorial-grid">
          {home.cards.map((item, index) => (
            <article key={index}>
              <div className="article-top">
                <span className="article-symbol" aria-hidden="true">
                  {item.symbol.replace(/[→↗←↓]/g, "").trim()}
                </span>
                <span
                  data-cms-field={readOnly ? `cards.${index}.n` : undefined}
                >
                  {item.n}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <Link className="text-link" href={item.link}>
                {item.cta}

              </Link>
            </article>
          ))}
        </div>
      </section>
      {events ?? (
        <HomepageEventsView
          events={[]}
          heading={home.copy.sectionHeading37}
          copy={home.eventContent}
          newsletter={home.newsletterContent}
          readOnly={readOnly}
        />
      )}
      <section
        className="v3-membership"
        aria-labelledby="home-membership-title"
      >
        <div className="v3-section-inner">
          <div className="v3-membership-heading">
            <span className="eyebrow">{home.copy.eyebrow39}</span>
            <h2 id="home-membership-title">
              <span
                data-cms-field={
                  readOnly ? "copy.membershipCallout40" : undefined
                }
              >
                {home.copy.membershipCallout40}
              </span>
              <br />
              <em
                data-cms-field={
                  readOnly ? "membershipContent.emphasis" : undefined
                }
              >
                {
                  (home.membershipContent ?? homeDefaults.membershipContent)
                    .emphasis
                }
              </em>
            </h2>
            <p>
              <span
                data-cms-field={
                  readOnly ? "copy.membershipCallout41" : undefined
                }
              >
                {home.copy.membershipCallout41}
              </span>
              <br />
              <span
                data-cms-field={
                  readOnly ? "copy.membershipCallout42" : undefined
                }
              >
                {home.copy.membershipCallout42}
              </span>
            </p>
          </div>
          <div className="v3-membership-grid">
            {(
              home.membershipContent ?? homeDefaults.membershipContent
            ).plans.map((plan, index) => (
              <article
                key={index}
                className={index === 1 ? "v3-membership-featured" : undefined}
              >
                <span className="eyebrow">{plan.label}</span>
                <h3>{plan.title}</h3>
                <p>{plan.description}</p>
                <ul>
                  {plan.benefits.map((benefit, i) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
                <Link
                  data-cms-field={
                    readOnly
                      ? `membershipContent.plans.${index}.button`
                      : undefined
                  }
                  className={index === 1 ? "button gold" : "button secondary"}
                  href={
                    index === 1
                      ? home.links.button01Href
                      : home.links.button08Href
                  }
                >
                  {plan.button.replace(/[→↗←↓]/g, "").trim()}
                </Link>
              </article>
            ))}
          </div>
          <p className="v3-membership-note">
            {(home.membershipContent ?? homeDefaults.membershipContent).note}
          </p>
        </div>
      </section>
      <section className="section contact-intake" id="connect">
        <div className="v3-contact-copy">
          <span className="eyebrow">{home.copy.eyebrow50}</span>
          <h2 data-cms-field={readOnly ? "copy.section51" : undefined}>
            {home.copy.section51 === "Start a conversation." ? (
              <>
                Start a<br />
                <em>conversation.</em>
              </>
            ) : (
              home.copy.section51
            )}
          </h2>
          <p>{home.copy.section52}</p>
          <div className="v3-contact-resources">
            <span className="eyebrow">{home.copy.eyebrow44}</span>
            {[
              [home.links.section09Href, home.copy.section47],
              [home.links.section10Href, home.copy.section48],
              [home.links.section11Href, home.copy.section49],
            ].map(([href, label]) => (
              <Link key={href} href={href}>
                {label}

              </Link>
            ))}
          </div>
        </div>
        {!readOnly && (
          <noscript>
            <p className="home-static-note">
              <strong>Enable JavaScript for account features.</strong> You can
              browse TPA without JavaScript. Enable it to send an inquiry or
              subscribe to updates.
            </p>
          </noscript>
        )}
        {readOnly ? (
          <div className="inquiry-intake">
            <h3>Tell us what you have in mind.</h3>
            <p>Inquiry submissions are disabled in preview.</p>
          </div>
        ) : (
          <PublicInquiry source="homepage" compact />
        )}
      </section>
    </main>
  );
}
