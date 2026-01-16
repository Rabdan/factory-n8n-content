# Use a Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies, including nodemon for development
RUN npm install

# Copy the rest of the application code
COPY . .

RUN mkdir -p /data/uploads && chmod -R 777 /data/uploads

# Expose the port the app runs on
EXPOSE 3060

# Command to run the development server with nodemon
CMD ["npm", "run", "dev"]
