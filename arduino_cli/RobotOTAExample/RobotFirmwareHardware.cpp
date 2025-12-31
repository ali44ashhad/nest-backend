// RobotFirmwareHardware.cpp
#include "RobotHardware.h"

void firmwareSetup() {
  Serial.println("Firmware setup completed.");
}

void firmwareLoop() {
  moveUP();
  Serial.println("Firmware loop completed.");
}
