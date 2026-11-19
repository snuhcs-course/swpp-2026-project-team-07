#!/bin/sh
set -eu
module_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
classes_dir=$(mktemp -d "${TMPDIR:-/tmp}/outloud-pcm-classes.XXXXXX")
trap 'rm -rf "$classes_dir"' EXIT HUP INT TERM
"${JAVA_HOME:?Set JAVA_HOME to JDK 17}/bin/javac" -d "$classes_dir" \
  "$module_dir/android/src/main/java/expo/modules/outloudrecorder/PcmCaptureFiles.java" \
  "$module_dir/tests/PcmCaptureFilesTest.java"
"$JAVA_HOME/bin/java" -cp "$classes_dir" PcmCaptureFilesTest
