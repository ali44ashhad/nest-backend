#include <Arduino.h>
#line 1 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
#include "RobotHardware.h"
#include "USBFirmware.h"

// Custom UUIDs from original BLEOtaHandler
const char* CUSTOM_SERVICE_UUID       = "88881231-A981-99B0-BA32-1BD54A51B97C";
const char* CUSTOM_OTA_CHAR_UUID      = "88881232-A981-99B0-BA32-1BD54A51B97C";
const char* CUSTOM_COMMAND_CHAR_UUID  = "88881233-A981-99B0-BA32-1BD54A51B97C";
const char* CUSTOM_STATUS_CHAR_UUID   = "88881234-A981-99B0-BA32-1BD54A51B97C";


// Create BLE OTA instance with custom UUIDs
BLEOtaUpdate bleOta(CUSTOM_SERVICE_UUID, CUSTOM_OTA_CHAR_UUID, CUSTOM_COMMAND_CHAR_UUID, CUSTOM_STATUS_CHAR_UUID);

USBFirmware usbOta;
bool isUsbConnected = false;

#line 17 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void setup();
#line 44 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void loop();
#line 50 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onOtaProgress(uint32_t received, uint32_t total, uint8_t percentage);
#line 61 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onUsbProgress(uint32_t received, uint32_t total, uint8_t percentage);
#line 65 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onOtaStatus(OtaStatus status, const char* message);
#line 95 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onUsbStatus(USBStatus status, const char* message);
#line 125 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onConnection(bool connected);
#line 137 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void onUsbConnection(bool connected);
#line 17 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotOTAExample.ino"
void setup() {
  Serial.setRxBufferSize(4096);
  Serial.begin(921600);
  Serial.setRxBufferSize(4096);
  hardwareSetup();


  // Set up BLE OTA callbacks
  bleOta.setOtaProgressCallback(onOtaProgress);
  bleOta.setOtaStatusCallback(onOtaStatus);
  
  bleOta.setCommandCallback([](const String& command) {
    String result = onCommand(command);   // hardware handles it
  });
  
  bleOta.setConnectionCallback(onConnection);
  
  // Start BLE OTA service
  bleOta.begin("RRRR");

  usbOta.setUsbProgressCallback(onUsbProgress);
  usbOta.setUsbStatusCallback(onUsbStatus);
  usbOta.setUSBConnectionCallback(onUsbConnection);
  usbOta.begin();

}

void loop() {
//  hardwareLoop();
  usbOta.loop();
 }

// BLE OTA Callbacks
void onOtaProgress(uint32_t received, uint32_t total, uint8_t percentage) {
  Serial.printf("OTA Progress: %d%% (%u/%u bytes)\n", percentage, received, total);
  
  // Visual feedback with LED
  if (percentage % 10 == 0) {
    digitalWrite(LED_PIN, LOW);
    delay(50);
    digitalWrite(LED_PIN, HIGH);
  }
}

void onUsbProgress(uint32_t received, uint32_t total, uint8_t percentage) {
 
}

void onOtaStatus(OtaStatus status, const char* message) {
  Serial.printf("OTA Status: %s\n", message);
  
  switch (status) {
    case OtaStatus::IDLE:
      digitalWrite(LED_PIN, LOW);
      break;
    case OtaStatus::RECEIVING:
      digitalWrite(LED_PIN, HIGH);
      break;
    case OtaStatus::COMPLETED:
      digitalWrite(LED_PIN, HIGH);
      // LED will stay on until reboot
      break;
    case OtaStatus::ERROR:
      // Blink rapidly to indicate error
      for (int i = 0; i < 15; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
      }
      digitalWrite(LED_PIN, LOW);
      break;
    case OtaStatus::ABORTED:
      digitalWrite(LED_PIN, LOW);
      break;
  }
}

void onUsbStatus(USBStatus status, const char* message) {
  Serial.printf("USB OTA Status: %s\n", message);

  switch (status) {
    case USBStatus::IDLE:
      digitalWrite(LED_PIN, LOW);
      break;
    case USBStatus::RECEIVING:
      digitalWrite(LED_PIN, HIGH);
      break;
    case USBStatus::COMPLETED:
      digitalWrite(LED_PIN, HIGH);
      // LED will stay on until reboot
      break;
    case USBStatus::ERROR:
      // Blink rapidly to indicate error
      for (int i = 0; i < 15; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
      }
      digitalWrite(LED_PIN, LOW);
      break;
    case USBStatus::ABORTED:
      digitalWrite(LED_PIN, LOW);
      break;
  }
}

void onConnection(bool connected) {
  if (connected) {
    isUsbConnected=true;
    Serial.println("BLE client connected");
    digitalWrite(LED_PIN, HIGH);
    bleOta.sendStatus("Robot connected and ready!");
  } else {
    Serial.println("BLE client disconnected");
    digitalWrite(LED_PIN, LOW);
  }
}

  void onUsbConnection(bool connected) {
  if (connected) {
    digitalWrite(LED_PIN, HIGH);
    usbOta.sendUSBStatus("Robot connected and ready!");
  } else {
    usbOta.sendUSBStatus("Robot disconnected");
    digitalWrite(LED_PIN, LOW);
  }
}

