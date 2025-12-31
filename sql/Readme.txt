Now the preCompiled_base folder keeps pre-compiled code and only RobotFirmwareHardware.cpp code is compiled after adding user code from frontend everytime, eventually making 1 min faster

1 time compilation code for arduino cli:


arduino-cli compile \
  --fqbn esp32:esp32:esp32 \
  arduino_cli/RobotOTAExample \
  --output-dir precompiled_base \
  --build-path precompiled_base \
  --quiet