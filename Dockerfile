
# ---- Stage 1: Build Stage ----
FROM node:20-slim AS build
WORKDIR /usr/src/app

# Copy package.json and install dev dependencies
COPY package*.json ./
RUN npm install && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build


# ---- Stage 2: Production Stage ----
FROM node:20-slim

# Install system dependencies (curl, unzip, git, python3)
RUN apt-get update && \
    apt-get install -y curl unzip git python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install Arduino CLI
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

WORKDIR /usr/src/app

# Copy build artifacts
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY arduino_cli ./arduino_cli

# Verify Arduino CLI
RUN arduino-cli version

# Install ESP32 core
RUN arduino-cli core update-index && \
    arduino-cli core install esp32:esp32

# Install required Arduino libraries
RUN arduino-cli lib install \
    "Servo@1.2.2" \
    "NewPing@1.9.7" \
    "ESP32_IO_Expander@1.0.1" \
    "ESP32_Display_Panel@1.0.3" \
    "esp-lib-utils@0.1.2" \
    "BLE OTA Update@1.0.7"

EXPOSE 3000
CMD ["node", "dist/index.js"]
