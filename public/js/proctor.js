/**
 * proctor.js
 * Handles webcam AI analysis using face-api.js for the Quiz Anti-Cheat System
 */

const video = document.getElementById('webcamVideo');
const canvas = document.getElementById('webcamCanvas');
const proctorStatus = document.getElementById('proctorStatus');
const proctorDot = document.getElementById('proctorDot');
const proctorText = document.getElementById('proctorText');
const webcamContainer = document.getElementById('webcamContainer');

let isProctoringActive = false;
let detectionInterval = null;
let noFaceFrames = 0;
let multipleFacesFrames = 0;

// Thresholds for triggering warnings (how many consecutive frames of violation before a warning)
const NO_FACE_THRESHOLD = 30; // ~3 seconds at 10fps
const MULTIPLE_FACES_THRESHOLD = 20; // ~2 seconds at 10fps

// ============================================================================
// EARLY CAMERA PERMISSION REQUEST
// ============================================================================

/**
 * initCameraEarly: Called as soon as the start screen loads.
 * This requests camera access immediately so the browser can 'remember' it.
 * The actual face-detection only starts after startQuiz() is called.
 */
async function initCameraEarly() {
    try {
        proctorStatus.classList.remove('hidden');
        proctorStatus.classList.add('flex');
        proctorText.textContent = 'Requesting Camera...';
        proctorDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';

        // Request camera access to allow browser to remember permission
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });

        // Store stream reference so we reuse it when the quiz starts
        window._proctoringStream = stream;

        // Show the webcam feed immediately on the start screen
        video.srcObject = stream;
        webcamContainer.classList.remove('hidden');

        proctorText.textContent = 'Camera Ready';
        proctorDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';

        // Update the camera status badge on the start screen if it exists
        const camStatus = document.getElementById('cameraStatusBadge');
        if (camStatus) {
            camStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500"></span><span class="text-green-400">Camera Active – Proctoring Enabled</span>`;
        }
    } catch (err) {
        console.error("Early camera init failed:", err);
        proctorText.textContent = 'Camera Denied';
        proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';

        const camStatus = document.getElementById('cameraStatusBadge');
        if (camStatus) {
            camStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-red-400">Camera Denied – Proctoring Required. Please allow camera access and refresh.</span>`;
        }
    }
}

// Load AI Models (called when Start is clicked)
async function loadModels() {
    try {
        proctorText.textContent = 'Loading AI...';
        proctorDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
        
        // We only need the tiny face detector for performance
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');

        // If camera was already started early, reuse the stream
        if (window._proctoringStream && video.srcObject) {
            // Already streaming — just start detection
            const displaySize = { width: video.width, height: video.height };
            faceapi.matchDimensions(canvas, displaySize);
            isProctoringActive = true;
            startDetection(displaySize);
            startBackgroundProctoring();
            enforceFullScreen();
        } else {
            startVideo();
        }
    } catch (err) {
        console.error("Failed to load AI models:", err);
        proctorText.textContent = 'AI Failed to Load';
        proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';
    }
}

// Start Webcam (if not already started by initCameraEarly)
function startVideo() {
    const useExistingStream = window._proctoringStream;
    const streamPromise = useExistingStream
        ? Promise.resolve(useExistingStream)
        : navigator.mediaDevices.getUserMedia({ video: {} });

    streamPromise
        .then(stream => {
            video.srcObject = stream;
            webcamContainer.classList.remove('hidden');
            
            proctorText.textContent = 'Proctor Active';
            proctorDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
            
            // Wait for video to start playing before tracking
            video.addEventListener('playing', () => {
                const displaySize = { width: video.width, height: video.height };
                faceapi.matchDimensions(canvas, displaySize);
                
                isProctoringActive = true;
                startDetection(displaySize);
                startBackgroundProctoring();
                enforceFullScreen();
            }, { once: true });
        })
        .catch(err => {
            console.error("Webcam access denied or unavailable:", err);
            proctorText.textContent = 'Camera Denied';
            proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';
            
            // If they deny camera, trigger an immediate warning
            if (typeof triggerWarning === 'function') {
                triggerWarning("Camera Required", "You must allow camera access to take this proctored quiz.");
            }
        });
}

// Start analyzing frames
function startDetection(displaySize) {
    // Run detection every 100ms (10fps is plenty for this and saves CPU)
    detectionInterval = setInterval(async () => {
        if (!isProctoringActive || !isQuizActive) return;

        // Detect all faces
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })
        );
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        
        // Draw boxes on canvas for visual feedback
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);

        analyzeDetections(detections.length);
        
    }, 100);
}

