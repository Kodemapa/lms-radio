import pytest
from fastapi.testclient import TestClient

from app.labels import StandardPlane, assert_compliant_labels
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_classifier_not_ready_yet():
    response = client.post("/v1/plane-classify", json={"frame_url": "https://example.com/f.png"})
    assert response.status_code == 501


def test_plane_labels_are_compliant():
    assert_compliant_labels([plane.value for plane in StandardPlane])


@pytest.mark.parametrize("label", ["fetal_sex", "Gender", "male", "genital_tubercle", "turtle sign"])
def test_forbidden_labels_are_rejected(label):
    with pytest.raises(ValueError):
        assert_compliant_labels(["transthalamic", label])
