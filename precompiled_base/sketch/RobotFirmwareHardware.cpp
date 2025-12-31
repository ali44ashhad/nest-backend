#line 1 "/Users/amitkumar/Desktop/Freelance/Nesta-toys-Backend/arduino_cli/RobotOTAExample/RobotFirmwareHardware.cpp"
// RobotFirmwareHardware.cpp
#include "RobotHardware.h"

void firmwareSetup() {
  Serial.println("Firmware setup completed.");
}

void firmwareLoop() {
  moveUP();
  Serial.println("Firmware loop completed.");
}
