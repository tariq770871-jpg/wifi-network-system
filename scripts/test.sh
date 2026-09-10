#!/usr/bin/env sh
# اختبار المشروع كاملاً بحزمة Docker معزولة بأمر واحد
# الاستخدام: ./scripts/test.sh
set -e
cd "$(dirname "$0")/.."
exec docker compose -f docker-compose.test.yml up \
  --abort-on-container-exit \
  --exit-code-from tests
