import type { ReactNode } from "react";
import { homeDefaults } from "@/domain/website-home";
import Link from "./navigation-link";
import { PublicInquiry } from "./public-inquiry";
import { HomepageEventsView } from "./homepage-events-view";

export function HomeView({home,events,readOnly=false}: {home: typeof homeDefaults; media?: ReactNode; events?: ReactNode; readOnly?: boolean; brandMark?: string}) {
  return <main id="main" className="premium-home paper-v3-home">
    <section className="hero"><div className="hero-copy">
      <div className="eyebrow"><span className="gold-dot" />{home.copy.eyebrow01}</div>
      <h1><span>{home.copy.heroCopy02}</span><em>{home.copy.heroCopy03}</em><span>{home.copy.heroCopy04}</span></h1>
      <p>{home.copy.heroCopy05}</p>
      <div className="button-row"><Link className="button" href={home.links.button01Href}>{home.copy.button06}<span aria-hidden="true">→</span></Link><Link className="button secondary" href={home.links.textLink02Href}>{home.copy.textLink07}</Link></div>
      <div className="hero-note">{home.copy.heroNote08}</div>
    </div></section>
    <div className="values-strip" aria-label="Our values">{[home.copy.valuesStrip26,home.copy.valuesStrip27,home.copy.valuesStrip28,home.copy.valuesStrip29,home.copy.valuesStrip30].map((value,index)=><span className="v3-value" key={index}><strong>{value}</strong>{index<4&&<i aria-hidden="true">✦</i>}</span>)}</div>
    <section className="section v3-about">
      <div className="intro"><div><span className="eyebrow">{home.copy.eyebrow31}</span><h2>{home.copy.section32}<br /><em>{home.copy.section33}</em></h2></div><div><p>{home.copy.section34}</p><Link href={home.links.textLink06Href} className="text-link">{home.copy.textLink35}<span aria-hidden="true">→</span></Link></div></div>
      <div className="editorial-grid">{home.cards.map((item,index)=><article key={index}><div className="article-top"><span className="article-symbol" aria-hidden="true">{item.symbol}</span><span>{item.n}</span></div><h3>{item.title}</h3><p>{item.text}</p><Link className="text-link" href={item.link}>{item.cta}<span aria-hidden="true">↗</span></Link></article>)}</div>
    </section>
    {events ?? <HomepageEventsView events={[]} heading={home.copy.sectionHeading37} readOnly={readOnly} />}
    <section className="v3-membership" aria-labelledby="home-membership-title"><div className="v3-section-inner">
      <div className="v3-membership-heading"><span className="eyebrow">{home.copy.eyebrow39}</span><h2 id="home-membership-title">{home.copy.membershipCallout40}<br /><em>Bring your perspective.</em></h2><p>{home.copy.membershipCallout41}<br />{home.copy.membershipCallout42}</p></div>
      <div className="v3-membership-grid">
        <article><span className="eyebrow">NEWLY QUALIFIED</span><h3>Your next chapter<br />in the profession.</h3><p>For qualified CAs beginning their professional journey. Find peers, share questions, and keep learning.</p><ul><li>Professional learning</li><li>Conversations with peers</li><li>Community participation</li></ul><Link className="button secondary" href={home.links.button08Href}>Explore membership →</Link></article>
        <article className="v3-membership-featured"><span className="eyebrow">IN PRACTICE</span><h3>ACA & FCA<br />in practice.</h3><p>For practising chartered accountants and firm partners. Bring your experience to a community built on shared knowledge.</p><ul><li>Events and knowledge sharing</li><li>Professional connections</li><li>A place to contribute</li></ul><Link className="button gold" href={home.links.button01Href}>Become a member →</Link></article>
        <article><span className="eyebrow">IN INDUSTRY</span><h3>CAs in business<br />& finance.</h3><p>For qualified CAs working across business and industry. Stay close to the profession and bring a different perspective.</p><ul><li>Professional perspectives</li><li>Connections across practice areas</li><li>Community conversations</li></ul><Link className="button secondary" href={home.links.button08Href}>Explore membership →</Link></article>
      </div><p className="v3-membership-note">All applications follow TPA’s existing Professional membership rules and review process.</p>
    </div></section>
    <section className="section contact-intake" id="connect"><div className="v3-contact-copy"><span className="eyebrow">{home.copy.eyebrow50}</span><h2>{home.copy.section51 === "Start a conversation." ? <>Start a<br /><em>conversation.</em></> : home.copy.section51}</h2><p>{home.copy.section52}</p><div className="v3-contact-resources"><span className="eyebrow">{home.copy.eyebrow44}</span>{[[home.links.section09Href,home.copy.section47],[home.links.section10Href,home.copy.section48],[home.links.section11Href,home.copy.section49]].map(([href,label])=><Link key={href} href={href}>{label}<span aria-hidden="true">↗</span></Link>)}</div></div>
      {readOnly?<div className="inquiry-intake"><h3>Tell us what you have in mind.</h3><p>Inquiry submissions are disabled in preview.</p></div>:<PublicInquiry source="homepage" compact />}
    </section>
  </main>;
}
