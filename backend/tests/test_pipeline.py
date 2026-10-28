from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_extract_frames_api():
    response = client.post(
        "/api/v1/pipeline/extract-frames",
        json={
            "video_filename": "synthetic_sweep.mp4",
            "target_fps": 2.0,
            "max_frames": 10,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["extracted_frames_count"] > 0
    assert "data/frames/synthetic_sweep" in data["output_directory"]


def test_extract_frames_nonexistent():
    response = client.post(
        "/api/v1/pipeline/extract-frames",
        json={
            "video_filename": "does_not_exist.mp4",
            "target_fps": 2.0,
            "max_frames": 10,
        },
    )
    assert response.status_code == 404
