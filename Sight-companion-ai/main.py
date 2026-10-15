import config
from video_processor import PipelineProcessor

if __name__ == "__main__":
    processor = PipelineProcessor(run_ocr=True)
    processor.process_video(source_path="auto")
