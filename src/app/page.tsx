import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { PublicInquiry } from "@/components/public-inquiry";
export default function Home() {
  return (
    <SiteShell>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="gold-dot" /> ROOTED IN TOLLYGUNGE. OPEN TO
              POSSIBILITY.
            </div>
            <h1>
              Good people.
              <br />
              Shared knowledge.
              <br />
              <em>Greater possibilities.</em>
            </h1>
            <p>
              A professional community where experience meets new ideas. Connect
              with people who believe that progress is better when we make it
              together.
            </p>
            <div className="button-row">
              <Link className="button" href="/join">
                Find your place at TPA <span>→</span>
              </Link>
              <Link className="text-link" href="/about">
                Get to know us ↗
              </Link>
            </div>
            <div className="hero-note">
              <span className="line" /> For professionals, entrepreneurs & the
              next generation.
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Connection, learning and collaboration at TPA"
          >
            <div className="art-top">
              THE POWER OF COMING TOGETHER <span>01 / TPA</span>
            </div>
            <div className="connection-art">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <span className="orbit orbit-three" />
              <span className="art-core">
                tpa<span>·</span>
              </span>
              <span className="node node-one">Ideas</span>
              <span className="node node-two">People</span>
              <span className="node node-three">Possibility</span>
            </div>
            <div className="art-bottom">
              <span>
                Individual strengths.
                <br />
                <strong>Collective progress.</strong>
              </span>
              <span className="art-arrow">↗</span>
            </div>
          </div>
        </section>
        <div className="values-strip">
          <span>ONE COMMUNITY. MANY PERSPECTIVES.</span>
          <strong>Connect</strong>
          <i>✦</i>
          <strong>Learn</strong>
          <i>✦</i>
          <strong>Collaborate</strong>
          <i>✦</i>
          <strong>Grow</strong>
          <i>✦</i>
          <strong>Contribute</strong>
        </div>
        <section className="section intro">
          <div>
            <span className="eyebrow">A PLACE TO BELONG</span>
            <h2>
              Professional relationships.
              <br />
              With a human foundation.
            </h2>
          </div>
          <div>
            <p>
              TPA brings together professionals, business leaders and
              entrepreneurs from Tollygunge and beyond. Different disciplines.
              Shared curiosity. A belief in the value of showing up for one
              another.
            </p>
            <Link href="/about" className="text-link">
              Discover our purpose <span>→</span>
            </Link>
          </div>
        </section>
        <section className="section opportunities">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT BRINGS US TOGETHER</span>
              <h2>Make room for what comes next.</h2>
            </div>
            <Link className="text-link" href="/events">
              Explore events ↗
            </Link>
          </div>
          <div className="editorial-grid">
            {[
              {
                n: "01",
                title: "Learn from each other.",
                text: "Seminars, workshops and thoughtful conversations that turn knowledge into professional growth.",
                link: "/events",
                cta: "Events & learning",
                symbol: "↗",
              },
              {
                n: "02",
                title: "Build meaningful connections.",
                text: "Meet people across disciplines. Share perspectives, find collaborators and discover new possibilities.",
                link: "/membership",
                cta: "Our membership",
                symbol: "◎",
              },
              {
                n: "03",
                title: "Contribute something lasting.",
                text: "Bring your experience to initiatives that create value for the profession and the wider community.",
                link: "/about#section-1",
                cta: "Our vision & mission",
                symbol: "✳",
              },
            ].map((item) => (
              <article key={item.n}>
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
            <span className="eyebrow">YOUR NEXT CHAPTER</span>
            <h2>There’s a place for you here.</h2>
            <p>
              Established professional or just getting started—bring your
              perspective.
              <br />
              Choose a membership that fits your journey.
            </p>
          </div>
          <Link className="button gold" href="/membership">
            Explore membership <span>→</span>
          </Link>
        </section>
        <section className="section resource-row">
          <div>
            <span className="eyebrow">KNOWLEDGE, WITH CONTEXT</span>
            <h2>A useful place to start.</h2>
            <p>
              Professional insights, association updates and essential
              resources.
            </p>
          </div>
          <div>
            <Link href="/resources#section-0">
              Insights & perspectives <span>↗</span>
            </Link>
            <Link href="/resources#section-2">
              Documents & downloads <span>↗</span>
            </Link>
            <Link href="/resources#section-3">
              Important professional links <span>↗</span>
            </Link>
          </div>
        </section>
        <section className="section contact-intake" id="connect">
          <div><span className="eyebrow">LET’S CONNECT</span><h2>Start a conversation.</h2><p>Membership, events or a new collaboration—tell us how we can help.</p></div>
          <PublicInquiry source="homepage" />
        </section>
      </main>
    </SiteShell>
  );
}
