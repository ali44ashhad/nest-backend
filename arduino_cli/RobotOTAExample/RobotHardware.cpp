// RobotHardware.cpp
#include "RobotHardware.h"

// ===== Global Variables =====
MovingDirection movingDirection = MovingDirection::STOP;
int speed = 100;

unsigned long previousMillis = 0;  // store last time status was sent
const long interval = 1000;
long currentMillis = 0;
float percent = 0;






int dist = 999;
bool isUltrasonicEnable = false;
int ultrasonicRange = 40;
bool isInfraredEnable = false;
bool reversing = false;
unsigned long reverseStartTime = 0;

bool isFirmwareCodeEnable = false;

void sendStatus(String s) {
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;  // update the timer

    bleOta.sendStatus(s);
  }

}
//Adafruit_INA219 ina219;
float busvoltage = 0;
float current_mA = 0;
float power_mW = 0;

void hardwareSetup() {
  pinMode(LEFT_SENSOR, INPUT);
  pinMode(RIGHT_SENSOR, INPUT);

  pinMode(RIGHT_MOTOR_IN3, OUTPUT);
  pinMode(RIGHT_MOTOR_IN4, OUTPUT);
  pinMode(LEFT_MOTOR_IN1, OUTPUT);
  pinMode(LEFT_MOTOR_IN2, OUTPUT);
  pinMode(LED_PIN, OUTPUT);



  setupPWM();
  stopMotors();


//  ina219.begin();
}
//
//void measureValues()
//{
//  busvoltage = ina219.getBusVoltage_V();
//  current_mA = ina219.getCurrent_mA();
//  power_mW = ina219.getPower_mW();
//  percent = (busvoltage - 8) / (12 - 8) * 100;
//  if (percent > 100) percent = 100;
//  if (percent < 0) percent = 0;
//
//  Serial.print("Battery Voltage: "); Serial.print(busvoltage); Serial.println(" V");
//  Serial.print("Load Current: "); Serial.print(current_mA); Serial.println(" mA");
//  Serial.print("Battery Level: "); Serial.print(percent); Serial.println(" %");
//
//
//  Serial.println("Power(mW):");
//  Serial.println((int)power_mW);
//
//}



void dashboardReading() {
  String status = "";
  if (isUltrasonicEnable) {
    int dist = getDistance();
    status = "Ultrasonic: " + String(dist);
  }
  if (isInfraredEnable) {

    int x = analogRead(RIGHT_SENSOR);
    int y = analogRead(LEFT_SENSOR);

    status = status + (isUltrasonicEnable ? "_" : "") + "Infrared: " + String(x) + ", " + String(y);

  }
  status = status + "_" + String(busvoltage) + " V_" + String(current_mA) + " mA_" + String(percent) + " %";

  sendStatus(status);

}
void hardwareLoop() {
  currentMillis = millis();
  dashboardReading();

  if (isFirmwareCodeEnable)
  {
    firmwareLoop();
  }
  else {
    infraredLoop();
    ultrasonicLoop();
  }

//  measureValues();


}

void setupPWM() {
  // Attach pin + configure PWM in one call
  ledcAttach(RIGHT_MOTOR_ENABLE, PWM_FREQUENCY, PWM_RESOLUTION);
  ledcAttach(LEFT_MOTOR_ENABLE,  PWM_FREQUENCY, PWM_RESOLUTION);

  ledcWrite(RIGHT_MOTOR_ENABLE, 0);
  ledcWrite(LEFT_MOTOR_ENABLE, 0);


  Serial.println("PWM configured for motor control ");
}


void moveUP() {
  if (ultrasonicLoop()) return; // safety stop

  movingDirection = MovingDirection::UP;
  Serial.println("Action: Moving UP");
  digitalWrite(LEFT_MOTOR_IN1, LOW);
  digitalWrite(LEFT_MOTOR_IN2, HIGH);
  digitalWrite(RIGHT_MOTOR_IN3, LOW);
  digitalWrite(RIGHT_MOTOR_IN4, HIGH);

  ledcWrite(LEFT_MOTOR_ENABLE, speed);
  ledcWrite(RIGHT_MOTOR_ENABLE, speed);
}

