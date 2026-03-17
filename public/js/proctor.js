/**
 * proctor.js
 * Handles webcam AI analysis using face-api.js (justadudewhohacks v0.22.2)
 * for the Quiz Anti-Cheat System.
 *
 * Key fixes:
 *  1. CDN switched to face-api.js@0.22.2 to match /models format
 *  2. Uses video.videoWidth/videoHeight (not video.width/height which are 0 for CSS-sized elements)
 *  3. Waits for faceapi to be loaded (defer script) before using it
 *  4. All active checks use window.isQuizActive (live value from quiz-taking.js)
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

// How many consecutive bad frames before a warning is triggered
const NO_FACE_THRESHOLD = 30;        // ~3 sec at 10fps
const MULTIPLE_FACES_THRESHOLD = 20; // ~2 sec at 10fps

// ============================================================================
// WAIT FOR face-api.js TO LOAD (it is loaded with 'defer')
// ============================================================================

function waitForFaceApi(callback) {
    if (typeof faceapi !== 'undefined') {
        callback();
    } else {
        // Check every 100ms until faceapi is available
        const check = setInterval(() => {
            if (typeof faceapi !== 'undefined') {
                clearInterval(check);
                callback();
            }
        }, 100);
    }
}

// ============================================================================
// EARLY CAMERA PERMISSION REQUEST
// ============================================================================

async function initCameraEarly() {
    proctorStatus.classList.remove('hidden');
    proctorStatus.classList.add('flex');
    proctorText.textContent = 'Requesting Camera...';
    proctorDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';

    const camStatus = document.getElementById('cameraStatusBadge');

    try {
        // Request camera with ideal resolution for better face detection
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        window._proctoringStream = stream;
        video.srcObject = stream;
        webcamContainer.classList.remove('hidden');

        proctorText.textContent = 'Camera Ready';
        proctorDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';

        if (camStatus) {
            camStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-500"></span><span class="text-green-400">Camera Active – Proctoring Enabled</span>`;
        }
    } catch (err) {
        console.error('Camera init failed:', err);
        proctorText.textContent = 'Camera Denied';
        proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';

        if (camStatus) {
            camStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span><span class="text-red-400">Camera Denied – Please allow access and refresh.</span>`;
        }
    }
}

// ============================================================================
// LOAD MODELS AND START DETECTION (called when "Start Quiz" is clicked)
// ============================================================================

async function loadModels() {
    proctorStatus.classList.remove('hidden');
    proctorStatus.classList.add('flex');
    proctorText.textContent = 'Loading AI...';
    proctorDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';

    // Wait for face-api.js to finish loading (it uses 'defer')
    waitForFaceApi(async () => {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            console.log('✅ face-api model loaded successfully');

            proctorText.textContent = 'Proctor Active';
            proctorDot.className = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';

            if (window._proctoringStream && video.srcObject) {
                // Camera already running — start detection directly
                isProctoringActive = true;
                webcamContainer.classList.remove('hidden');
                waitForVideoThenDetect();
            } else {
                openCamera();
            }
        } catch (err) {
            console.error('Failed to load face-api model:', err);
            proctorText.textContent = 'AI Load Failed';
            proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';
        }
    });
}

// ============================================================================
// CAMERA STARTUP (fallback if early init didn't run)
// ============================================================================

function openCamera() {
    const streamPromise = window._proctoringStream
        ? Promise.resolve(window._proctoringStream)
        : navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          });

    streamPromise
        .then(stream => {
            video.srcObject = stream;
            window._proctoringStream = stream;
            webcamContainer.classList.remove('hidden');
            isProctoringActive = true;
            waitForVideoThenDetect();
        })
        .catch(err => {
            console.error('Camera access denied:', err);
            proctorText.textContent = 'Camera Denied';
            proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';
            if (typeof window.triggerWarning === 'function') {
                window.triggerWarning('Camera Required', 'You must allow camera access to take this proctored quiz.');
            }
        });
}

// ============================================================================
// WAIT FOR VIDEO TO BE READY (video.videoWidth must be > 0)
// ============================================================================

/**
 * CSS-sized video elements return video.width = 0 and video.height = 0.
 * We must use video.videoWidth / video.videoHeight (actual stream resolution).
 * These are only available once the stream metadata has loaded.
 */
function waitForVideoThenDetect() {
    function tryStart() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            startFaceDetection();
        } else {
            // Not ready yet — wait a bit and retry
            setTimeout(tryStart, 200);
        }
    }

    if (video.readyState >= 2) {
        tryStart();
    } else {
        video.addEventListener('loadeddata', tryStart, { once: true });
        video.addEventListener('playing', tryStart, { once: true });
    }
}

