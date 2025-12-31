#ifndef USB_FIRMWARE_H
#define USB_FIRMWARE_H

#include <Arduino.h>
#include <Update.h>

// USB Commands
#define USB_CMD_OPEN    "OPEN"
#define USB_CMD_DONE    "DONE"
#define USB_CMD_ABORT   "ABORT"
#define USB_CMD_GIVE   "GIVE"

// OTA Status
enum class USBStatus {
  IDLE,
  RECEIVING,
  COMPLETED,
  ERROR,
  ABORTED
};

// Callback function types
typedef void (*USBProgressCallback)(uint32_t received, uint32_t total, uint8_t percentage);
typedef void (*USBStatusCallback)(USBStatus status, const char* message);
typedef void (*USBCommandCallback)(const String& command);
typedef void (*USBConnectionCallback)(bool connected);

class USBFirmware {
public:
  // Constructor with configurable parameters
  USBFirmware();

  // Initialize USB service
  void begin();
  
  // Set callbacks
  void setUsbProgressCallback(USBProgressCallback callback);
  void setUsbStatusCallback(USBStatusCallback callback);
  void setUSBCommandCallback(USBCommandCallback callback);
  void setUSBConnectionCallback(USBConnectionCallback callback);

  // Control methods
  void stop();
  void restart();
  void abortUpdate();
  
  // Status methods
  bool isConnected() const;
  bool isUpdateInProgress() const;
  USBStatus getUsbStatus() const;
  uint32_t getUpdateProgress() const;
  uint32_t getUpdateTotal() const;
  uint8_t getUpdatePercentage() const;
  
  // Configuration methods
  void setMaxPacketSize(size_t size);
  void setUpdateBufferSize(size_t size);
  
  // Send status updates
  void sendUSBStatus(const String& status);
  void sendUSBProgress(uint32_t received, uint32_t total);
  
  // Loop method (call in main loop if needed)
  void loop();

private:

  // USB state
  bool usbInProgress;
  uint32_t usbFileSize;
  uint32_t usbReceived;
  USBStatus usbStatus;
  bool clientConnected;
  bool fileSizeReceived = false;
static const size_t MAX_FIRMWARE_SIZE = 0x1000000; // 16MB max firmware size
  
  // Configuration
  size_t maxPacketSize;
  size_t updateBufferSize;
  
  // Callbacks
  USBProgressCallback progressCallback;
  USBStatusCallback statusCallback;
  USBCommandCallback commandCallback;
  USBConnectionCallback connectionCallback;

  // Internal methods
  void handleUsbData();
  void handleUsbWrite(const uint8_t* data, size_t length);

//   void onClientConnect();
//   void onClientDisconnect();
  void updateProgress();
  void setUsbStatus(USBStatus status, const char* message = nullptr);


  
  // Static instance for callbacks
  static USBFirmware* instance;
};

#endif // USB_FIRMWARE_H