void moveDown() {
  movingDirection = MovingDirection::DOWN;
  Serial.println("Action: Moving Down");
  digitalWrite(LEFT_MOTOR_IN1, HIGH);
  digitalWrite(LEFT_MOTOR_IN2, LOW);
  digitalWrite(RIGHT_MOTOR_IN3, HIGH);
  digitalWrite(RIGHT_MOTOR_IN4, LOW);

  ledcWrite(LEFT_MOTOR_ENABLE, speed);
  ledcWrite(RIGHT_MOTOR_ENABLE, speed);
}

void turnLeft() {
  movingDirection = MovingDirection::LEFT;
  Serial.println("Action: Turning Left");
  digitalWrite(LEFT_MOTOR_IN1, LOW);
  digitalWrite(LEFT_MOTOR_IN2, HIGH);
  digitalWrite(RIGHT_MOTOR_IN3, HIGH);
  digitalWrite(RIGHT_MOTOR_IN4, LOW);

  ledcWrite(LEFT_MOTOR_ENABLE, speed);
  ledcWrite(RIGHT_MOTOR_ENABLE, speed);
}

void turnRight() {
  movingDirection = MovingDirection::RIGHT;
  Serial.println("Action: Turning Right");
  digitalWrite(LEFT_MOTOR_IN1, HIGH);
  digitalWrite(LEFT_MOTOR_IN2, LOW);
  digitalWrite(RIGHT_MOTOR_IN3, LOW);
  digitalWrite(RIGHT_MOTOR_IN4, HIGH);

  ledcWrite(LEFT_MOTOR_ENABLE, speed);
  ledcWrite(RIGHT_MOTOR_ENABLE, speed);
}

void stopMotors() {
  movingDirection = MovingDirection::STOP;
  Serial.println("Action: Stopping");
  digitalWrite(LEFT_MOTOR_IN1, LOW);
  digitalWrite(LEFT_MOTOR_IN2, LOW);
  digitalWrite(RIGHT_MOTOR_IN3, LOW);
  digitalWrite(RIGHT_MOTOR_IN4, LOW);

  ledcWrite(LEFT_MOTOR_ENABLE, 0);
  ledcWrite(RIGHT_MOTOR_ENABLE, 0);
}

long getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  long distance = duration * 0.0343 / 2;

  return distance;
}

bool ultrasonicLoop() {
  if (!isUltrasonicEnable) return false;

  bool isUnderRange = false;
  dist = getDistance();


  if (!reversing && dist <= ultrasonicRange && movingDirection == MovingDirection::UP) {
    isUnderRange = true;
    stopMotors();
    moveDown();
    reversing = true;
    reverseStartTime = millis();
    stopMotors();
  }

  if (reversing) {
    if (millis() - reverseStartTime >= 300) {
      stopMotors();
      reversing = false;
    }
  }

  Serial.printf(" | Ultrasonic: %d cm\n", dist);
  return isUnderRange;
}

void infraredLoop() {
  if (!isInfraredEnable) return;

  int x = analogRead(RIGHT_SENSOR);
  int y = analogRead(LEFT_SENSOR);
  Serial.printf("Infrared values: %d %d\n", x, y);
  int threshold = 1000;
  if (x < threshold && y >= threshold) {
    turnLeft();
    delay(400);
  } else if (y < threshold && x >= threshold) {
    turnRight();
    delay(400);
  } else if (x >= threshold && y >= threshold) {
    stopMotors();
  } else {
    moveUP();
  }
}

int getSpeed(const String& spd) {
  if (spd == "L") return 155;
  if (spd == "M") return 205;
  if (spd == "H") return 255;
  return 0; // default if unknown
}


