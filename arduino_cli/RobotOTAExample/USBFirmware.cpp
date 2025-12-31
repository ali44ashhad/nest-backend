#include "USBFirmware.h"
#define CHUNK_SIZE 1024
unsigned long lastProgressUpdate = 0;

// Static instance
USBFirmware* USBFirmware::instance = nullptr;

// Constructor implementations

USBFirmware::USBFirmware() {
  
  // Initialize state
  usbInProgress = false;
  usbFileSize = 0;
  usbReceived = 0;
  usbStatus = USBStatus::IDLE;
  clientConnected = false;
  
  // Default configuration
  maxPacketSize = 2048;
  updateBufferSize = 2048;
  
  // Initialize callbacks
  progressCallback = nullptr;
  statusCallback = nullptr;
  commandCallback = nullptr;
  connectionCallback = nullptr;
  
}

void USBFirmware::begin() {
  // Set instance for callbacks
  instance = this;
  
   if (Update.isRunning()) {
    Update.abort();
  }
  
  // Clear Serial buffer thoroughly
  Serial.flush();
  delay(100);
  while (Serial.available() > 0) {
    Serial.read();
  }
  delay(50);
  setUsbStatus(USBStatus::IDLE, "USB OTA Service Ready");
}

// Callback setters
void USBFirmware::setUsbProgressCallback(USBProgressCallback callback) {
  progressCallback = callback;
}

void USBFirmware::setUsbStatusCallback(USBStatusCallback callback) {
  statusCallback = callback;
}

void USBFirmware::setUSBCommandCallback(USBCommandCallback callback) {
  commandCallback = callback;
}

void USBFirmware::setUSBConnectionCallback(USBConnectionCallback callback) {
  connectionCallback = callback;
}

// Control methods
void USBFirmware::stop() {
  setUsbStatus(USBStatus::IDLE, "Service stopped");
}

void USBFirmware::restart() {
    setUsbStatus(USBStatus::IDLE, "Service restarted");
}

void USBFirmware::abortUpdate() {
  if (usbInProgress) {
    Update.end(false);
    usbInProgress = false;
    usbFileSize = 0;
    usbReceived = 0;
    setUsbStatus(USBStatus::ABORTED, "Update aborted by user");
    ESP.restart();
  }
}

// Status methods
bool USBFirmware::isConnected() const {
  return clientConnected;
}

bool USBFirmware::isUpdateInProgress() const {
  return usbInProgress;
}

USBStatus USBFirmware::getUsbStatus() const {
  return usbStatus;
}

uint32_t USBFirmware::getUpdateProgress() const {
  return usbReceived;
}

uint32_t USBFirmware::getUpdateTotal() const {
  return usbFileSize;
}

uint8_t USBFirmware::getUpdatePercentage() const {
  if (usbFileSize == 0) return 0;
  return (usbReceived * 100) / usbFileSize;
}



void USBFirmware::setMaxPacketSize(size_t size) {
  maxPacketSize = size;
}

void USBFirmware::setUpdateBufferSize(size_t size) {
  updateBufferSize = size;
}

// Send status updates
void USBFirmware::sendUSBStatus(const String& status) {
  String p = "USB_SS " + status;   // concatenate using Arduino String
  Serial.println(p);
}

void USBFirmware::sendUSBProgress(uint32_t received, uint32_t total) {
     String progress = "USB_S PROGRESS:" + String(received) + "/" + String(total);
  Serial.printf(progress.c_str());
}

// Loop method
void USBFirmware::loop() {
    handleUsbData();
}

// Internal methods
void USBFirmware::handleUsbData() {
    while (Serial.available() > 0) {
        size_t available = Serial.available();
        size_t toRead = min(available, (size_t)maxPacketSize);
        uint8_t buffer[toRead];
        size_t bytesRead = Serial.readBytes(buffer, toRead);
        if (bytesRead > 0) {
            handleUsbWrite(buffer, bytesRead);
        }
    }
     if (usbInProgress) {
        unsigned long now = millis();
    if (now - lastProgressUpdate >= 100 && usbReceived != usbFileSize) { // 50 ms debounce
      updateProgress();
      
    String s = "Setup: Initial Free Heap:" + String(ESP.getFreeHeap()) + " bytes\n";
    sendUSBStatus(s);
      lastProgressUpdate = now;
    }

      }
    delay(130);
}

