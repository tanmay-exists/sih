import cv2
import mediapipe as mp
import math

# --- Initialization ---

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Drawing specs for landmarks (e.g., small green dots)
drawing_spec_landmarks = mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1, circle_radius=1)
# Drawing specs for connections (e.g., thin white lines)
drawing_spec_connections = mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=1)

# These are the specific landmark indices for the pupils
# You can find all 478 landmark indices here:
# https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
LEFT_PUPIL_INDEX = 473
RIGHT_PUPIL_INDEX = 468

# Initialize OpenCV VideoCapture
try:
    cap = cv2.VideoCapture(0) # 0 is typically the default webcam
    if not cap.isOpened():
        raise IOError("Cannot open webcam. Ensure it is connected and not in use by another application.")
except Exception as e:
    print(f"Error initializing webcam: {e}")
    print("If you are using a notebook, try changing the index (e.g., cv2.VideoCapture(1))")
    exit()

print("Webcam initialized successfully. Press 'ESC' to quit.")

# --- Main Loop ---
# We use 'with' to ensure resources are properly managed
with mp_face_mesh.FaceMesh(
    max_num_faces=1,                          # Track only one face for this demo
    refine_landmarks=True,                    # This enables tracking of pupils, iris
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5) as face_mesh:

    while cap.isOpened():
        success, image = cap.read()
        if not success:
            print("Ignoring empty camera frame.")
            continue

        # To improve performance, mark the image as not writeable to
        # pass by reference.
        # --- FIX ---
        # Changed from image.flags.setflags(write=False)
        image.flags.writeable = False

        # --- Image Processing ---
        # Flip the image horizontally for a selfie-view display.
        image = cv2.flip(image, 1)

        # Convert the BGR image to RGB.
        # OpenCV uses BGR, MediaPipe uses RGB.
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Process the RGB image with MediaPipe Face Mesh
        results = face_mesh.process(rgb_image)

        # --- Drawing on the Image ---
        # Now, make the image writeable again to draw on it.
        # --- FIX ---
        # Changed from image.flags.setflags(write=True)
        image.flags.writeable = True

        if results.multi_face_landmarks:
            # We are only tracking one face, so we can take the first result
            face_landmarks = results.multi_face_landmarks[0]
            
            # Get image dimensions to convert normalized coordinates
            img_h, img_w, img_c = image.shape

            # --- 1. Draw the Full Face Mesh (Optional) ---
            # This draws all 478 landmarks and their connections
            # mp_drawing.draw_landmarks(
            #     image=image,
            #     landmark_list=face_landmarks,
            #     connections=mp_face_mesh.FACEMESH_TESSELATION,
            #     landmark_drawing_spec=drawing_spec_landmarks,
            #     connection_drawing_spec=drawing_spec_connections)
            
            # --- 2. Draw Eye Contours (A cleaner look) ---
            # Draw contours for left eye
            mp_drawing.draw_landmarks(
                image=image,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_LEFT_EYE,
                landmark_drawing_spec=None, # No landmarks, just connections
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style())
            
            # Draw contours for right eye
            mp_drawing.draw_landmarks(
                image=image,
                landmark_list=face_landmarks,
                connections=mp_face_mesh.FACEMESH_RIGHT_EYE,
                landmark_drawing_spec=None, # No landmarks, just connections
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_contours_style())

            # --- 3. Find and Draw Pupils ---
            # MediaPipe provides normalized coordinates (0.0 to 1.0)
            # We must convert them to pixel coordinates
            
            # Left Pupil
            left_pupil_landmark = face_landmarks.landmark[LEFT_PUPIL_INDEX]
            # Convert normalized (x, y) to pixel (cx, cy)
            left_pupil_cx = int(left_pupil_landmark.x * img_w)
            left_pupil_cy = int(left_pupil_landmark.y * img_h)
            # Draw a circle at the pupil's location
            cv2.circle(image, (left_pupil_cx, left_pupil_cy), radius=3, color=(0, 0, 255), thickness=-1) # Red circle

            # Right Pupil
            right_pupil_landmark = face_landmarks.landmark[RIGHT_PUPIL_INDEX]
            right_pupil_cx = int(right_pupil_landmark.x * img_w)
            right_pupil_cy = int(right_pupil_landmark.y * img_h)
            cv2.circle(image, (right_pupil_cx, right_pupil_cy), radius=3, color=(0, 0, 255), thickness=-1) # Red circle

            # You could add logic here. For example, check if the person is looking left or right.
            # This is a very simple example of "gaze detection"
            try:
                # Find center of the left iris (indices 474-477)
                left_iris_coords = [face_landmarks.landmark[i] for i in range(474, 478)]
                left_iris_center_x = sum(l.x for l in left_iris_coords) / len(left_iris_coords)
                
                # Find center of the right iris (indices 469-472)
                right_iris_coords = [face_landmarks.landmark[i] for i in range(469, 472)]
                right_iris_center_x = sum(l.x for l in right_iris_coords) / len(right_iris_coords)

                # Calculate horizontal gaze ratio (very simplified)
                # Compare pupil's X-position to the iris's center X-position
                left_gaze_ratio = (left_pupil_landmark.x - left_iris_center_x) / (left_iris_coords[2].x - left_iris_coords[0].x)
                right_gaze_ratio = (right_pupil_landmark.x - right_iris_center_x) / (right_iris_coords[2].x - right_iris_coords[0].x)
                
                avg_gaze_ratio = (left_gaze_ratio + right_gaze_ratio) / 2

                gaze_text = ""
                if avg_gaze_ratio > 0.1: # Thresholds need tuning
                    gaze_text = "Looking Right"
                elif avg_gaze_ratio < -0.1:
                    gaze_text = "Looking Left"
                else:
                    gaze_text = "Looking Center"
                
                cv2.putText(image, gaze_text, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2, cv2.LINE_AA)
            
            except Exception as e:
                # print(f"Error during gaze calculation: {e}") # You can uncomment this for debugging
                pass # Continue even if gaze logic fails

        # --- Display the Final Image ---
        cv2.imshow('Python Eye Tracker (Press ESC to quit)', image)

        # --- Exit Condition ---
        # Wait for 5ms, and check if 'ESC' key (ASCII 27) was pressed
        if cv2.waitKey(5) & 0xFF == 27:
            print("Escape key pressed. Exiting...")
            break

# --- Cleanup ---
cap.release()
cv2.destroyAllWindows()
print("Resources released.")
