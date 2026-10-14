import type { ReactNode } from "react";
import { homeDefaults } from "@/domain/website-home";
import Link from "next/link";
import { PublicInquiry } from "@/components/public-inquiry";

export function HomeView({
  home,
  media,
  readOnly = false,
  brandMark = "tpa·",
}: {
  home: typeof homeDefaults;
  media?: ReactNode;
  readOnly?: boolean;
  brandMark?: string;
}) {
  return (
    <main id="main">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="gold-dot" />
            {home.copy.eyebrow01}
          </div>
          <h1>
            {home.copy.heroCopy02}
            <br />
            {home.copy.heroCopy03}
            <br />
            <em>{home.copy.heroCopy04}</em>
          </h1>
          <p>{home.copy.heroCopy05}</p>
          <div className="button-row">
            <Link className="button" href={home.links.button01Href}>
              {home.copy.button06}
              <span>→</span>
            </Link>
            <Link className="text-link" href={home.links.textLink02Href}>
              {home.copy.textLink07}
            </Link>
          </div>
          <div className="hero-note">
            <span className="line" />
            {home.copy.heroNote08}
          </div>
        </div>
        <aside className="community-guide" aria-label="Explore TPA">
          <div className="guide-heading">
            <span className="eyebrow">{home.copy.eyebrow09}</span>
            <span className="guide-mark" aria-hidden="true">
              {brandMark}
            </span>
          </div>
          <h2>
            {home.copy.communityGuide11}
            <br />
            {home.copy.communityGuide12}
          </h2>
          <p>{home.copy.communityGuide13}</p>
          <div className="guide-links">
            <Link href={home.links.guideLinks03Href}>
              <span className="guide-number">{home.copy.guideNumber14}</span>
              <span>
                <strong>{home.copy.guideLinks15}</strong>
                <small>{home.copy.guideLinks16}</small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href={home.links.guideLinks04Href}>
              <span className="guide-number">{home.copy.guideNumber17}</span>
              <span>
                <strong>{home.copy.guideLinks18}</strong>
                <small>{home.copy.guideLinks19}</small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link href={home.links.guideLinks05Href}>
              <span className="guide-number">{home.copy.guideNumber20}</span>
              <span>
                <strong>{home.copy.guideLinks21}</strong>
                <small>{home.copy.guideLinks22}</small>
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="guide-location">
            <span aria-hidden="true">◎</span>
            {home.copy.guideLocation23} <span>{home.copy.guideLocation24}</span>
          </div>
        </aside>
      </section>
      <div className="values-strip">
        <span>{home.copy.valuesStrip25}</span>
        <strong>{home.copy.valuesStrip26}</strong>
        <i>✦</i>
        <strong>{home.copy.valuesStrip27}</strong>
        <i>✦</i>
        <strong>{home.copy.valuesStrip28}</strong>
        <i>✦</i>
        <strong>{home.copy.valuesStrip29}</strong>
        <i>✦</i>
        <strong>{home.copy.valuesStrip30}</strong>
      </div>
      <section className="section intro">
        <div>
          <span className="eyebrow">{home.copy.eyebrow31}</span>
          <h2>
            {home.copy.section32}
            <br />
            {home.copy.section33}
          </h2>
        </div>
        <div>
          <p>{home.copy.section34}</p>
          <Link href={home.links.textLink06Href} className="text-link">
            {home.copy.textLink35}
            <span>→</span>
          </Link>
        </div>
      </section>
      <section className="section opportunities">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{home.copy.eyebrow36}</span>
            <h2>{home.copy.sectionHeading37}</h2>
          </div>
          <Link className="text-link" href={home.links.textLink07Href}>
            {home.copy.textLink38}
          </Link>
        </div>
        <div className="editorial-grid">
          {home.cards.map((item, index) => (
            <article key={index}>
              <div className="article-top">
                <span>{item.n}</span>
                <span className="article-symbol">{item.symbol}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <Link className="text-link" href={item.link}>
                {item.cta} <span>→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="membership-callout">
        <div>
          <span className="eyebrow">{home.copy.eyebrow39}</span>
          <h2>{home.copy.membershipCallout40}</h2>
          <p>
            {home.copy.membershipCallout41}
            <br />
            {home.copy.membershipCallout42}
          </p>
        </div>
        <Link className="button gold" href={home.links.button08Href}>
          {home.copy.button43}
          <span>→</span>
        </Link>
      </section>
      <section className="section resource-row">
        <div>
          <span className="eyebrow">{home.copy.eyebrow44}</span>
          <h2>{home.copy.section45}</h2>
          <p>{home.copy.section46}</p>
        </div>
        <div>
          <Link href={home.links.section09Href}>
            {home.copy.section47}
            <span>↗</span>
          </Link>
          <Link href={home.links.section10Href}>
            {home.copy.section48}
            <span>↗</span>
          </Link>
          <Link href={home.links.section11Href}>
            {home.copy.section49}
            <span>↗</span>
          </Link>
        </div>
      </section>
      {media}
      <section className="section contact-intake" id="connect">
        <div>
          <span className="eyebrow">{home.copy.eyebrow50}</span>
          <h2>{home.copy.section51}</h2>
          <p>{home.copy.section52}</p>
        </div>
        {readOnly ? (
          <p>Inquiry form · submissions disabled in preview.</p>
        ) : (
          <PublicInquiry source="homepage" />
        )}
      </section>
    </main>
  );
}
