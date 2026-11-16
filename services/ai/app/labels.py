"""Label sets the models may output.

PC-PNDT (CLAUDE.md rule 1): no label, class or output may identify fetal sex,
and models must never be trained to predict it. `assert_compliant_labels`
runs at import time so a non-compliant label set cannot ship.
"""

import re
from enum import Enum

FORBIDDEN_LABEL = re.compile(
    r"sex|gender|genital|male|female|penis|scrotum|labia|clitoris|turtle[_\s-]?sign|hamburger[_\s-]?sign",
    re.IGNORECASE,
)


class StandardPlane(str, Enum):
    TRANSVENTRICULAR = "transventricular"
    TRANSTHALAMIC = "transthalamic"
    TRANSCEREBELLAR = "transcerebellar"
    ABDOMINAL_CIRCUMFERENCE = "abdominal_circumference"
    FEMUR_LENGTH = "femur_length"
    FOUR_CHAMBER = "four_chamber"
    OTHER = "other"


def assert_compliant_labels(labels: list[str]) -> None:
    bad = [label for label in labels if FORBIDDEN_LABEL.search(label)]
    if bad:
        raise ValueError(f"PC-PNDT: forbidden labels in model output space: {bad}")


assert_compliant_labels([plane.value for plane in StandardPlane])
