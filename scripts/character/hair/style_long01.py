"""Straight wig: MPFB library hair long01, fitted to the base female and prepared by mpfbkit."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpfbkit  # noqa: E402

mpfbkit.build("long01", "long01")
