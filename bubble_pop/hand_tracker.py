import os
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# MediaPipe landmark indices
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20
FINGERTIP_INDICES = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")


class HandTracker:
    """
    Detect up to 2 hands using MediaPipe Tasks API (>=0.10).
    Assign player by horizontal position:
      Left half of frame  -> Player 1
      Right half of frame -> Player 2
    """

    def __init__(self, max_hands=2):
        base_options = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=max_hands,
        )
        self.detector = vision.HandLandmarker.create_from_options(options)

    def process(self, frame_rgb, frame_w, frame_h):
        """
        Process an RGB numpy frame and return a list of player hand data.

        Returns:
            List of dicts:
            {
                'player': 1 or 2,
                'index_tip': (x_px, y_px),
                'fingertips': [(x, y), ...],  # 5 fingertip pixel positions
            }
        """
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = self.detector.detect(mp_image)

        hands_data = []
        if not result.hand_landmarks:
            return hands_data

        for landmarks in result.hand_landmarks:
            index_lm = landmarks[INDEX_TIP]
            index_x_norm = index_lm.x
            index_y_norm = index_lm.y

            index_tip_px = (
                int(index_x_norm * frame_w),
                int(index_y_norm * frame_h),
            )

            player = 1 if index_x_norm < 0.5 else 2

            fingertips = []
            for tip_idx in FINGERTIP_INDICES:
                lm = landmarks[tip_idx]
                fingertips.append((int(lm.x * frame_w), int(lm.y * frame_h)))

            hands_data.append(
                {
                    "player": player,
                    "index_tip": index_tip_px,
                    "fingertips": fingertips,
                }
            )

        hands_data = self._resolve_conflicts(hands_data)
        return hands_data

    def _resolve_conflicts(self, hands_data):
        """Ensure no two hands share the same player slot."""
        if len(hands_data) < 2:
            return hands_data

        p1_hands = [h for h in hands_data if h["player"] == 1]
        p2_hands = [h for h in hands_data if h["player"] == 2]

        if len(p1_hands) == 2:
            p1_hands.sort(key=lambda h: h["index_tip"][0])
            p1_hands[1]["player"] = 2

        if len(p2_hands) == 2:
            p2_hands.sort(key=lambda h: h["index_tip"][0])
            p2_hands[0]["player"] = 1

        return hands_data

    def close(self):
        self.detector.close()
