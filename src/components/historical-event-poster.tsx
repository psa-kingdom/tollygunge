import Image from "next/image";

const posters: Record<string, { src: string; alt: string; width: number; height: number }> = {
  "2026-10-03": {
    src: "/design/events/2026-10-03-annual-filings.png",
    alt: "Seminar on Annual Filings under CA 2013 and Board Report, with CS Hansraj Jaria, 3 October 2026, 3–6 PM, BBD Bag Ashika Conference Hall, Kolkata. 3 CPE hours. Historical fee: ₹300.",
    width: 1066, height: 1600,
  },
  "2026-09-02": {
    src: "/design/events/2026-09-02-auditing.png",
    alt: "Auditing and Reporting of SMCs with CA Roshan Bajaj, and Navigating NGO and Non-Corporate Audits with CA Animesh Mukhopadhyay, 2 September 2026, 2:30–6:30 PM, BBD Bag Ashika Conference Hall, Kolkata. 4 CPE hours. Historical fee: ₹400.",
    width: 1024, height: 1536,
  },
  "2026-08-14": {
    src: "/design/events/2026-08-14-tax-audit.png",
    alt: "Tax Audit — Important Issues, with CA Sanjay Bhattacharjee, 14 August 2026, 3–6 PM, BBD Bag Ashika Conference Hall, Kolkata. 3 CPE hours. Historical fee: ₹300.",
    width: 1023, height: 1537,
  },
};

export function hasHistoricalEventPoster(date: string) {
  return Boolean(posters[date]);
}

export function HistoricalEventPoster({ date }: { date: string }) {
  const poster = posters[date];
  if (!poster) return null;
  return <a className="historical-event-poster" href={poster.src} target="_blank" rel="noreferrer" aria-label={`Open full-size seminar poster for ${date}`}>
    <Image unoptimized src={poster.src} alt={poster.alt} width={poster.width} height={poster.height} sizes="(max-width: 600px) 85vw, 280px" />
    <span>View full-size poster </span>
  </a>;
}