function startFaceDetection() {
    const W = video.videoWidth;
    const H = video.videoHeight;
    const displaySize = { width: W, height: H };

    // Match canvas to actual stream resolution
    canvas.width = W;
    canvas.height = H;
    faceapi.matchDimensions(canvas, displaySize);

    console.log(`🎥 Detection started at ${W}x${H}`);

    // ── Detection loop ──────────────────────────────────────────────────────
    detectionInterval = setInterval(async () => {
        // window.isQuizActive is kept in sync by quiz-taking.js
        if (!isProctoringActive || !window.isQuizActive) return;

        try {
            const detections = await faceapi.detectAllFaces(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })
            );

            // Draw bounding boxes on overlay canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, W, H);
            const resized = faceapi.resizeResults(detections, displaySize);
            faceapi.draw.drawDetections(canvas, resized);

            analyzeDetections(detections.length);

        } catch (e) {
            // Ignore transient errors (e.g. frame grabbed during resize)
            console.warn('[proctor] frame error:', e.message);
        }

    }, 100); // 10fps

    // Also start background (tab-switch / phone call) monitoring
    startBackgroundProctoring();
    enforceFullScreen();
}

// ============================================================================
// VIOLATION ANALYSIS — warn if face missing or multiple faces
// ============================================================================

function analyzeDetections(faceCount) {
    if (faceCount === 0) {
        // ── No face detected ──────────────────────────────────
        noFaceFrames++;
        multipleFacesFrames = 0;
        proctorContainerAlert('border-amber-500');

        if (noFaceFrames >= NO_FACE_THRESHOLD) {
            noFaceFrames = 0;
            if (typeof window.triggerWarning === 'function') {
                window.triggerWarning(
                    '⚠️ Face Not Detected',
                    'Please ensure your face is clearly visible to the camera at all times.'
                );
            }
        }

    } else if (faceCount > 1) {
        // ── Multiple faces detected ────────────────────────────
        multipleFacesFrames++;
        noFaceFrames = 0;
        proctorContainerAlert('border-red-500');

        if (multipleFacesFrames >= MULTIPLE_FACES_THRESHOLD) {
            multipleFacesFrames = 0;
            if (typeof window.triggerWarning === 'function') {
                window.triggerWarning(
                    '🚨 Multiple People Detected',
                    'Only the registered student is allowed in the camera frame.'
                );
            }
        }

    } else {
        // ── Exactly 1 face — all good ──────────────────────────
        noFaceFrames = 0;
        multipleFacesFrames = 0;
        proctorContainerAlert('border-green-500');
    }
}

// ============================================================================
// WEBCAM BORDER FEEDBACK (never touches 'hidden')
// ============================================================================

function proctorContainerAlert(borderColorClass) {
    webcamContainer.classList.remove(
        'border-zinc-800', 'border-amber-500', 'border-red-500', 'border-green-500'
    );
    webcamContainer.classList.add(borderColorClass);
    webcamContainer.classList.remove('hidden'); // safety — always keep visible
}

// ============================================================================
// FULL-SCREEN ENFORCEMENT
// ============================================================================

function enforceFullScreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (el.mozRequestFullScreen) el.mozRequestFullScreen();

    let cooldown = false;
    document.addEventListener('fullscreenchange', () => {
        if (!isProctoringActive || !window.isQuizActive) return;
        if (!document.fullscreenElement && !cooldown) {
            cooldown = true;
            setTimeout(() => { cooldown = false; }, 5000);
            if (typeof window.triggerWarning === 'function') {
                window.triggerWarning(
                    'Full-Screen Required',
                    'Exiting full-screen is not allowed during the quiz.'
                );
            }
        }
    });
}

// ============================================================================
// BACKGROUND PROCTORING — tab switch & phone calls
// ============================================================================

const TIME_DRIFT_THRESHOLD = 3000;
let lastHeartbeatTime = Date.now();
let heartbeatInterval = null;
let visibilityExitTime = 0;

function startBackgroundProctoring() {
    // 1. Heartbeat — detects phone calls / app suspend (mobile)
    lastHeartbeatTime = Date.now();
    heartbeatInterval = setInterval(() => {
        if (!isProctoringActive || !window.isQuizActive) return;
        const now = Date.now();
        const diff = now - lastHeartbeatTime;
        if (diff > TIME_DRIFT_THRESHOLD) {
            if (typeof window.triggerWarning === 'function') {
                window.triggerWarning(
                    'Background Activity Detected',
                    'The quiz was suspended. Do not leave the app or answer calls.'
                );
            }
        }
        lastHeartbeatTime = Date.now();
    }, 1000);

    // 2. Page Visibility API — tab switching
    document.addEventListener('visibilitychange', () => {
        if (!isProctoringActive || !window.isQuizActive) return;
        if (document.visibilityState === 'hidden') {
            visibilityExitTime = Date.now();
        } else if (document.visibilityState === 'visible' && visibilityExitTime > 0) {
            const away = Date.now() - visibilityExitTime;
            visibilityExitTime = 0;
            if (away > 1500 && typeof window.triggerWarning === 'function') {
                window.triggerWarning(
                    'Switched Tabs Detected',
                    'You must remain on the quiz page. Switching tabs is not allowed.'
                );
            }
        }
    });
}
