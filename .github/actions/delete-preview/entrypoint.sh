#!/usr/bin/env bash
# shellcheck disable=SC2155

set -euo pipefail

export PREVIEW_ENV_DEV_SA_KEY_PATH="$GOOGLE_APPLICATION_CREDENTIALS"

gcloud auth activate-service-account --key-file "${GOOGLE_APPLICATION_CREDENTIALS}"

echo "Previewctl get-credentials"
previewctl get-credentials --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"
echo "Previewctl install-context"
previewctl install-context  --timeout 10m --gcp-service-account "${GOOGLE_APPLICATION_CREDENTIALS}"

export TF_INPUT=0
export TF_IN_AUTOMATION=true
export TF_VAR_preview_name="$(previewctl get-name --branch "${INPUT_NAME}")"

leeway run dev/preview:delete-preview