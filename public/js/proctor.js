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

// Load AI Models
async function loadModels() {
    try {
        proctorStatus.classList.remove('hidden');
        proctorStatus.classList.add('flex');
        
        // We only need the tiny face detector for performance
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        
        proctorText.textContent = 'Requesting Camera...';
        proctorDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
        
        startVideo();
    } catch (err) {
        console.error("Failed to load AI models:", err);
        proctorText.textContent = 'AI Failed to Load';
        proctorDot.className = 'w-2 h-2 rounded-full bg-red-500';
    }
}

// Start Webcam
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
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
            });
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

// Visual effect on the webcam container
function proctorContainerAlert(borderColorClass) {
    webcamContainer.className = `hidden fixed bottom-4 right-4 z-[60] bg-zinc-900 border-2 ${borderColorClass} rounded-xl overflow-hidden shadow-2xl transition-all hover:scale-105 group`;
    webcamContainer.classList.remove('hidden');
}