int splitCommand(const String& command, String parts[], int maxParts) {
  int count = 0;
  int start = 0;
  int idx;

  while ((idx = command.indexOf('_', start)) != -1 && count < maxParts - 1) {
    parts[count++] = command.substring(start, idx);
    start = idx + 1;
  }
  // last part (or whole string if no '_')
  if (count < maxParts) {
    parts[count++] = command.substring(start);
  }
  return count;
}



void move(const String& leftDir, const String& rightDir) {
  if (leftDir == "CW" && rightDir == "CW")
  {
    movingDirection = MovingDirection::UP;
  } else {
    movingDirection = MovingDirection::ELSE;
  }
  if (ultrasonicLoop()) return;

  Serial.printf("Action: Moving Left=%s, Right=%s\n", leftDir.c_str(), rightDir.c_str());

  if (leftDir == "CW") {
    digitalWrite(LEFT_MOTOR_IN1, LOW);
    digitalWrite(LEFT_MOTOR_IN2, HIGH);
  } else if (leftDir == "ACW") {
    digitalWrite(LEFT_MOTOR_IN1, HIGH);
    digitalWrite(LEFT_MOTOR_IN2, LOW);
  }

  if (rightDir == "CW") {
    digitalWrite(RIGHT_MOTOR_IN3, LOW);
    digitalWrite(RIGHT_MOTOR_IN4, HIGH);
  } else if (rightDir == "ACW") {
    digitalWrite(RIGHT_MOTOR_IN3, HIGH);
    digitalWrite(RIGHT_MOTOR_IN4, LOW);
  }
}



String onCommand(const String& command) {
  Serial.printf("Received command: %s\n", command.c_str());
  String parts[5];
  int count = splitCommand(command, parts, 5);

  if (count == 4) {
    int lspeed = getSpeed(parts[0]);
    int rspeed = getSpeed(parts[1]);

    ledcWrite(LEFT_MOTOR_ENABLE, lspeed);
    ledcWrite(RIGHT_MOTOR_ENABLE, rspeed);

    move(parts[2], parts[3]);
  } else {
    // Forward command somewhere else (e.g., ultrasonic_120)
    Serial.println("Passing command to another handler...");
    // callOtherHandler(command);  // <-- your code here
  }

  // if (command == "UP") {
  //   moveUP();
  //   return "Moving forward";
  // } else if (command == "DOWN") {
  //   moveDown();
  //   return "Moving backward";
  // } else if (command == "LEFT") {
  //   turnLeft();
  //   return "Turning left";
  // } else if (command == "RIGHT") {
  //   turnRight();
  //   return "Turning right";
  // } else
  if (command.startsWith("FIRMWARE_")) {
    String firmwareValue = command.substring(9);
    if (firmwareValue.startsWith("ON")) {
      isFirmwareCodeEnable = true;
      return "Firmware loop completed.";
    } else if (firmwareValue.startsWith("OFF")) {
      isFirmwareCodeEnable = false;
      stopMotors();
      return "Firmware loop disabled";
    }
  }
  else if (command == "STOP") {
    stopMotors();
    return "Stopped";
  } else if (command.startsWith("SPEED_")) {
    String speedValue = command.substring(6);
    speed = speedValue.toInt();
    speed = constrain(speed, 0, 255);
    return "Speed set to " + String(speed);
  } else if (command.startsWith("ULTRASONIC_")) {
    String ultrasonicValue = command.substring(11);
    if (ultrasonicValue.startsWith("OFF")) {
      isUltrasonicEnable = false;
      return "Ultrasonic disabled";
    } else {
      ultrasonicRange = ultrasonicValue.toInt();
      ultrasonicRange = constrain(ultrasonicRange, 10, 100);
      isUltrasonicEnable = true;
      return "Ultrasonic range set to " + String(ultrasonicRange);
    }
  } else if (command.startsWith("INFRARED_")) {
    String infraredValue = command.substring(9);
    if (infraredValue.startsWith("ON")) {
      isInfraredEnable = true;
      return "Infrared enabled";
    } else if (infraredValue.startsWith("OFF")) {
      isInfraredEnable = false;
      stopMotors();
      return "Infrared disabled";
    }
  }

  return "Unknown command: " + command;
}
