import torch
import numpy as np
import cv2
from transformers import AutoImageProcessor, AutoModelForDepthEstimation
from PIL import Image
import config

# Downscale input to this size before depth inference.
# Cuts CPU inference time by ~6-10x. Depth map is scaled back to original size.
DEPTH_INFER_SIZE = (320, 240)  # (width, height)

class DepthEstimator:
    def __init__(self, model_name=config.DEPTH_MODEL_NAME):
        self.processor = AutoImageProcessor.from_pretrained(model_name)
        self.model = AutoModelForDepthEstimation.from_pretrained(model_name).to(config.DEVICE)

    def estimate(self, frame):
        orig_h, orig_w = frame.shape[:2]

        # Downscale for fast inference
        small = cv2.resize(frame, DEPTH_INFER_SIZE, interpolation=cv2.INTER_AREA)
        rgb_frame = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)

        inputs = self.processor(images=pil_img, return_tensors="pt").to(config.DEVICE)
        with torch.no_grad():
            outputs = self.model(**inputs)
            predicted_depth = outputs.predicted_depth

        # Resize prediction back to original frame dimensions
        prediction = torch.nn.functional.interpolate(
            predicted_depth.unsqueeze(1),
            size=(orig_h, orig_w),
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        depth_map = prediction.cpu().numpy()
        # Normalize to 0-255 for stable threshold comparisons
        depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min() + 1e-8)
        depth_map = (depth_map * 255).astype(np.uint8)
        return depth_map
