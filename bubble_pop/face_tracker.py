import os
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

FACE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_detector.tflite")


class FaceTracker:
    """
    Detect faces and assign to players by horizontal position.
    Left half  -> Player 1
    Right half -> Player 2
    """

    def __init__(self):
        base_options = mp_python.BaseOptions(model_asset_path=FACE_MODEL_PATH)
        options = vision.FaceDetectorOptions(base_options=base_options)
        self.detector = vision.FaceDetector.create_from_options(options)

    def detect_players(self, frame_rgb, frame_w, frame_h):
        """Returns a set {1} and/or {2} of detected player numbers."""
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = self.detector.detect(mp_image)

        detected = set()
        for det in result.detections:
            bbox = det.bounding_box
            center_x_norm = (bbox.origin_x + bbox.width / 2) / frame_w
            if center_x_norm < 0.5:
                detected.add(1)
            else:
                detected.add(2)
        return detected

    def close(self):
        self.detector.close()
