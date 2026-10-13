"""Silk-press bob: MPFB library hair bob02, fitted to the base female and prepared by mpfbkit."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpfbkit  # noqa: E402

mpfbkit.build("bob02", "bob02")