void USBFirmware::handleUsbWrite(const uint8_t* data, size_t length) {
    if (length == 0) return;

//    if (length == 4 && memcmp(data, USB_CMD_GIVE, 4) == 0) {
//      sendUSBStatus("GIVE CALLED");
//      updateProgress();
//        return;
//    }

    // Handle OTA commands
    if (!usbInProgress && length == 4) {
        if (memcmp(data, USB_CMD_OPEN, 4) == 0) {
            usbInProgress = true;
            usbFileSize = 0;
            usbReceived = 0;
            fileSizeReceived = false;  // Add this flag
            setUsbStatus(USBStatus::RECEIVING, "Update started");
            return;
        }
    }

    if (usbInProgress) {
        // Handle file size (first 4 bytes after OPEN command)
        if (!fileSizeReceived && length == 4) {
            memcpy(&usbFileSize, data, 4);
            
            // Validate file size
            if (usbFileSize == 0 || usbFileSize > MAX_FIRMWARE_SIZE) {
                sendUSBStatus("ERROR: Invalid file size");
                setUsbStatus(USBStatus::ERROR, "Invalid file size");
                abortUpdate();
                return;
            }

            if (!Update.begin(usbFileSize)) {
                sendUSBStatus("ERROR: Not enough space");
                setUsbStatus(USBStatus::ERROR, "Not enough space");
                abortUpdate();
                return;
            }
            
            fileSizeReceived = true;
            setUsbStatus(USBStatus::RECEIVING, "Receiving firmware");
            return;
        }

        // Handle DONE command
        if (length == 4 && memcmp(data, USB_CMD_DONE, 4) == 0) {
            if (!fileSizeReceived) {
                sendUSBStatus("ERROR: No file size received");
                setUsbStatus(USBStatus::ERROR, "No file size received");
                abortUpdate();
                return;
            }

            if (usbReceived != usbFileSize) {
                sendUSBStatus("ERROR: Size mismatch");
                setUsbStatus(USBStatus::ERROR, "Size mismatch");
                abortUpdate();
                return;
            }
            sendUSBStatus("ESP MD5: ");
            sendUSBStatus(Update.md5String());

            if (Update.end(true)) {
                sendUSBStatus("Success. Rebooting...");
                setUsbStatus(USBStatus::COMPLETED, "Update completed successfully");
                delay(1000);
                ESP.restart();
            } else {
                sendUSBStatus(String("ERROR: Finalize failed - ") + Update.errorString());
                setUsbStatus(USBStatus::ERROR, "Update finalization failed");
                Update.printError(Serial);
                abortUpdate();
            }
            return;
        }

        // Handle ABORT command
        if (length == 5 && memcmp(data, USB_CMD_ABORT, 5) == 0) {
            sendUSBStatus("Update aborted by client");
            abortUpdate();
            return;
        }

        if (usbReceived < usbFileSize) {
         
      size_t written = Update.write((uint8_t*)data, length);
      delay(1);
      if (written > 0) {
        usbReceived += written;
        updateProgress();
      } else {
        
        setUsbStatus(USBStatus::ERROR, "Write failed");
        abortUpdate();
        usbInProgress = false;
      }
    }
  
      updateProgress();

    
    } else {
        // Not in progress and received data
        sendUSBStatus("Ignoring data - no update in progress");
    }
}

void USBFirmware::updateProgress() {
  uint8_t percentage =  getUpdatePercentage();

  if (progressCallback) {
    progressCallback(usbReceived, usbFileSize, percentage);
  }

  sendUSBProgress(usbReceived, usbFileSize);
}   

void USBFirmware::setUsbStatus(USBStatus status, const char* message) {
  usbStatus = status;
  if (statusCallback) {
    statusCallback(status, message);
  }
}
