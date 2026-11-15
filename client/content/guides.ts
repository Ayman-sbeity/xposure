// Practical guides (English). General planning advice only: no claims about Xposure's
// results, prices or clients. Add a guide here and its page, sitemap entry and links
// are generated automatically.
export type GuideSection = { heading: string; paragraphs?: string[]; list?: string[] };

export type Guide = {
  slug: string;
  title: string;
  accent: string;
  description: string;
  intro: string;
  sections: GuideSection[];
  relatedServices: string[];
  published: string;
  metaTitle: string;
};

export const guides: Guide[] = [
  {
    slug: 'how-to-brief-an-event-staffing-agency',
    title: 'How to brief an event staffing agency',
    accent: 'A practical checklist.',
    description:
      'What to include when you ask an event staffing agency for hostesses, promoters or receptionists, so you get an accurate proposal the first time.',
    intro:
      'A clear brief saves days of back-and-forth. Whether you need two hostesses for a launch or a full team for an exhibition, these are the details an agency needs to recommend the right people and give you an accurate proposal.',
    sections: [
      {
        heading: '1. The basics: what, when and where',
        list: [
          'The type of event: conference, exhibition, product launch, corporate dinner or private occasion.',
          'Date or dates, including set-up and rehearsal time if staff are needed for it.',
          'Start and finish times for staff, not just for guests.',
          'The venue and city, plus parking or access arrangements.',
        ],
      },
      {
        heading: '2. The roles you need',
        paragraphs: [
          'Describe what each person will actually do. "Four hostesses" tells an agency less than "two at registration, one guiding guests to the hall and one looking after VIPs".',
        ],
        list: [
          'Welcoming and registering guests',
          'Guiding guests and answering questions',
          'Presenting or demonstrating a product',
          'Collecting visitor details on a stand',
          'Coordinating timings and suppliers on the day',
        ],
      },
      {
        heading: '3. Your guests and your brand',
        list: [
          'Who is attending and roughly how many people.',
          'Languages staff should speak with guests.',
          'Dress code or uniform, and who provides it.',
          'Key messages staff should know about your company or product.',
        ],
      },
      {
        heading: '4. Practical details',
        list: [
          'A contact person on the day.',
          'Break and meal arrangements for long shifts.',
          'Any briefing or training session before the event.',
          'Whether photos or video of the team may be shared afterwards.',
        ],
      },
      {
        heading: '5. What success looks like',
        paragraphs: [
          'Say what you want the event to achieve: a smooth arrival with no queues, a set number of conversations on the stand, or guests who feel personally looked after. It helps the agency choose people and plan the day around your goal.',
        ],
      },
    ],
    relatedServices: ['hostesses-and-receptionists', 'event-coordination'],
    published: '2026-11-10',
    metaTitle: 'How to Brief an Event Staffing Agency | Xposure',
  },
  {
    slug: 'exhibition-stand-staffing-checklist',
    title: 'Exhibition stand staffing checklist',
    accent: 'Before, during and after the show.',
    description:
      'A checklist for staffing an exhibition stand: how to plan roles, prepare promoters and hostesses, run the stand during the show and follow up afterwards.',
    intro:
      'The people on your stand shape how visitors remember your brand. Use this checklist to plan who you need, prepare them well and make the most of every conversation at the exhibition.',
    sections: [
      {
        heading: 'Before the exhibition',
        list: [
          'Set one clear goal for the stand: meetings booked, contacts collected or product demonstrations given.',
          'Decide the roles: someone to welcome visitors, promoters to start conversations, and your own team for detailed questions.',
          'Plan shifts so the stand is never empty, including opening, lunch and the last hour.',
          'Prepare a one-page briefing with key messages, common questions and who to hand visitors to.',
          'Agree on uniform or dress code that fits your brand.',
        ],
      },
      {
        heading: 'On the stand',
        list: [
          'Hold a short briefing each morning with the day’s priorities.',
          'Keep staff at the edge of the stand, facing the aisle, ready to greet.',
          'Use a simple, consistent way to record visitor details and what they asked about.',
          'Rotate breaks so energy stays high through the afternoon.',
          'Take photos during busy moments for your own channels.',
        ],
      },
      {
        heading: 'After the show',
        list: [
          'Follow up with new contacts while the conversation is still fresh.',
          'Ask stand staff what visitors asked most often.',
          'Note what worked and what to change for the next exhibition.',
        ],
      },
    ],
    relatedServices: ['promotion-and-sales', 'hostesses-and-receptionists'],
    published: '2026-11-10',
    metaTitle: 'Exhibition Stand Staffing Checklist | Xposure',
  },
];

export const findGuide = (slug: string): Guide | undefined => guides.find((guide) => guide.slug === slug);
