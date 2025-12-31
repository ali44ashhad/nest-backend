//working code
// import { Request, Response } from "express";
// import { exec } from "child_process";
// import { promises as fs } from "fs";
// import path from "path";
// import { randomUUID } from "crypto";

// class CompilerController {
//   public async compile(req: Request, res: Response): Promise<void> {
//     const { code } = req.body;

//     if (!code) {
//       res.status(400).json({ message: "No code provided to compile." });
//       return;
//     }

//     const sketchName = "RobotOTAExample";
//     const jobId = randomUUID(); // Unique ID for this compilation job

//     // Original source directory, used as a template
//     const originalSketchDir = path.join(process.cwd(), "arduino_cli", sketchName);

//     // A unique parent directory for this job's source files, used for cleanup
//     const tempSketchParentDir = path.join(process.cwd(), "temp_sketches", jobId);
//     // The actual sketch directory for arduino-cli, with the required name
//     const tempSketchDir = path.join(tempSketchParentDir, sketchName);

//     // Temporary directory for build artifacts
//     const tempBuildDir = path.join(process.cwd(), "temp_builds", jobId);

//     const tempHardwareFilePath = path.join(tempSketchDir, "RobotFirmwareHardware.cpp");
//     const binaryPath = path.join(tempBuildDir, `${sketchName}.ino.bin`);


//     try {
//       // Step 1: Create temporary directories for the source and build files
//       await fs.mkdir(tempSketchDir, { recursive: true });
//       await fs.mkdir(tempBuildDir, { recursive: true });

//       // Step 2: Copy the original sketch contents to the temporary, correctly named directory
//       await fs.cp(originalSketchDir, tempSketchDir, { recursive: true });

//       // Step 3: Read the *copied* file and inject the new code
//       let hardwareFileContent = await fs.readFile(tempHardwareFilePath, "utf8");

//       const newFunction = `void firmwareLoop() {\n${code}\n}`;
//       const updatedFileContent = hardwareFileContent.replace(
//         /void\s+firmwareLoop\s*\([^)]*\)\s*{[^}]*}/,
//         newFunction
//       );

//       // Write the changes to the *copied* file
//       await fs.writeFile(tempHardwareFilePath, updatedFileContent, "utf8");

//       // Step 4: Compile the code located in the temporary sketch directory
//       const command = `arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir ${tempBuildDir} ${tempSketchDir}`;

//       exec(command, { maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
//           if (error) {
//             console.error(`Compilation Error: ${stderr}`);
//             // Cleanup temporary files on compilation failure
//             try {
//               await fs.rm(tempSketchParentDir, { recursive: true, force: true });
//               await fs.rm(tempBuildDir, { recursive: true, force: true });
//             } catch (cleanupError) {
//               console.error(`Failed to cleanup directories for job ${jobId}:`, cleanupError);
//             }
//             res.status(500).json({
//               success: false,
//               message: "Compilation failed.",
//               output: stderr || stdout,
//             });
//             return;
//           }

//           // Verify that the binary file exists in the temporary build directory
//           try {
//             await fs.access(binaryPath);
//           } catch {
//             res.status(500).json({
//               success: false,
//               message: "Compilation succeeded but the binary file was not found.",
//               output: stdout,
//             });
//             return;
//           }

//           // Send back the unique job ID for downloading the binary
//           res.status(200).json({
//             success: true,
//             message: "Compilation successful!",
//             output: stdout,
//             jobId: jobId, // The client will use this ID to download
//           });
//         }
//       );
//     } catch (err) {
//       console.error("Server error during compilation setup:", err);
//       // Ensure cleanup even if initial setup fails
//       try {
//         await fs.rm(tempSketchParentDir, { recursive: true, force: true });
//         await fs.rm(tempBuildDir, { recursive: true, force: true });
//       } catch (cleanupError) {
//         // Log cleanup error but send original error to client
//       }
//       res.status(500).json({
//         success: false,
//         message: "An internal server error occurred during file setup.",
//         output: (err as Error).message,
//       });
//     }
//   }

//   public async download(req: Request, res: Response): Promise<void> {
//     const { jobId } = req.params; // Use the unique jobId from the URL
//     const sketchName = "RobotOTAExample";

//     if (!jobId) {
//       res.status(400).send("A job ID is required for download.");
//       return;
//     }

//     const tempSketchParentDir = path.join(process.cwd(), "temp_sketches", jobId);
//     const tempBuildDir = path.join(process.cwd(), "temp_builds", jobId);

//     const binaryPath = path.join(
//       tempBuildDir,
//       `${sketchName}.ino.bin`
//     );

//     res.download(binaryPath, `${sketchName}-${jobId}.bin`, async (err) => {
//       if (err) {
//         console.error("File download error:", err);
//         // Don't send a response here if one hasn't been sent,
//         // but still clean up the files.
//         if (!res.headersSent) {
//           res.status(404).send("Could not find the compiled binary. It may have expired or the job ID is invalid.");
//         }
//       }

//       // Always cleanup after the download attempt (success or failure)
//       try {
//         await fs.rm(tempSketchParentDir, { recursive: true, force: true });
//         await fs.rm(tempBuildDir, { recursive: true, force: true });
//         console.log(`Cleaned up temporary files for job: ${jobId}`);
//       } catch (cleanupError) {
//         console.error(`Error during cleanup for job ${jobId}:`, cleanupError);
//       }
//     });
//   }
// }

// export default new CompilerController();

// ============================

// src/controllers/compilerController.ts
import { Request, Response } from "express";
import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// --- UPDATED CONSTANT FOR INCREMENTAL BUILD (Using a single path) ---
// This path holds the results of the one-time precompilation.
const PRECOMPILED_BASE_DIR = path.join(process.cwd(), "precompiled_base");
// --------------------------------------------------------------------

