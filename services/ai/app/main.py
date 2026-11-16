from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .labels import StandardPlane

app = FastAPI(title="ObGyn e-LMS AI service", version="0.1.0")


class PlaneClassifyRequest(BaseModel):
    # Short-lived signed URL to a de-identified frame, issued by @obgyn/api.
    frame_url: str = Field(..., max_length=2048)


class PlanePrediction(BaseModel):
    plane: StandardPlane
    confidence: float = Field(..., ge=0, le=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/plane-classify", response_model=PlanePrediction)
def classify_plane(_request: PlaneClassifyRequest) -> PlanePrediction:
    # Model (PyTorch/MONAI) not trained yet; see docs/05-SIMULATORS.md once it exists.
    raise HTTPException(status_code=501, detail="Plane classifier not available yet")
