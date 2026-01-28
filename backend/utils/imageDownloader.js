const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Downloads an image from an HTTP(S) URL and saves it to disk.
 * @param {string} url - The HTTP(S) URL of the image.
 * @param {string} uploadDir - Directory to save the image.
 * @returns {Promise<string>} - The filename of the saved image.
 */
async function downloadImageFromHttp(url, uploadDir, networkname) {
  const response = await axios.get(url, { responseType: "stream" });
  const ext = path.extname(url.split("?")[0]) || ".jpg";
  const filename = `${networkname}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const filepath = path.join(uploadDir, filename);

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const writer = fs.createWriteStream(filepath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return filename;
}

/**
 * Saves a base64-encoded image string to disk.
 * @param {string} base64String - The base64 image string (may include data URI prefix).
 * @param {string} uploadDir - Directory to save the image.
 * @returns {Promise<string>} - The filename of the saved image.
 */
async function saveBase64Image(base64String, uploadDir, networkname) {
  // Extract mime type and data
  const matches = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
  let ext = ".jpg";
  let data = base64String;

  if (matches) {
    const mime = matches[1];
    ext = "." + mime.split("/")[1];
    data = matches[2];
  } else {
    // If no data URI prefix, try to guess it's a plain base64 string (default to jpg)
    data = base64String;
  }

  const filename = `${networkname}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const filepath = path.join(uploadDir, filename);

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const buffer = Buffer.from(data, "base64");
  await fs.promises.writeFile(filepath, buffer);

  return filename;
}

/**
 * Downloads/saves all images from an array of URLs (http(s) or base64).
 * @param {string[]} imageUrls - Array of image URLs (http(s) or base64).
 * @param {string} uploadDir - Directory to save images.
 * @returns {Promise<string[]>} - Array of saved filenames.
 */
async function downloadImages(imageUrls, uploadDir, networkname) {
  if (!Array.isArray(imageUrls)) return [];

  const results = [];
  for (const url of imageUrls) {
    if (typeof url !== "string") continue;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        const filename = await downloadImageFromHttp(
          url,
          uploadDir,
          networkname,
        );
        results.push(filename);
      } catch (err) {
        console.error(`Failed to download image from ${url}:`, err.message);
      }
    } else if (url.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(url)) {
      try {
        const filename = await saveBase64Image(url, uploadDir, networkname);
        results.push(filename);
      } catch (err) {
        console.error(`Failed to save base64 image:`, err.message);
      }
    } else {
      console.warn(`Unsupported image URL format: ${url}`);
    }
  }
  return results;
}

module.exports = {
  downloadImageFromHttp,
  saveBase64Image,
  downloadImages,
};
