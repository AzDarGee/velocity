# Use an official Node runtime as a parent image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the workspace
COPY package*.json ./

# Install application dependencies
# We use npm install since it handles peer dependencies gracefully
RUN npm install

# Copy the rest of the application source code
COPY . .

# Set environment variable to ensure production mode
ENV NODE_ENV=production

# The start command assumes port 3000, explicitly set it for clarity
ENV PORT=3000

# Expose Gemini API key at build time for Vite static injection
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Build the Vite frontend and compile the Express server backend
# Note: This will produce dist/index.html and dist/server.js based on your package.json
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the Node Express server. 
# This runs the compiled server built by the 'npm run build' step
CMD ["npm", "run", "start"]