class CompilerController {
  public async compile(req: Request, res: Response): Promise<void> {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ message: "No code provided to compile." });
      return;
    }

    const sketchName = "RobotOTAExample";
    const jobId = randomUUID(); // Unique ID for this compilation job

    // Original source directory, used as a template
    const originalSketchDir = path.join(process.cwd(), "arduino_cli", sketchName);

    // A unique parent directory for this job's source files, used for cleanup
    const tempSketchParentDir = path.join(process.cwd(), "temp_sketches", jobId);
    // The actual sketch directory for arduino-cli, with the required name
    const tempSketchDir = path.join(tempSketchParentDir, sketchName);

    // Temporary directory for build artifacts
    const tempBuildDir = path.join(process.cwd(), "temp_builds", jobId);

    const tempHardwareFilePath = path.join(tempSketchDir, "RobotFirmwareHardware.cpp");
    const binaryPath = path.join(tempBuildDir, `${sketchName}.ino.bin`);


    try {
      // Step 1: Create temporary directories for the source and build files
      await fs.mkdir(tempSketchDir, { recursive: true });
      await fs.mkdir(tempBuildDir, { recursive: true });

      // Step 2: Copy the original sketch contents to the temporary, correctly named directory
      await fs.cp(originalSketchDir, tempSketchDir, { recursive: true });

      // Step 3: Read the *copied* file and inject the new code
      let hardwareFileContent = await fs.readFile(tempHardwareFilePath, "utf8");

      const START_MARKER = "//starting function";
      const END_MARKER = "//ending of function";

      let helperSection = "";
      let loopBodySection = code;

      const startIdx = code.indexOf(START_MARKER);
      const endIdx = code.indexOf(END_MARKER);

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const beforeMarker = code.slice(0, startIdx);
        const betweenMarkers = code.slice(startIdx, endIdx + END_MARKER.length);
        const afterMarker = code.slice(endIdx + END_MARKER.length);

        helperSection = betweenMarkers.trim();
        loopBodySection = (beforeMarker + "\n" + afterMarker).trim();
      }

      const newFirmwareLoopBlock = `${helperSection ? helperSection + "\n\n" : ""}void firmwareLoop() {\n${loopBodySection}\n}`;

      const updatedFileContent = hardwareFileContent.replace(
        /void\s+firmwareLoop\s*\([^)]*\)\s*{[^}]*}/,
        newFirmwareLoopBlock
      );

      // Write the changes to the *copied* file
      await fs.writeFile(tempHardwareFilePath, updatedFileContent, "utf8");

      // Step 4: Compile the code using the precompiled base for incremental linking
      // The --build-path points to the precompiled directory, allowing a fast,
      // incremental build where only the new/changed user code is compiled.
      const command = `arduino-cli compile \
        --fqbn esp32:esp32:esp32 \
        --output-dir ${tempBuildDir} \
        --build-path ${PRECOMPILED_BASE_DIR} \
        ${tempSketchDir}`;

      exec(command, { maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
        // ... (Rest of the logic remains the same)
        if (error) {
          console.error(`Compilation Error: ${stderr}`);
          // Cleanup temporary files on compilation failure
          try {
            await fs.rm(tempSketchParentDir, { recursive: true, force: true });
            await fs.rm(tempBuildDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error(`Failed to cleanup directories for job ${jobId}:`, cleanupError);
          }
          res.status(500).json({
            success: false,
            message: "Compilation failed.",
            output: stderr || stdout,
          });
          return;
        }

        // Verify that the binary file exists in the temporary build directory
        try {
          await fs.access(binaryPath);
        } catch {
          res.status(500).json({
            success: false,
            message: "Compilation succeeded but the binary file was not found.",
            output: stdout,
          });
          return;
        }

        // Send back the unique job ID for downloading the binary
        res.status(200).json({
          success: true,
          message: "Compilation successful!",
          output: stdout,
          jobId: jobId, // The client will use this ID to download
        });
      }
      );
    } catch (err) {
      console.error("Server error during compilation setup:", err);
      // Ensure cleanup even if initial setup fails
      try {
        await fs.rm(tempSketchParentDir, { recursive: true, force: true });
        await fs.rm(tempBuildDir, { recursive: true, force: true });
      } catch (cleanupError) {
        // Log cleanup error but send original error to client
      }
      res.status(500).json({
        success: false,
        message: "An internal server error occurred during file setup.",
        output: (err as Error).message,
      });
    }
  }

  // The download function remains unchanged as it correctly uses jobId and cleans up.
  public async download(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params; // Use the unique jobId from the URL
    const sketchName = "RobotOTAExample";

    if (!jobId) {
      res.status(400).send("A job ID is required for download.");
      return;
    }

    const tempSketchParentDir = path.join(process.cwd(), "temp_sketches", jobId);
    const tempBuildDir = path.join(process.cwd(), "temp_builds", jobId);

    const binaryPath = path.join(
      tempBuildDir,
      `${sketchName}.ino.bin`
    );

    res.download(binaryPath, `${sketchName}-${jobId}.bin`, async (err) => {
      if (err) {
        console.error("File download error:", err);
        if (!res.headersSent) {
          res.status(404).send("Could not find the compiled binary. It may have expired or the job ID is invalid.");
        }
      }

      console.log("bf reach")
      // Always cleanup after the download attempt (success or failure)
      try {
        console.log("reached")
        await fs.rm(tempSketchParentDir, { recursive: true, force: true });
        await fs.rm(tempBuildDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary files for job: ${jobId}`);
      } catch (cleanupError) {
        console.error(`Error during cleanup for job ${jobId}:`, cleanupError);
      }
    });
  }
}

export default new CompilerController();