import axios from 'axios';

const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_API_URL = 'https://app.loops.so/api/v1';

export const loopsClient = axios.create({
  baseURL: LOOPS_API_URL,
  headers: {
    Authorization: `Bearer ${LOOPS_API_KEY}`,
  },
});

export interface MailingList {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
}

export async function getMailingLists(): Promise<MailingList[]> {
  try {
    const response = await loopsClient.get('/lists');
    return response.data;
  } catch (error) {
    console.error('Error fetching mailing lists:', error);
    return [];
  }
}

const UNIFY_MAILING_LIST_ID =
  process.env.LOOPS_UNIFY_MAILING_LIST_ID || 'cmbyno1vk017b0jxs0qtqhmhs';

export const UNIFY_UPDATES_NEWSLETTER_ID =
  process.env.LOOPS_UNIFY_UPDATES_NEWSLETTER_ID || 'cmbyni4qq1tio0ivlfdfo3qj2';

export interface NewsletterItem {
  id: string;
  name: string;
  description: string;
}

/** Newsletters displayed on the Preferences tab. */
export function getNewsletters(): NewsletterItem[] {
  return [
    {
      id: UNIFY_UPDATES_NEWSLETTER_ID,
      name: 'Product Updates',
      description: 'Get notified about our product updates.',
    },
  ];
}

export async function updateContact(
  email: string,
  allLists: MailingList[],
  subscribedIds: string[]
) {
  try {
    const mailingLists = allLists.reduce(
      (acc, list) => {
        acc[list.id] = subscribedIds.includes(list.id);
        return acc;
      },
      {} as Record<string, boolean>
    );

    // Always ensure the user is subscribed to the main Unify list
    mailingLists[UNIFY_MAILING_LIST_ID] = true;

    const response = await loopsClient.put('/contacts/update', {
      email,
      mailingLists,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating contact:', error);
    return null;
  }
}

export async function getContactSubscriptions(email: string): Promise<string[]> {
  try {
    const response = await loopsClient.get(`/contacts/find?email=${encodeURIComponent(email)}`);
    const contact = response.data[0];
    if (contact && contact.mailingLists) {
      return Object.keys(contact.mailingLists).filter((id) => contact.mailingLists[id]);
    }
    return [];
  } catch (error) {
    console.error('Error fetching contact subscriptions:', error);
    return [];
  }
}
