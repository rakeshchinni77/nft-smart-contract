FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Compile contracts
RUN npx hardhat compile

# Default command runs the test suite
CMD ["npx", "hardhat", "test"]
