BUCKET          ?= mi-online-tools-prd
DISTRIBUTION_ID ?= E1XJSEMRS07YR8
FRONTEND_DIR    := frontend
DIST_DIR        := $(FRONTEND_DIR)/dist

.PHONY: deploy build clean-bucket upload invalidate

deploy: build clean-bucket upload invalidate

build:
	cd $(FRONTEND_DIR) && npm ci && npm run build

clean-bucket:
	aws s3 rm s3://$(BUCKET)/ --recursive

# Arquivos com hash no nome (assets/) são imutáveis; index.html e os arquivos do PWA que mantêm
# o mesmo nome entre deploys (service worker, manifest, registerSW) nunca ficam em cache —
# senão o navegador não percebe a versão nova.
NO_CACHE := index.html sw.js registerSW.js manifest.webmanifest

upload:
	aws s3 sync $(DIST_DIR)/ s3://$(BUCKET)/ \
		$(foreach f,$(NO_CACHE),--exclude "$(f)") \
		--cache-control "public,max-age=31536000,immutable"
	$(foreach f,$(NO_CACHE),aws s3 cp $(DIST_DIR)/$(f) s3://$(BUCKET)/$(f) --cache-control "no-cache" &&) true

invalidate:
	aws cloudfront create-invalidation \
		--distribution-id $(DISTRIBUTION_ID) \
		--paths "/*"