// Analyze the number of faces and trigger warnings if necessary
function analyzeDetections(faceCount) {
    if (faceCount === 0) {
        noFaceFrames++;
        multipleFacesFrames = 0; // reset
        
        proctorContainerAlert('border-amber-500');
        
        if (noFaceFrames >= NO_FACE_THRESHOLD) {
            noFaceFrames = 0; // Reset after triggering
            if (typeof triggerWarning === 'function') {
                triggerWarning("Face Not Detected", "Please ensure your face is clearly visible to the camera at all times.");
            }
        }
    } else if (faceCount > 1) {
        multipleFacesFrames++;
        noFaceFrames = 0; // reset
        
        proctorContainerAlert('border-red-500');
        
        if (multipleFacesFrames >= MULTIPLE_FACES_THRESHOLD) {
            multipleFacesFrames = 0; // Reset after triggering
            if (typeof triggerWarning === 'function') {
                triggerWarning("Multiple People Detected", "Only the registered student is allowed in the camera frame.");
            }
        }
    } else {
        // Exactly 1 face (All good)
        noFaceFrames = 0;
        multipleFacesFrames = 0;
        proctorContainerAlert('border-zinc-800'); // normal border
    }
}

// Visual effect on the webcam container — only swap the border color, never set 'hidden'
function proctorContainerAlert(borderColorClass) {
    webcamContainer.classList.remove('border-zinc-800', 'border-amber-500', 'border-red-500');
    webcamContainer.classList.add(borderColorClass);
    webcamContainer.classList.remove('hidden');
}

// ============================================================================
// BROWSER LOCK (FULL-SCREEN ENFORCEMENT)
// ============================================================================

function enforceFullScreen() {
    // Request full-screen on the document element
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();

    let fsWarningCooldown = false;

    // Listen for full-screen exit
    document.addEventListener('fullscreenchange', () => {
        if (!isProctoringActive) return;
        const isFullscreen = !!document.fullscreenElement;
        if (!isFullscreen && !fsWarningCooldown) {
            fsWarningCooldown = true;
            setTimeout(() => { fsWarningCooldown = false; }, 5000);

            if (typeof triggerWarning === 'function') {
                triggerWarning(
                    'Full-Screen Required',
                    'Exiting full-screen is not allowed during the quiz. Please return to full-screen to continue.'
                );
            }
        }
    });
}

// ============================================================================
// MOBILE & TAB-SWITCHING PROCTORING (Visibility API & Time Drift)
// ============================================================================

const TIME_DRIFT_THRESHOLD = 3000; // 3 seconds suspended = warning
let lastHeartbeatTime = Date.now();
let heartbeatInterval = null;
let visibilityExitTime = 0;

function startBackgroundProctoring() {
    // 1. Time Drift Detection (Heartbeat) - Catches Mobile Phone Calls / App Suspensions
    lastHeartbeatTime = Date.now();
    heartbeatInterval = window.setInterval(() => {
        if (!isProctoringActive || typeof isQuizActive === 'undefined' || !isQuizActive) return;

        const currentTime = Date.now();
        const timeDiff = currentTime - lastHeartbeatTime;

        // If the interval took more than 3 seconds (instead of 1s), the app was suspended
        if (timeDiff > TIME_DRIFT_THRESHOLD) {
            console.warn(`Time drift detected! User likely answered a call or minimized the app. (Diff: ${timeDiff}ms)`);
            if (typeof triggerWarning === 'function') {
                triggerWarning("Background Activity Detected", "The quiz was suspended in the background. Please do not leave the app or answer calls during the quiz.");
            }
        }
        
        // Reset the timer for the next heartbeat
        lastHeartbeatTime = Date.now(); // Recalculate now to avoid compounding drift
    }, 1000);

    // 2. Page Visibility API - Catches Tab Switching
    document.addEventListener("visibilitychange", () => {
        if (!isProctoringActive || typeof isQuizActive === 'undefined' || !isQuizActive) return;

        if (document.visibilityState === 'hidden') {
            // User left the tab
            visibilityExitTime = Date.now();
            console.warn("Tab hidden! User switched tabs or minimized browser.");
        } else if (document.visibilityState === 'visible') {
            // User returned to the tab
            if (visibilityExitTime > 0) {
                const timeAway = Date.now() - visibilityExitTime;
                visibilityExitTime = 0; // reset
                
                // If away for more than 1 second, trigger a warning
                if (timeAway > 1500) {
                    console.warn(`Tab was hidden for ${timeAway}ms. Triggering warning.`);
                    if (typeof triggerWarning === 'function') {
                        triggerWarning("Switched Tabs Detected", "You must remain on the quiz page. Switching tabs is not allowed.");
                    }
                }
            }
        }
    });
}
