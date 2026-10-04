import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
type Section = { title: string; text: string };
const pages: Record<
  string,
  { label: string; title: string; intro: string; sections: Section[] }
> = {
  about: {
    label: "OUR ASSOCIATION",
    title: "Individual strengths. Collective progress.",
    intro:
      "TPA is a professional community created to bring together professionals, business leaders, entrepreneurs and the wider professional ecosystem around Tollygunge and beyond.",
    sections: [
      {
        title: "About TPA",
        text: "We create a platform where professionals can connect, collaborate, learn, contribute and grow together. Our focus areas include knowledge sharing, professional cooperation, leadership, technology and community engagement.",
      },
      {
        title: "Vision & Mission",
        text: "Our vision is a vibrant, connected and progressive professional community where people, ideas and opportunities create lasting value. We connect professionals, encourage learning, facilitate collaboration, support contribution and create opportunities for growth.",
      },
      {
        title: "Founding Members",
        text: "TPA is being built by professionals who believe in collaboration, knowledge sharing and collective growth. Verified founder profiles will be published here when supplied by the association.",
      },
    ],
  },
  governance: {
    label: "RESPONSIBLE STEWARDSHIP",
    title: "A clear foundation. A shared responsibility.",
    intro:
      "Association leadership and governing documents, in one accessible place.",
    sections: [
      {
        title: "Executive Committee",
        text: "The verified committee roster, roles and professional profiles will be published following association confirmation.",
      },
      {
        title: "Sub-Committees",
        text: "Committee responsibilities and participating members will be published as the association establishes its working groups.",
      },
      {
        title: "Constitution & Bye-Laws",
        text: "Approved governing documents are awaiting publication. No draft or unverified document is presented as official.",
      },
    ],
  },
  membership: {
    label: "BELONG TO SOMETHING MEANINGFUL",
    title: "A membership for your professional journey.",
    intro:
      "Bring your experience, your curiosity and your commitment to a stronger professional community.",
    sections: [
      {
        title: "Why Become a Member",
        text: "Connect across disciplines, participate in knowledge-sharing events, explore collaborations and contribute to initiatives that create value for members and society.",
      },
      {
        title: "Membership Plans",
        text: "Patron, Annual and Life plans share a single application workflow. Professional and student applicants have distinct eligibility requirements. Plan fees, benefits and eligibility are awaiting approval.",
      },
      {
        title: "Renew Membership",
        text: "Members will renew through their authenticated portal. Renewal availability and applicable fees will follow the confirmed membership rules.",
      },
    ],
  },
  events: {
    label: "MEET. LEARN. PARTICIPATE.",
    title: "Good conversations lead to new possibilities.",
    intro:
      "Seminars, workshops and discussions designed around professional connection and shared learning.",
    sections: [
      {
        title: "Upcoming Events",
        text: "No confirmed events have been published yet. Event dates, speakers, fees and registration availability will appear here after publication.",
      },
      {
        title: "Past Events",
        text: "The archive will bring together published event information and media. Attendance and learning-hour records remain private to each member.",
      },
      {
        title: "Event Registration",
        text: "Published events will offer free or paid registration. Registration does not count as attendance; learning hours are recorded after actual attendance and represent TPA learning activity.",
      },
    ],
  },
  resources: {
    label: "KNOWLEDGE & PERSPECTIVE",
    title: "Useful knowledge. Thoughtfully shared.",
    intro:
      "Professional insights, association media, downloadable documents and trusted reference links.",
    sections: [
      {
        title: "Insights",
        text: "Association articles and curated professional updates will be published following editorial review. Gathered news will link to its source and use attributed summaries.",
      },
      {
        title: "Media",
        text: "Published event photographs and videos will appear here. Private application photographs and certificates are never part of the public gallery.",
      },
      {
        title: "Downloads",
        text: "Approved association resources will be available here when published.",
      },
      {
        title: "Important Links",
        text: "Direct links to professional institutions and government portals are provided below.",
      },
    ],
  },
  contact: {
    label: "START A CONVERSATION",
    title: "Let’s connect.",
    intro:
      "Have a question about membership, an event or a potential collaboration? The secretariat will be your point of contact.",
    sections: [
      {
        title: "Contact TPA",
        text: "Verified association email and telephone details are awaiting confirmation.",
      },
      {
        title: "Office / Secretariat",
        text: "Tollygunge, Kolkata. The office address and visiting hours will be published once confirmed.",
      },
      {
        title: "Location",
        text: "A verified location and directions will be added alongside the confirmed office address.",
      },
      {
        title: "Enquiry",
        text: "Online enquiries will open when secure storage and staff routing are configured. Please return once the association has published its contact details.",
      },
    ],
  },
  login: {
    label: "YOUR MEMBER SPACE",
    title: "Welcome to your next chapter.",
    intro:
      "Your membership, events and learning history—together in one place.",
    sections: [
      {
        title: "Member sign-in",
        text: "Secure sign-in is being configured. Account creation and login are not available in this design preview. Existing Crazy Hands accounts are not TPA accounts.",
      },
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(pages).map((page) => ({ page }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  return { title: pages[page]?.title ?? "Page not found" };
}
export default async function ContentPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const data = pages[page];
  if (!data) notFound();
  return (
    <SiteShell>
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">{data.label}</span>
          <h1>{data.title}</h1>
          <p>{data.intro}</p>
        </div>
        <div className="content-page">
          {data.sections.map((section, i) => (
            <section
              id={`section-${i}`}
              className="content-section"
              key={section.title}
            >
              <h2>{section.title}</h2>
              <p>{section.text}</p>
              {page === "membership" && i === 1 && (
                <>
                  <div className="plan-grid">
                    {["Patron", "Annual", "Life"].map((plan) => (
                      <article className="plan-card" key={plan}>
                        <span className="eyebrow">TPA MEMBERSHIP</span>
                        <h3>{plan}</h3>
                        <p>
                          Benefits, fee and eligibility awaiting confirmation.
                        </p>
                        <Link className="text-link" href="/join">
                          Preview application →
                        </Link>
                      </article>
                    ))}
                  </div>
                  <p>
                    Choose plan → Details → Documents → Payment → Association
                    review → Approval & membership number.
                  </p>
                </>
              )}
              {page === "resources" && i === 3 && (
                <div className="resource-row">
                  <div>
                    {[
                      ["Income Tax", "https://www.incometax.gov.in/"],
                      ["GST", "https://www.gst.gov.in/"],
                      ["MCA / ROC", "https://www.mca.gov.in/"],
                      ["ICAI", "https://www.icai.org/"],
                      ["ICSI", "https://www.icsi.edu/"],
                      ["RBI", "https://www.rbi.org.in/"],
                      ["SEBI", "https://www.sebi.gov.in/"],
                      ["EPFO", "https://www.epfindia.gov.in/"],
                      ["ESIC", "https://www.esic.gov.in/"],
                      ["DGFT", "https://www.dgft.gov.in/"],
                      ["Government Portals", "https://www.india.gov.in/"],
                      ["West Bengal Government", "https://wb.gov.in/"],
                    ].map(([label, url]) => (
                      <p key={label}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {label} ↗
                        </a>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
