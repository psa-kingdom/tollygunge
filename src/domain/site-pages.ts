type Section = { title: string; text: string };
export const sitePages: Record<
  string,
  { label: string; title: string; intro: string; sections: Section[] }
> = {
  privacy: {
  "label": "YOUR INFORMATION",
  "title": "Privacy at TPA",
  "intro": "Updated 28 October 2026. This notice describes how the Tollygunge Professional Association website handles information used to provide its services.",
  "sections": [
    {
      "title": "Information you provide",
      "text": "Account and sign-in details, profile and membership information, verification answers and documents, event registrations, payment references, attendance, inquiries and newsletter preferences may be recorded when you use those features. Please do not send passwords, identity documents or financial information through inquiry or issue-report forms."
    },
    {
      "title": "How information is used",
      "text": "TPA uses these records to operate accounts, review applications, administer membership and events, check manual payment records, respond to inquiries and maintain operational history. An account, verified email, reviewed profile, membership approval, payment status and public publication are separate decisions."
    },
    {
      "title": "Private and published information",
      "text": "Private documents are restricted to their owner and authorized reviewers. Staff access depends on their assigned role. Public articles, photographs and association profiles follow a separate publication process. Submitting an application or uploading a private document does not publish it to the public website."
    },
    {
      "title": "Service providers and essential storage",
      "text": "The platform uses Railway for hosting and database services, Cloudflare R2 for configured file storage, and Resend for configured email delivery. These services process information needed for those functions. Essential session cookies maintain sign-in; local browser storage remembers appearance and navigation preferences. This release does not add Google Analytics or advertising trackers."
    },
    {
      "title": "Communications and issue reports",
      "text": "Newsletter preferences and unsubscribe controls are separate from service messages. Website reports can optionally include a previewed page template, release version, browser family and viewport size. Query strings, session tokens and form contents are excluded from that automatic context. Public inquiry consent does not subscribe you to newsletters."
    },
    {
      "title": "Records, corrections and requests",
      "text": "Records and recovery copies support association operations, account security and audit history. This notice does not promise an automatic deletion schedule. Contact the secretariat to ask about your records, request corrections or discuss removal; TPA will review the request alongside its operational and recordkeeping requirements."
    }
  ]
},
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
        text: "Choose from Free, Patron and Life membership. New accounts and first-time event attendees join the Free plan. Members can explore paid membership options from their account settings.",
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
        title: "Gallery",
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
        text: "Send an inquiry without an account. Share your contact details and optional company information so the TPA team can follow up. Signed-in accounts can also track their own inquiries.",
      },
    ],
  },
};
