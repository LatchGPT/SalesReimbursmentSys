import { Client } from '@notionhq/client';

export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function fetchTasks(databaseId: string) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      // You can add filters here, e.g., only fetch incomplete tasks
    });
    return response.results;
  } catch (error) {
    console.error('Error fetching tasks from Notion:', error);
    throw error;
  }
}

export async function createTask(databaseId: string, title: string) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
    });
    return response;
  } catch (error) {
    console.error('Error creating task in Notion:', error);
    throw error;
  }
}
