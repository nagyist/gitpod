# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:97a9dd83b120b33159b94f79db90cd51a205363305818f737605354b54311974 as compress

RUN apk add brotli gzip

# Gitpod CLI and Local App
COPY components-local-app--app-with-manifest/bin/* /bin/

RUN for FILE in `ls /bin/gitpod-local-companion*`;do \
  gzip -v -f -9 -k "$FILE"; \
done

FROM caddy/caddy:2.7.6-alpine

COPY conf/Caddyfile /etc/caddy/Caddyfile
COPY static /www/
COPY --from=compress /bin /www/static/bin
