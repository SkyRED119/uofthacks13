import cv2
import mediapipe as mp
import numpy as np
from scipy.spatial import distance as dist

# --- CONFIGURATION ---
EAR_THRESHOLD = 0.20 
# We keep CONSECUTIVE_FRAMES at 1 for "instant" reading-stop response
CONSECUTIVE_FRAMES = 1 

LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

def calculate_ear(eye_landmarks):
    v1 = dist.euclidean(eye_landmarks[1], eye_landmarks[5])
    v2 = dist.euclidean(eye_landmarks[2], eye_landmarks[4])
    h = dist.euclidean(eye_landmarks[0], eye_landmarks[3])
    return (v1 + v2) / (2.0 * h)

# --- INITIALIZATION ---
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)

# Using Index 1 as confirmed
cap = cv2.VideoCapture(1, cv2.CAP_AVFOUNDATION)

blink_counter = 0
eyes_already_closed = False # To prevent multiple triggers during a single blink

print("Reading Tracker Active. Press 'ESC' to quit.")

while cap.isOpened():
    success, frame = cap.read()
    if not success: break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        landmarks = results.multi_face_landmarks[0].landmark
        coords = [(int(l.x * w), int(l.y * h)) for l in landmarks]

        left_eye_pts = [coords[i] for i in LEFT_EYE]
        right_eye_pts = [coords[i] for i in RIGHT_EYE]
        avg_ear = (calculate_ear(left_eye_pts) + calculate_ear(right_eye_pts)) / 2.0

        # --- REVERSED TRIGGER LOGIC ---
        if avg_ear < EAR_THRESHOLD:
            if not eyes_already_closed:
                # TRIGGER INSTANTLY ON CLOSURE
                blink_counter += 1
                eyes_already_closed = True 
                print(f"[ACTION] Eyes Closed! Total Blinks: {blink_counter}")
                # Place your "Stop Reading / Pause" function call here
            
            status_color = (0, 0, 255) # Red for "Closed"
            status_text = "EYES CLOSED - READING PAUSED"
        else:
            if eyes_already_closed:
                # RESET ONLY ONCE EYES RE-OPEN
                eyes_already_closed = False
                print("[ACTION] Eyes Re-opened - Resuming...")
            
            status_color = (0, 255, 0) # Green for "Open"
            status_text = "EYES OPEN - READING ACTIVE"

        # Visual Feedback for the App
        cv2.putText(frame, status_text, (30, 50), 0, 0.8, status_color, 2)
        cv2.putText(frame, f"Blinks: {blink_counter}", (30, 90), 0, 0.7, (255, 255, 255), 2)

    cv2.imshow('Reading Assistant - Blink Detection', frame)
    if cv2.waitKey(1) & 0xFF == 27: break

cap.release()
cv2.destroyAllWindows()
