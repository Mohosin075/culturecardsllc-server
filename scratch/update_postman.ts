import * as fs from 'fs';
import * as path from 'path';

const postmanPath = path.join(__dirname, '..', 'CultureCards_APIs.postman_collection.json');
let content = fs.readFileSync(postmanPath, 'utf8');

// Replace role references in body / strings
content = content.replace(/"role":\s*"user"/g, '"role": "buyer"');
content = content.replace(/"role":\s*"professional"/g, '"role": "seller"');

// Replace any raw body references
content = content.replace(/\\"role\\":\s*\\"user\\"/g, '\\"role\\": \\"buyer\\"');
content = content.replace(/\\"role\\":\s*\\"professional\\"/g, '\\"role\\": \\"seller\\"');

// Send Message - convert to form-data (Multipart/Form-Data) in Postman JSON for better documentation
const data = JSON.parse(content);

const findAndModifyMessage = (items: any[]) => {
  for (const item of items) {
    if (item.name === "Send Message" && item.request) {
      if (item.request.header) {
        item.request.header = item.request.header.filter((h: any) => h.key !== "Content-Type");
      }
      item.request.body = {
        mode: "formdata",
        formdata: [
          {
            key: "chatId",
            value: "{{chatId}}",
            type: "text"
          },
          {
            key: "text",
            value: "Hey, are you willing to trade Pikachu?",
            type: "text"
          },
          {
            key: "file",
            type: "file",
            description: "Optional chat attachment (image/video/doc)"
          }
        ]
      };
    }
    if (item.name === "Update Profile" && item.request) {
      if (item.request.header) {
        item.request.header = item.request.header.filter((h: any) => h.key !== "Content-Type");
      }
      item.request.body = {
        mode: "formdata",
        formdata: [
          {
            key: "fullName",
            value: "Alice Buyer Updated",
            type: "text"
          },
          {
            key: "description",
            value: "Sports cards trading expert.",
            type: "text"
          },
          {
            key: "profile",
            type: "file",
            description: "Profile picture upload"
          },
          {
            key: "coverPhoto",
            type: "file",
            description: "Cover photo upload"
          }
        ]
      };
    }
    if (item.item) {
      findAndModifyMessage(item.item);
    }
  }
};

findAndModifyMessage(data.item);

fs.writeFileSync(postmanPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Postman collection successfully updated!');
