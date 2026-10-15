"""Pixie cut: MPFB library hair short04, fitted to the base female and prepared by mpfbkit."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpfbkit  # noqa: E402

mpfbkit.build("pixie", "short04")
