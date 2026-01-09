const mailchimp = require("@mailchimp/mailchimp_marketing");
const md5 = require("md5");

const apiKey = process.env.MAILCHIMP_API_KEY;
const server = process.env.MAILCHIMP_SERVER;
const listId = process.env.MAILCHIMP_LIST_ID as string;
mailchimp.setConfig({apiKey: apiKey, server: server});

type MailchimpInterestsResponseProps = {[key:string] : boolean} | false

export const interests = {
  "5557d764ba": "Launch Updates",
  "19d7b96a24": "Paper Reading Group",
  "c13433a863": "Weekly Webinar Series",
  "aeb897777c": "Weekly Changelog"
}

export const defaultInterests = ["5557d764ba", "19d7b96a24", "c13433a863", "aeb897777c"]


/**
 * Retrieves the subscription status of a Mailchimp user based on their email.
 * 
 * @param {string} email - The email address of the user to retrieve.
 * @returns {Promise<number | undefined>} - Returns the status code of the user if found,
 * or 404 if the email is not subscribed. Returns undefined for other errors.
 */
export async function getMailchimpUser(email: string) {
  const subscriberHash = md5(email.toLowerCase());
  try {
      const response = await mailchimp.lists.getListMember(
        listId,
        subscriberHash
      );
      return response.status;
    } catch (e:any) {
      if (e.status === 404) {
        return e.status;
      }
  }
}

/**
 * Adds a user to the Mailchimp list with the default set of subscriptions.
 * 
 * @param {string} email - The email address of the user to add.
 */
export async function addMailchimpUser(email:string) {
    const response = await mailchimp.lists.addListMember(listId, {
      emailAddress: email,
      status: "subscribed",
      interests: {
        "5557d764ba": true,
        "19d7b96a24": true,
        "c13433a863": true,
        "aeb897777c": true
      }
    });
    return response;
}

/**
 * Adds or Updates a user's email address, first name, and last name in Mailchimp.
 * 
 * @param {string} email - The new email address of the user.
 * @param {string} name - The new first name of the user.
 * @param {string} lastName - The new last name of the user.
 */
export async function updateMailchimpUser(email: string, name: string, lastName: string) {
  const subscriberHash = md5(email.toLowerCase());
  await mailchimp.lists.setListMember(
    listId,
    subscriberHash,
    {
      emailAddress: email,
      statusIfNew: "subscribed",
      mergeFields: {
        FNAME: name,
        LNAME: lastName
      }
    }
  );
  return;
}

/**
 * Retrieves the interests of a Mailchimp user based on their email.
 * 
 * @param {string} email - The email address of the user to retrieve.
 * @returns {Promise<MailchimpInterestsResponseProps>} - Returns the user's interests, or false if email is not subscribed.
 */
export async function getMailchimpUserInterests(email: string): Promise<MailchimpInterestsResponseProps> {
  const subscriberHash = md5(email.toLowerCase());
  try {
    const response = await mailchimp.lists.getListMember(listId, subscriberHash);
    return response["interests"];
  } catch (e:any) {
    if (e.status === 404) {
      console.error("Email not subscribed");
    }
  }
  return false;
}

/**
 * Updates the subscription interests of a Mailchimp user.
 * 
 * @param {string} email - The email address of the user whose interests are to be updated.
 * @param {{[key: string]: boolean}} interests - A key-value object representing the interests to update,
 * where the key is the interest ID and the value is a boolean indicating subscription status.
 */
export async function updateMailchimpInterests(email: string, interests: {[key:string]: boolean}) {
  const subscriberHash = md5(email.toLowerCase());
  await mailchimp.lists.updateListMember(
      listId,
      subscriberHash,
      {
        interests: interests
      }
    );
  return;
}
